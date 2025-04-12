# DuckDB Tiny ORM

## Basic Usage:

```typescript
import 'reflect-metadata';
import { DuckDbRepository, Entity, Repository, DataTypeDecorator, BaseRepository, Id, DuckDbLocation, DuckDbConfig } from 'duckdb-tinyorm';

// Create instance in memory or use File
const duckDbRepository: DuckDbRepository = DuckDbRepository.getInstances({
  name: 'default', 
  location: DuckDbLocation.Memory, 
  filename: undefined
});

@Entity
export class Subject {
    constructor(id: string = "", name?: string, description?: string, year: number = (new Date()).getFullYear()) {
        this.Id = id;
        this.Name = name;
        this.Description = description;
        this.Year = year;
    }

    @Id()
    @DataTypeDecorator('VARCHAR')
    Id: string;

    @DataTypeDecorator('VARCHAR')
    Name?: string;

    @DataTypeDecorator('VARCHAR')
    Description?: string;

    @DataTypeDecorator('INT')
    Year: number;
}

@Repository(Subject)
class SubjectRepository extends BaseRepository<Subject, string> {
    constructor() {
        super(duckDbRepository);
    }
}

async function test() {
    const subjectRepository = new SubjectRepository();
    await subjectRepository.init();

    // Save entities
    const subject1 = new Subject('JB', "Java Basic", "Java Basic", 2024);
    const subject2 = new Subject('OOP', "Java OOP", "Java Object Oriented Programming", 2024);
    await subjectRepository.save(subject1);
    await subjectRepository.save(subject2);

    // Find all records
    const result = await subjectRepository.findAll();
    console.table(result);

    // Find by ID
    const subjectFound = await subjectRepository.findById("JB");
    console.info(subjectFound);

    // Delete by ID
    await subjectRepository.removeById("JB");

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
    await subjectRepository.withTransaction(async (transaction) => {
        const newSubject = new Subject('DB', 'Database', 'Database course', 2024);
        await subjectRepository.save(newSubject);
        
        // If any operation throws an error, the transaction will be rolled back
        if (newSubject.Id !== 'DB') {
            throw new Error('Something went wrong');
        }
        
        // If we get here, the transaction will be committed
    });
}

test();
