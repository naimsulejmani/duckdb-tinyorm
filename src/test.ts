// import { BaseRepository, Column, DuckDbLocation, DuckDbRepository, Entity, Repository, Transaction } from './index';
import 'reflect-metadata';
import { BaseRepository, Column, DuckDbLocation, DuckDbRepository, Entity, Repository, Transaction } from 'duckdb-tinyorm'
// Use the async getInstance method instead of getInstances
let duckDbRepository: DuckDbRepository;

@Entity({ name: 'subjects' })
export class Subject {
    @Column({
        type: 'INTEGER',
        primaryKey: true,
        autoIncrement: true
    })
    Id!: number;

    @Column({
        type: 'VARCHAR',
        notNull: true,
        unique: true
    })
    Code!: string;

    @Column({
        type: 'VARCHAR',
        notNull: true
    })
    Name!: string;

    @Column({
        type: 'TEXT'
    })
    Description?: string;

    @Column({
        type: 'INT',
        defaultValue: new Date().getFullYear(),
        check: 'Year >= 2000'
    })
    Year!: number;

    constructor(code: string = "", name: string = "", description?: string, year: number = new Date().getFullYear()) {
        this.Code = code;
        this.Name = name;
        this.Description = description;
        this.Year = year;
    }
}

@Repository(Subject)
class SubjectRepository extends BaseRepository<Subject, number> {
    constructor(repo: DuckDbRepository) {
        super(repo);
    }

    // Add a custom method to find by code
    async findByCode(code: string): Promise<Subject | null> {
        // Use tableName instead of classType.name
        const query = `SELECT * FROM main.${this.tableName} WHERE Code='${code}'`;
        const result = await this.repository.executeQuery(query);
        return result.length > 0 ? result[0] : null;
    }

    // Add a custom method to remove by code
    async removeByCode(code: string): Promise<Subject | null> {
        const entityToDelete = await this.findByCode(code);
        if (!entityToDelete) return null;

        // Use tableName instead of classType.name
        const query = `DELETE FROM main.${this.tableName} WHERE Code='${code}'`;
        await this.repository.executeQuery(query);

        return entityToDelete;
    }
}

// ── Entity & repository for appender tests (no auto-increment PK) ──

@Entity({ name: 'events' })
class Event {
    @Column({ type: 'INTEGER', primaryKey: true })
    Id!: number;

    @Column({ type: 'VARCHAR', notNull: true })
    Type!: string;

    @Column({ type: 'DOUBLE' })
    Value!: number;

    constructor(id: number = 0, type: string = '', value: number = 0) {
        this.Id = id;
        this.Type = type;
        this.Value = value;
    }
}

@Repository(Event)
class EventRepository extends BaseRepository<Event, number> {
    constructor(repo: DuckDbRepository) {
        super(repo);
    }
}

// Two separate entities for the saveAll vs appendEntities perf comparison
// (each needs its own table so counts don't clash)

@Entity({ name: 'events_perf_save' })
class EventPerf {
    @Column({ type: 'INTEGER', primaryKey: true })
    Id!: number;

    @Column({ type: 'VARCHAR', notNull: true })
    Type!: string;

    @Column({ type: 'DOUBLE' })
    Value!: number;

    constructor(id: number = 0, type: string = '', value: number = 0) {
        this.Id = id;
        this.Type = type;
        this.Value = value;
    }
}

@Repository(EventPerf)
class EventPerfRepository extends BaseRepository<EventPerf, number> {
    constructor(repo: DuckDbRepository) {
        super(repo);
    }
}

@Entity({ name: 'events_perf_append' })
class EventPerfAppend {
    @Column({ type: 'INTEGER', primaryKey: true })
    Id!: number;

    @Column({ type: 'VARCHAR', notNull: true })
    Type!: string;

    @Column({ type: 'DOUBLE' })
    Value!: number;

