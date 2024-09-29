# DuckDB Tiny ORM

Usage:

```typescript

import 'reflect-metadata';
import { DuckDbRepository, Entity, Repository, DataTypeDecorator, BaseRepository, Id } from 'duckdb-tinyorm';

@Entity
export class Subject {

    @Id()
    @DataTypeDecorator('VARCHAR')
    Id?: string = null;

    @DataTypeDecorator('VARCHAR')
    Name?: string = null;


    @DataTypeDecorator('VARCHAR')
    Description?: string = null;


    @DataTypeDecorator('INT')
    Year?: number = null;

}

@Repository(Subject)
class SubjectRepository extends BaseRepository<Subject, string> {
    constructor() {
        super(DuckDbRepository.getInstances());
    }
}


async function test() {
    const subjectRepository = new SubjectRepository();

    const subject1 = new Subject();
    subject1.Name = "Java Basic";
    subject1.Description = "Java Basic";
    subject1.Year = 2024;
    subject1.Id = "JB"


    const subject2 = new Subject();
    subject2.Name = "Java OOP";
    subject2.Description = "Java Object Oriented Programming";
    subject2.Year = 2024;
    subject2.Id = "OOP"


    await subjectRepository.save(subject1);
    await subjectRepository.save(subject2);
    const result = await subjectRepository.findAll();
    console.table(result);
    const subjectFound1:Subject = await subjectRepository.findById("JB");
    console.info(subjectFound1);
    const subjectFound2: Subject = await subjectRepository.findById("OOP");
    console.info(subjectFound2);

    const amenities = await subjectRepository.findBy({Year: 2024}, ["Year"]);
    console.table(amenities);
}

test();
```
