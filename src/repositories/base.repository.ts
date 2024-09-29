import 'reflect-metadata';
import { DuckDbRepository } from './duckdb.repository';
import { getPrimaryId } from '../helpers/table-util.helper';
import { IRepository } from './base.interface';


export class BaseRepository<T, Tid> implements IRepository<T,Tid> {
    protected classType: new() => T;
    private primaryColumnId = '';

    constructor(protected repository: DuckDbRepository) {
        // Retrieve the class type from the subclass's constructor using reflection
        this.classType = Reflect.getMetadata('entityType', this.constructor);

        if (!this.classType) {
            throw new Error('Class type is not defined!');
        }
    }

    async save(entity: T): Promise<T> {
        console.log('Saving entity:', entity);
        console.log('Class type:', this.classType.name);

        // Create the table if it doesn't exist
        await this.repository.createTableIfNotExists(this.classType.name, this.classType);

        // Save the entity to DuckDB 
        await this.repository.saveToDuckDB(this.classType.name, this.classType, [entity]);

        return entity;
    }

    async findAll(): Promise<T[]> {
        const query = `SELECT * FROM main.${this.classType.name}`;
        const result = await this.repository.executeQuery(query);
        return result
    }

    async findById(id: Tid): Promise<T> {
        // Get the property names from the class using reflection
        if (!this.primaryColumnId)
            this.primaryColumnId = getPrimaryId(this.classType);
        const query = `SELECT * FROM main.${this.classType.name} WHERE ${this.primaryColumnId}='${id}'`;
        const result = await this.repository.executeQuery(query)
        return result?.length ? result[0] : undefined;
    }

    async findBy(entity: T, columns: string[]): Promise<T[]> {
        let query = `SELECT * FROM main.${this.classType.name} WHERE `;
        for (const column of columns) {
            query += `${column}='${(entity as any)[column]}' AND `;
        }
        query = query.slice(0, query.length - 5);
        const result = await this.repository.executeQuery(query);
        return result;
    }
}
