/**
 * Helper process for file.test.ts: writes a few rows into a file-based DuckDB
 * database using the ORM, then exits so the parent process can reopen the file.
 * Not a test file itself (no `.test.ts` suffix).
 */
import 'reflect-metadata';
import { DuckDbLocation, DuckDbRepository } from '../src/index';
import { Subject, SubjectRepository } from './fixtures';

async function main(): Promise<void> {
    const filename = process.argv[2];
    if (!filename) throw new Error('Usage: seed-file-db.ts <db-file>');

    const db = await DuckDbRepository.getInstance({ name: 'seed', location: DuckDbLocation.File, filename });
    const subjects = new SubjectRepository(db);
    await subjects.init();
    await subjects.save(new Subject('SEED-01', 'Seeded one'));
    await subjects.save(new Subject('SEED-02', 'Seeded two'));
    await db.executeQuery('CHECKPOINT');
    await db.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
