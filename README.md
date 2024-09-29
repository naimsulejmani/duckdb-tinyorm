# DuckDB Tiny ORM

Usage:
```typescript

import { DuckDbRepository, Entity, Repository, DataTypeDecorator, BaseRepository, Id } from 'duckdb-tinyorm';

import 'reflect-metadata';

@Entity
export class Amenity {

    @DataTypeDecorator('VARCHAR')
    Name?: string = null;

    @Id()
    @DataTypeDecorator('VARCHAR')
    Type?: string = null;

    @DataTypeDecorator('VARCHAR')
    PropertyId?: string = null;

    @DataTypeDecorator('VARCHAR')
    Color?: string = null;

    @DataTypeDecorator('INT')
    Year?: number = null;

}

@Repository(Amenity)
class AmenityRepository extends BaseRepository<Amenity, string> {
    constructor() {
        super(DuckDbRepository.getInstances());
    }
}


async function test() {
    const amenityRepository = new AmenityRepository();

    const amenity = new Amenity();
    amenity.Name = "Name1";
    amenity.PropertyId = "1";
    amenity.Type = "Type1";
    amenity.Color = "Green";
    amenity.Year = 2022;


    const amenity1= new Amenity();
    amenity1.Name = "Name2";
    amenity1.PropertyId = "2";
    amenity1.Type = "Type2";
    amenity.Color = "Green";
    amenity.Year = 2022;

    await amenityRepository.save(amenity);
    await amenityRepository.save(amenity1);
    const result = await amenityRepository.findAll();
    console.table(result);
    const amenityFound:Amenity = await amenityRepository.findById("Type1");
    console.info(amenityFound);
    const amenityFound1: Amenity = await amenityRepository.findById("Type1");
    console.info(amenityFound1);

    const amenities = await amenityRepository.findBy(amenity, ["Color"]);
    console.table(amenities);
}

test();
```
