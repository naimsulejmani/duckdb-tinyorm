# DuckDB Tiny ORM

Usage:

```typescript
import 'reflect-metadata';
import { DuckDbRepository, Entity, Repository, DataTypeDecorator, BaseRepository, Id ,DuckDbLocation, DuckDbConfig } from 'duckdb-tinyorm';



//create instance in memory or use File, if File is specfied need to specify the filename
const duckDbRepository: DuckDbRepository = DuckDbRepository.getInstances({name: 'default', location: DuckDbLocation.Memory, filename: undefined})

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
    Id: string ;

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

    const subject1 = new Subject('JB', "Java Basic", "Java Basic", 2024);
    const subject2 = new Subject('OOP', "Java OOP", "Java Object Oriented Programming", 2024);


    //save records (as for now just insert a new record)
    await subjectRepository.save(subject1);
    await subjectRepository.save(subject2);

    //find all records
    const result = await subjectRepository.findAll();
    console.table(result);

    //find records by primary key
    const subjectFound1: Subject = await subjectRepository.findById("JB");
    console.info(subjectFound1);
    const subjectFound2: Subject = await subjectRepository.findById("OOP");
    console.info(subjectFound2);

    //delete one record by primary key

    await subjectRepository.removeById("JB");

    const amenities = await subjectRepository.findBy({ Year: 2024 }, ["Year"]);
    console.table(amenities);
}

test();
```
