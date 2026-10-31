import 'reflect-metadata';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { DuckDbRepository, MigrationRunner, Transaction, appendValue } from '../src/index';
import {
    AddPriceMigration, BrokenMigration, CreateProductsMigration,
    Measurement, MeasurementRepository, Subject, SubjectRepository
} from './fixtures';

/**
 * DuckDB compatibility smoke suite. Shared by the in-memory and file-based
 * test entry points so both storage modes are validated identically.
 */
export function runCompatibilitySuite(getRepository: () => Promise<DuckDbRepository>): void {
    let db: DuckDbRepository;

    before(async () => {
        db = await getRepository();
    });

    describe('repository init', () => {
        it('runs on DuckDB 2.x', async () => {
            const [row] = await db.executeQuery('SELECT version() AS v');
            assert.match(String(row.v), /^v2\./, `unexpected DuckDB version ${row.v}`);
        });

        it('returns the same singleton instance', async () => {
            assert.equal(await DuckDbRepository.getInstance(), db);
        });
    });

    describe('CRUD', () => {
        let subjects: SubjectRepository;

        before(async () => {
            subjects = new SubjectRepository(db);
            await subjects.init();
            await subjects.removeAll();
        });

        it('save() assigns auto-increment ids from the sequence', async () => {
            const a = await subjects.save(new Subject('JS-01', 'JavaScript', 'Intro', 2024));
            const b = await subjects.save(new Subject('TS-01', "O'Reilly TypeScript", undefined, 2025));
            assert.equal(Number(a.Id), 1);
            assert.equal(Number(b.Id), 2);
        });

        it('saveAll() bulk inserts rows', async () => {
            await subjects.saveAll([
                new Subject('PY-01', 'Python', 'Data', 2023),
                new Subject('GO-01', 'Go', 'Systems', 2022),
            ]);
            const all = await subjects.findAll();
            assert.equal(all.length, 4);
        });

        it('findById() / existsById() / findBy()', async () => {
            const found: any = await subjects.findById(2);
            assert.equal(found.Name, "O'Reilly TypeScript");
            assert.equal(found.Description, null);
            assert.equal(await subjects.existsById(2), true);
            assert.equal(await subjects.existsById(999), false);
            const byCode = await subjects.findBy({ Code: 'PY-01' }, ['Code']);
            assert.equal(byCode.length, 1);
            await assert.rejects(() => subjects.findById(999), { name: 'EntityNotFoundError' });
        });

        it('findWithPagination()', async () => {
            const page = await subjects.findWithPagination({ page: 1, size: 3 });
            assert.equal(page.totalElements, 4);
            assert.equal(page.totalPages, 2);
            assert.equal(page.content.length, 1);
        });

        it('enforces CHECK and UNIQUE constraints', async () => {
            await assert.rejects(() => subjects.save(new Subject('OLD-01', 'Old', undefined, 1999)));
            await assert.rejects(() => subjects.save(new Subject('JS-01', 'Duplicate')));
        });

        it('removeById()', async () => {
            const removed: any = await subjects.removeById(1);
            assert.equal(removed.Code, 'JS-01');
            assert.equal(await subjects.existsById(1), false);
        });

        it('removeAll() clears rows and resets the sequence', async () => {
            await subjects.removeAll();
            assert.equal((await subjects.findAll()).length, 0);
            const again = await subjects.save(new Subject('NEW-01', 'Fresh start'));
            assert.equal(Number(again.Id), 1);
            assert.equal(await db.sequenceExists('seq_subjects_Id'), true);
        });
    });

    describe('transactions', () => {
        let subjects: SubjectRepository;

        before(async () => {
            subjects = new SubjectRepository(db);
            await subjects.init();
            await subjects.removeAll();
        });

        it('commits on success', async () => {
            await subjects.withTransaction(async (_tx: Transaction) => {
                await subjects.save(new Subject('TX-01', 'Committed'));
            });
            assert.equal((await subjects.findBy({ Code: 'TX-01' }, ['Code'])).length, 1);
        });

        it('rolls back on failure', async () => {
            await assert.rejects(() => subjects.withTransaction(async () => {
                await subjects.save(new Subject('TX-02', 'Rolled back'));
                throw new Error('boom');
            }), { name: 'TransactionError' });
            assert.equal((await subjects.findBy({ Code: 'TX-02' }, ['Code'])).length, 0);
        });

        it('supports manual begin/rollback', async () => {
            const tx = db.createTransaction();
            await tx.begin();
            await db.executeQuery(`INSERT INTO subjects (Code, Name) VALUES ('TX-03', 'Manual')`);
            await tx.rollback();
            assert.equal((await subjects.findBy({ Code: 'TX-03' }, ['Code'])).length, 0);
        });
    });

    describe('migrations', () => {
        let runner: MigrationRunner;

        before(async () => {
            const connection = (db as any).connection;
            runner = new MigrationRunner(connection, { tableName: 'schema_migrations' });
            await db.executeQuery('DROP TABLE IF EXISTS products');
            await db.executeQuery('DROP TABLE IF EXISTS schema_migrations');
        });

        it('applies migrations in version order', async () => {
            await runner.applyMigrations([new AddPriceMigration(), new CreateProductsMigration()]);
            const rows = await db.executeQuery('SELECT version FROM schema_migrations ORDER BY id');
            assert.deepEqual(rows.map(r => r.version), ['001', '002']);
            const cols = await db.executeQuery(
                `SELECT column_name FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position`);
            assert.deepEqual(cols.map(c => c.column_name), ['id', 'name', 'price']);
        });

        it('is idempotent when re-applied', async () => {
            await runner.applyMigrations([new CreateProductsMigration(), new AddPriceMigration()]);
            const rows = await db.executeQuery('SELECT COUNT(*) AS c FROM schema_migrations');
            assert.equal(Number(rows[0].c), 2);
        });

        it('rolls back a failing migration atomically', async () => {
            await assert.rejects(() => runner.applyMigrations([
                new CreateProductsMigration(), new AddPriceMigration(), new BrokenMigration()
            ]));
            const rows = await db.executeQuery(`SELECT COUNT(*) AS c FROM schema_migrations WHERE version = '003'`);
            assert.equal(Number(rows[0].c), 0);
        });

        it('reverts down to a target version', async () => {
            await runner.revertMigrations([new CreateProductsMigration(), new AddPriceMigration()], '001');
            const rows = await db.executeQuery('SELECT version FROM schema_migrations');
            assert.deepEqual(rows.map(r => r.version), ['001']);
            const cols = await db.executeQuery(
                `SELECT column_name FROM information_schema.columns WHERE table_name = 'products'`);
            assert.equal(cols.some(c => c.column_name === 'price'), false);
        });

        it('reverts all migrations', async () => {
            await runner.revertMigrations([new CreateProductsMigration(), new AddPriceMigration()]);
            const rows = await db.executeQuery('SELECT COUNT(*) AS c FROM schema_migrations');
            assert.equal(Number(rows[0].c), 0);
            const tables = await db.executeQuery(`SELECT table_name FROM information_schema.tables WHERE table_name = 'products'`);
            assert.equal(tables.length, 0);
        });
    });

    describe('appender', () => {
        let measurements: MeasurementRepository;

        before(async () => {
            measurements = new MeasurementRepository(db);
            await measurements.init();
            await measurements.removeAll();
        });

        it('appendEntities() inserts typed values and NULLs', async () => {
            const ts = new Date('2026-01-02T03:04:05.678Z');
            await measurements.appendEntities([
                new Measurement({
                    id: 1, label: 'full', value: 1.5, ratio: 0.25, price: 19.99, big: 9007199254740993n,
                    small: 200, unsigned: 4000000000, huge: 2n ** 100n, active: true,
                    createdAt: ts, day: new Date('2026-03-04T00:00:00.000Z'),
                }),
                new Measurement({ id: 2, label: 'nulls' }),
                new Measurement({ id: 3, label: 'number-as-bigint', big: 42, value: 3 }),
            ]);

            const rows = await db.executeQuery(`
                SELECT id, label, value, ratio, CAST(price AS VARCHAR) AS price, CAST(big AS VARCHAR) AS big,
                       small, unsigned, CAST(huge AS VARCHAR) AS huge, active,
                       strftime(createdAt, '%Y-%m-%dT%H:%M:%S.%g') AS createdAt, CAST(day AS VARCHAR) AS day
                FROM measurements ORDER BY id`);

            assert.equal(rows.length, 3);
            const [full, nulls, coerced] = rows;
            assert.equal(full.label, 'full');
            assert.equal(full.value, 1.5);
            assert.equal(full.ratio, 0.25);
            assert.equal(full.price, '19.99');
            assert.equal(full.big, '9007199254740993');
            assert.equal(full.small, 200);
            assert.equal(full.unsigned, 4000000000);
            assert.equal(full.huge, (2n ** 100n).toString());
            assert.equal(full.active, true);
            assert.equal(full.createdAt, '2026-01-02T03:04:05.678');
            assert.equal(full.day, '2026-03-04');

            for (const col of ['value', 'ratio', 'price', 'big', 'small', 'unsigned', 'huge', 'active', 'createdAt', 'day']) {
                assert.equal(nulls[col], null, `expected ${col} to be NULL`);
            }

            assert.equal(coerced.big, '42');
            assert.equal(coerced.value, 3);
        });

        it('appendValue() works with a raw appender', async () => {
            await db.executeQuery('CREATE OR REPLACE TABLE raw_append (a INTEGER, b VARCHAR, c DOUBLE)');
            const appender = await db.createAppender('raw_append');
            try {
                appendValue(appender, 7, 'INTEGER');
                appendValue(appender, 'seven', 'VARCHAR');
                appendValue(appender, null, 'DOUBLE');
                appender.endRow();
                appender.flushSync();
            } finally {
                appender.closeSync();
            }
            const rows = await db.executeQuery('SELECT * FROM raw_append');
            assert.deepEqual(rows, [{ a: 7, b: 'seven', c: null }]);
        });

        it('appendValue() handles TIMESTAMPTZ, large integers and JSON objects', async () => {
            await db.executeQuery('CREATE OR REPLACE TABLE raw_append2 (ts TIMESTAMPTZ, n BIGINT, j VARCHAR, f FLOAT)');
            const appender = await db.createAppender('raw_append2');
            try {
                appendValue(appender, new Date('2026-05-06T07:08:09.000Z'), 'TIMESTAMP WITH TIME ZONE');
                appendValue(appender, 5_000_000_000); // undeclared type -> BIGINT
                appendValue(appender, { a: 1, b: [true] });
                appendValue(appender, 1.5, 'REAL');
                appender.endRow();
                appender.flushSync();
            } finally {
                appender.closeSync();
            }
            const [row] = await db.executeQuery(
                `SELECT epoch_ms(ts) AS ms, CAST(n AS VARCHAR) AS n, j, f FROM raw_append2`);
            assert.equal(Number(row.ms), Date.parse('2026-05-06T07:08:09.000Z'));
            assert.equal(row.n, '5000000000');
            assert.equal(row.j, '{"a":1,"b":[true]}');
            assert.equal(row.f, 1.5);
        });
    });
}