    constructor(id: number = 0, type: string = '', value: number = 0) {
        this.Id = id;
        this.Type = type;
        this.Value = value;
    }
}

@Repository(EventPerfAppend)
class EventPerfAppendRepository extends BaseRepository<EventPerfAppend, number> {
    constructor(repo: DuckDbRepository) {
        super(repo);
    }
}

// Modify the test function to initialize the connection properly
async function test() {
    try {
        // Initialize the repository asynchronously
        duckDbRepository = await DuckDbRepository.getInstance({
            name: 'default',
            location: DuckDbLocation.Memory,
            filename: undefined
        });

        console.log("DuckDb repository initialized successfully");

        const subjectRepository = new SubjectRepository(duckDbRepository);
        await subjectRepository.init();

        // Save entities
        const subject1 = new Subject('JB', "Java Basic", "Java Basic", 2024);
        const subject2 = new Subject('OOP', "Java OOP", "Java Object Oriented Programming", 2024);

        // Save and log the returned entities with their IDs
        console.log("Saving subjects...");
        console.log("Subject 1:", subject1);
        const savedSubject1 = await subjectRepository.save(subject1);
        console.log("Saved subject 1 with ID:", savedSubject1.Id);
        console.log("Subject 2:", subject2);
        const savedSubject2 = await subjectRepository.save(subject2);
        console.log("Saved subject 2 with ID:", savedSubject2.Id);

        // Rest of your test...
        // Find all records
        console.log("Finding all subjects...");
        const result = await subjectRepository.findAll();
        console.table(result);

        // Find by Code using custom method
        console.log("Finding subject by code 'JB'...");
        const subjectFound = await subjectRepository.findByCode("JB");
        console.info(subjectFound);

        // Delete by Code using custom method
        console.log("Deleting subject by code 'JB'...");
        await subjectRepository.removeByCode("JB");

        // Find with criteria
        console.log("Finding subjects with criteria (Year = 2024)...");
        const subjects = await subjectRepository.findBy({ Year: 2024 }, ["Year"]);
        console.table(subjects);

        // Use pagination
        console.log("Finding subjects with pagination (page 0, size 1)...");
        const page = await subjectRepository.findWithPagination({ page: 0, size: 1 });
        console.log(`Found ${page.totalElements} subjects across ${page.totalPages} pages`);
        console.table(page.content);

        console.log("Finding subjects with pagination (page 1, size 1)...");
        const page1 = await subjectRepository.findWithPagination({ page: 1, size: 1 });
        console.log(`Found ${page.totalElements} subjects across ${page1.totalPages} pages`);
        console.table(page1.content);

        // Use query builder
        console.log("Using query builder to find subjects (Year = 2024, limit 5)...");
        const queryBuilder = await subjectRepository.createQueryBuilder();
        const customQuery = queryBuilder
            .select(['Id', 'Name'])
            .where('Year = 2024')
            .orderBy('Name', 'ASC')
            .limit(5)
            .getQuery();
        const customResults = await duckDbRepository.executeQuery(customQuery);
        console.table(customResults);

        // Use transactions
        console.log("Using transaction to save a new subject...");
        await subjectRepository.withTransaction(async (transaction: Transaction) => {
            const newSubject = new Subject('DB', 'Database', 'Database course', 2024);
            await subjectRepository.save(newSubject);

            // If any operation throws an error, the transaction will be rolled back
            if (newSubject.Code !== 'DB') {
                throw new Error('Something went wrong');
            }

            // If we get here, the transaction will be committed
        });

        // Example usage in test.ts or another file

        // Export a table to CSV
        console.log("Exporting subjects to CSV...");
        await subjectRepository.exportData({
            format: 'csv',
            fileName: 'subjects.csv',
            csvOptions: {
                header: true,
                delimiter: ','
            }
        });

        // Export query results to JSON
        console.log("Exporting subjects with Year = 2024 to JSON...");
        const query = `SELECT * FROM main.subjects WHERE Year = 2024`;
        await subjectRepository.exportQuery(query, {
            format: 'json',
            fileName: 'subjects-2024.json',
            jsonOptions: {
                pretty: true
            }
        });

        // Export all data to Parquet using DuckDbRepository directly
        console.log("Exporting all subjects to Parquet...");
        await duckDbRepository.exportTable('subjects', {
            format: 'parquet',
            fileName: 'subjects.parquet',
            parquetOptions: {
                compression: 'ZSTD'
            }
        });

        // ──────────────────────────────────────────────────────
        // Appender API tests
        // ──────────────────────────────────────────────────────

        // --- 1. High-level: appendEntities on EventRepository ---
        console.log("\n=== Appender API Tests ===\n");
        const eventRepo = new EventRepository(duckDbRepository);
        await eventRepo.init();

        const events: Event[] = [];
        for (let i = 1; i <= 1000; i++) {
            events.push(new Event(i, i % 2 === 0 ? 'click' : 'view', Math.random() * 100));
        }

        console.log("appendEntities: Inserting 1 000 events via appender...");
        const appendStart = performance.now();
        await eventRepo.appendEntities(events);
        const appendMs = (performance.now() - appendStart).toFixed(2);

        const allEvents = await eventRepo.findAll();
        console.log(`appendEntities: Inserted ${allEvents.length} events in ${appendMs} ms`);
        console.table(allEvents.slice(0, 5));

        // --- 2. Low-level: manual appender control ---
        console.log("\nLow-level appender: Creating table and inserting rows manually...");
        await duckDbRepository.executeQuery(`
            CREATE TABLE IF NOT EXISTS manual_events (
                Id INTEGER PRIMARY KEY,
                Type VARCHAR NOT NULL,
                Value DOUBLE
            )
        `);

        const appender = await duckDbRepository.createAppender('manual_events');

        appender.appendInteger(1);
        appender.appendVarchar('click');
        appender.appendDouble(42.5);
        appender.endRow();

        appender.appendInteger(2);
        appender.appendVarchar('view');
        appender.appendDouble(17.3);
        appender.endRow();

        appender.appendInteger(3);
        appender.appendVarchar('scroll');
        appender.appendDouble(99.9);
        appender.endRow();

        appender.flushSync();
        appender.closeSync();

        const manualRows = await duckDbRepository.executeQuery('SELECT * FROM manual_events');
        console.log(`Low-level appender: Inserted ${manualRows.length} rows`);
        console.table(manualRows);

        // --- 3. Compare saveAll vs appendEntities performance ---
        console.log("\nPerformance comparison: saveAll vs appendEntities (500 rows)...");

        const saveAllRepo = new EventPerfRepository(duckDbRepository);
        await saveAllRepo.init();

        const appendRepo = new EventPerfAppendRepository(duckDbRepository);
        await appendRepo.init();

        const perfEvents500Save = Array.from({ length: 500 }, (_, i) =>
            new EventPerf(i + 1, 'perf-save', i * 1.1)
        );
        const perfEvents500Append = Array.from({ length: 500 }, (_, i) =>
            new EventPerfAppend(i + 1, 'perf-append', i * 1.1)
        );

        const saveAllStart = performance.now();
        await saveAllRepo.saveAll(perfEvents500Save);
        const saveAllMs = (performance.now() - saveAllStart).toFixed(2);

        const appendAllStart = performance.now();
        await appendRepo.appendEntities(perfEvents500Append);
        const appendAllMs = (performance.now() - appendAllStart).toFixed(2);

        console.log(`saveAll:          ${saveAllMs} ms (500 rows)`);
        console.log(`appendEntities:   ${appendAllMs} ms (500 rows)`);
    } catch (error) {
        console.error("Error during test execution:", error);
    }
}

// Use an IIFE to allow top-level await
(async () => {
    try {
        await test();
    } catch (error) {
        console.error("Fatal error:", error);
    }
})();