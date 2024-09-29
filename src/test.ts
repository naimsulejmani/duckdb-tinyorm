import { DataTypeDecorator, Entity, Id, Repository } from "./constants/data-type.decorator";
import { BaseRepository } from "./repositories/base.repository";
import { DuckDbRepository } from "./repositories/duckdb.repository";

@Entity
export class Amenity {

    @DataTypeDecorator('VARCHAR(255)')
    Name?: string = null;

    @Id()
    @DataTypeDecorator('VARCHAR(255)')
    Type?: string = null;

    @DataTypeDecorator('VARCHAR(255)')
    PropertyId?: string = null;
}




// @Entity  // Use the Entity decorator to register metadata
@Repository(Amenity)
class AmenityRepository extends BaseRepository<Amenity, string> {
    constructor() {
        super(DuckDbRepository.getInstances());
    }
}





async function test() {
    const amenityRepository = new AmenityRepository();

    const amenity = new Amenity();
    amenity.Name = "Naim";
    amenity.PropertyId = "1";
    amenity.Type = "Type1";

    const amenity1= new Amenity();
    amenity1.Name = "Naim";
    amenity1.PropertyId = "2";
    amenity1.Type = "Type2";



    // Save the entity dynamically using metadata
    await amenityRepository.save(amenity);
    await amenityRepository.save(amenity1);
    const result = await amenityRepository.findAll();
    console.table(result);
    const amenityFound:Amenity = await amenityRepository.findById("Type1");
    console.info(amenityFound);
    const amenityFound1: Amenity = await amenityRepository.findById("Type1");
    console.info(amenityFound1);

    const amenities = await amenityRepository.findBy(amenity, ["Type", "Name"]);
    console.table(amenities);
}

test();