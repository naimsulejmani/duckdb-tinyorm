import 'reflect-metadata';
import { BaseRepository, Column, DuckDbRepository, Entity, Migration, Repository } from '../src/index';

/**
 * Shared entities/repositories used by the DuckDB compatibility smoke tests.
 * Each test file runs in its own process (node --test), so the DuckDbRepository
 * singleton can be exercised in both in-memory and file-based modes.
 */

@Entity({ name: 'subjects' })
export class Subject {
    @Column({ type: 'INTEGER', primaryKey: true, autoIncrement: true })
    Id!: number;

    @Column({ type: 'VARCHAR', notNull: true, unique: true })
    Code!: string;

    @Column({ type: 'VARCHAR', notNull: true })
    Name!: string;

    @Column({ type: 'TEXT' })
    Description?: string;

    @Column({ type: 'INT', defaultValue: 2024, check: 'Year >= 2000' })
    Year!: number;

    constructor(code = '', name = '', description?: string, year = 2024) {
        this.Code = code;
        this.Name = name;
        this.Description = description;
        this.Year = year;
    }
}

@Repository(Subject)
export class SubjectRepository extends BaseRepository<Subject, number> {
    constructor(repo: DuckDbRepository) {
        super(repo);
    }
}

@Entity({ name: 'measurements' })
export class Measurement {
    @Column({ type: 'INTEGER', primaryKey: true })
    id!: number;

    @Column({ type: 'VARCHAR' })
    label?: string | null;

    @Column({ type: 'DOUBLE' })
    value?: number | null;

    @Column({ type: 'FLOAT' })
    ratio?: number | null;

    @Column({ type: 'DECIMAL(10,2)' })
    price?: number | null;

    @Column({ type: 'BIGINT' })
    big?: bigint | number | null;

    @Column({ type: 'UTINYINT' })
    small?: number | null;

    @Column({ type: 'UINTEGER' })
    unsigned?: number | null;

    @Column({ type: 'UHUGEINT' })
    huge?: bigint | null;

    @Column({ type: 'BOOLEAN' })
    active?: boolean | null;

    @Column({ type: 'TIMESTAMP' })
    createdAt?: Date | null;

    @Column({ type: 'DATE' })
    day?: Date | null;

    constructor(init?: Partial<Measurement>) {
        this.id = 0;
        this.label = null;
        this.value = null;
        this.ratio = null;
        this.price = null;
        this.big = null;
        this.small = null;
        this.unsigned = null;
        this.huge = null;
        this.active = null;
        this.createdAt = null;
        this.day = null;
        Object.assign(this, init);
    }
}

@Repository(Measurement)
export class MeasurementRepository extends BaseRepository<Measurement, number> {
    constructor(repo: DuckDbRepository) {
        super(repo);
    }
}

export class CreateProductsMigration extends Migration {
    version = '001';
    up(): string {
        return 'CREATE TABLE products (id INTEGER PRIMARY KEY, name VARCHAR)';
    }
    down(): string {
        return 'DROP TABLE products';
    }
}

export class AddPriceMigration extends Migration {
    version = '002';
    up(): string {
        return 'ALTER TABLE products ADD COLUMN price DOUBLE';
    }
    down(): string {
        return 'ALTER TABLE products DROP COLUMN price';
    }
}

export class BrokenMigration extends Migration {
    version = '003';
    up(): string {
        return 'ALTER TABLE does_not_exist ADD COLUMN x INTEGER';
    }
    down(): string {
        return 'SELECT 1';
    }
}
