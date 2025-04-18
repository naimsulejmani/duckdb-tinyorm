import { BaseRepository, Column, DuckDbLocation, DuckDbRepository, Entity, Repository, Transaction } from 'duckdb-tinyorm';
import 'reflect-metadata';
// Create instance in memory or use File
const duckDbRepository: DuckDbRepository = DuckDbRepository.getInstances({
    name: 'default',
    location: DuckDbLocation.Memory,
    filename: undefined
});

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
    constructor() {
        super(duckDbRepository);
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

// Modify the test function to log IDs

async function test() {
    const subjectRepository = new SubjectRepository();
    await subjectRepository.init();

    // Save entities
    const subject1 = new Subject('JB', "Java Basic", "Java Basic", 2024);
    const subject2 = new Subject('OOP', "Java OOP", "Java Object Oriented Programming", 2024);

    // Save and log the returned entities with their IDs
    const savedSubject1 = await subjectRepository.save(subject1);
    console.log("Saved subject 1 with ID:", savedSubject1.Id);

    const savedSubject2 = await subjectRepository.save(subject2);
    console.log("Saved subject 2 with ID:", savedSubject2.Id);

    // Rest of your test...
    // Find all records
    const result = await subjectRepository.findAll();
    console.table(result);

    // Find by Code using custom method
    const subjectFound = await subjectRepository.findByCode("JB");
    console.info(subjectFound);

    // Delete by Code using custom method
    await subjectRepository.removeByCode("JB");

    // Find with criteria
    const subjects = await subjectRepository.findBy({ Year: 2024 }, ["Year"]);
    console.table(subjects);

    // Use pagination
    const page = await subjectRepository.findWithPagination({ page: 0, size: 10 });
    console.log(`Found ${page.totalElements} subjects across ${page.totalPages} pages`);

    // Use query builder
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
    await subjectRepository.exportData({
        format: 'csv',
        fileName: 'subjects.csv',
        csvOptions: {
            header: true,
            delimiter: ','
        }
    });

    // Export query results to JSON
    const query = `SELECT * FROM main.subjects WHERE Year = 2024`;
    await subjectRepository.exportQuery(query, {
        format: 'json',
        fileName: 'subjects-2024.json',
        jsonOptions: {
            pretty: true
        }
    });

    // Export all data to Parquet using DuckDbRepository directly
    await duckDbRepository.exportTable('subjects', {
        format: 'parquet',
        fileName: 'subjects.parquet',
        parquetOptions: {
            compression: 'ZSTD'
        }
    });
}