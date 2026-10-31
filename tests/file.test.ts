import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DuckDbLocation, DuckDbRepository } from '../src/index';
import { runCompatibilitySuite } from './suite';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'duckdb-tinyorm-'));
const dbFile = path.join(tmpDir, 'test.duckdb');

// Seed the database from a separate process *before* this process opens it, so
// we verify that data is actually persisted to disk and can be reopened by a
// new DuckDB instance (a file can only be locked by one process at a time).
execFileSync(process.execPath, ['--require', path.join(__dirname, 'register.js'), path.join(__dirname, 'seed-file-db.ts'), dbFile], {
    env: process.env,
    stdio: 'pipe',
});

// File-level hook: runs after every suite in this file (including the shared one).
after(async () => {
    await (await DuckDbRepository.getInstance()).close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('file database mode', () => {
    let db: DuckDbRepository;

    before(async () => {
        assert.ok(fs.existsSync(dbFile), 'database file should exist after seeding');

        db = await DuckDbRepository.getInstance({
            name: 'file-test',
            location: DuckDbLocation.File,
            filename: dbFile,
        });
    });

    it('is backed by the database file on disk', async () => {
        const rows = await db.executeQuery(`SELECT path FROM duckdb_databases() WHERE NOT internal AND path IS NOT NULL`);
        assert.deepEqual(rows.map(r => r.path), [dbFile]);
    });

    it('reopens data written by another process', async () => {
        const rows = await db.executeQuery('SELECT Code, Name FROM subjects ORDER BY Id');
        assert.deepEqual(rows, [
            { Code: 'SEED-01', Name: 'Seeded one' },
            { Code: 'SEED-02', Name: 'Seeded two' },
        ]);
    });

    it('continues the persisted auto-increment sequence', async () => {
        await db.executeQuery(`INSERT INTO subjects (Code, Name) VALUES ('SEED-03', 'Seeded three')`);
        const [row] = await db.executeQuery(`SELECT Id FROM subjects WHERE Code = 'SEED-03'`);
        assert.equal(row.Id, 3);
    });

    it('reconnects after close()', async () => {
        await db.close();
        const rows = await db.executeQuery('SELECT COUNT(*) AS c FROM subjects');
        assert.equal(Number(rows[0].c), 3);
    });
});

runCompatibilitySuite(() => DuckDbRepository.getInstance({
    name: 'file-test',
    location: DuckDbLocation.File,
    filename: dbFile,
}));
