import 'reflect-metadata';
import { DuckDbRepository, ExportOptions } from './duckdb.repository';
import { getPrimaryId } from '../helpers/table-util.helper';
import { IRepository } from './base.interface';
import { QueryBuilder } from '../query/query-builder';
import { Transaction } from './transaction';
import { Page, Pageable } from '../pagination/pagination';
import { EntityNotFoundError, PrimaryKeyError, QueryExecutionError, TransactionError } from '../errors/orm-errors';
import { appendEntity } from '../helpers/appender.helper';

// Add 'extends object' constraint to T
export class BaseRepository<T extends object, Tid> implements IRepository<T, Tid> {
    protected classType: new() => T;
    protected tableName: string;
    private primaryColumnId = '';

    constructor(protected repository: DuckDbRepository) {
        // Retrieve the class type from the subclass's constructor using reflection
        this.classType = Reflect.getMetadata('entityType', this.constructor);

        if (!this.classType) {
            throw new Error('Class type is not defined!');
        }

        // Get the table name from metadata or use the class name
        this.tableName = Reflect.getMetadata('TableName', this.classType) || this.classType.name;
    }

    public async init(): Promise<void> {
        await this.initializeTable();
    }

    private async initializeTable() {
        try {
            await this.repository.createTableIfNotExists(this.classType.name, this.classType);
            console.log(`Table ${this.classType.name} is created successfully!`);
        } catch (err) {
            console.log(err);
        }
    }

    async removeById(id: Tid): Promise<T> {
       
        const deletedItem = await this.findById(id);
        
        const query = `DELETE FROM main.${this.tableName} WHERE ${this.primaryColumnId}='${id}'`;

        await this.repository.executeQuery(query);

        return deletedItem;
       
    }

    // Update the save method:

    async save(entity: T): Promise<T> {
        // Handle auto-increment fields
        const propertyNames = Object.getOwnPropertyNames(entity);
        const fields: string[] = [];
        const values: string[] = [];

        // Collect non-auto-increment fields and values
        for (const propertyName of propertyNames) {
            const autoIncrement = Reflect.getMetadata('AutoIncrement', this.classType.prototype, propertyName);
            const isPrimaryKey = Reflect.getMetadata('PrimaryKey', this.classType.prototype, propertyName);

            if (autoIncrement && isPrimaryKey) {
                continue; // Skip auto-increment primary key
            }

            const value = entity[propertyName as keyof T];
            fields.push(propertyName);

            if (value === undefined || value === null) {
                values.push('NULL');
            } else if (typeof value === 'string') {
                const escapedValue = (value as string).replace(/'/g, "''");
                values.push(`'${escapedValue}'`);
            } else if (typeof value === 'boolean') {
                values.push(value ? 'TRUE' : 'FALSE');
            } else {
                values.push(`${value}`);
            }
        }

        // Build and execute the INSERT statement
        const insertSQL = `INSERT INTO main.${this.tableName} (${fields.join(', ')}) VALUES (${values.join(', ')})`;
        console.log("Insert SQL:", insertSQL);

        try {
            await this.repository.executeQuery(insertSQL);

            // For auto-increment fields, fetch the last inserted ID
            for (const propertyName of propertyNames) {
                const autoIncrement = Reflect.getMetadata('AutoIncrement', this.classType.prototype, propertyName);
                const isPrimaryKey = Reflect.getMetadata('PrimaryKey', this.classType.prototype, propertyName);

                if (autoIncrement && isPrimaryKey) {
                    const query = `SELECT MAX(${propertyName}) as last_id FROM main.${this.tableName}`;
                    const result = await this.repository.executeQuery(query);

                    if (result && result.length > 0) {
                        entity[propertyName as keyof T] = result[0].last_id;
                    }
                }
            }

            return entity;
        } catch (error) {
            console.error("Error saving entity:", error);
            throw error;
        }
    }

    async saveAll(entities: T[]): Promise<T[]> {
        if (!entities.length) return [];
        await this.repository.saveToDuckDB(this.classType.name, this.classType, entities);
        return entities;
    }

    async insert(entity: T): Promise<T> {
        return this.save(entity);
    }

    async bulkInsert(entities: T[]): Promise<T[]> {
        return this.saveAll(entities);
    }

    async findAll(): Promise<T[]> {
        const query = `SELECT * FROM main.${this.tableName}`;
        return this.repository.executeQuery(query);
    }

    async findById(id: Tid): Promise<T> {
        // Get the property names from the class using reflection
        if (!this.primaryColumnId)
            this.primaryColumnId = getPrimaryId(this.classType);

        if (!this.primaryColumnId) {
            throw new PrimaryKeyError("The table doesn't have any primary key declared!");
        }

        const query = `SELECT * FROM main.${this.tableName} WHERE ${this.primaryColumnId}='${id}'`;
        try {
            const result = await this.repository.executeQuery(query);
            if (!result?.length) {
                throw new EntityNotFoundError(this.classType.name, id);
            }

            return result[0];
        } catch (error) {
            if (error instanceof EntityNotFoundError) {
                throw error;
            }
            throw new QueryExecutionError(query, error as Error);
        }
    }

    async existsById(id: Tid): Promise<boolean> {
        if (!this.primaryColumnId) {
            this.primaryColumnId = getPrimaryId(this.classType);
        }

        if (!this.primaryColumnId) {
            throw new Error("The table doesn't have any primary key declared!");
        }

        const query = `SELECT COUNT(*) as count FROM main.${this.tableName} WHERE ${this.primaryColumnId}='${id}'`;
        const result = await this.repository.executeQuery(query);
        return result[0].count > 0;
    }

    async findByIdOrThrow(id: Tid): Promise<T> {
        const entity = await this.findById(id);
        if (!entity) {
            throw new Error(`Entity with id ${id} not found`);
        }
        return entity;
    }

    async findWithPagination(pageable: Pageable): Promise<Page<T>> {
        const countQuery = `SELECT COUNT(*) as count FROM main.${this.tableName}`;
        const countResult = await this.repository.executeQuery(countQuery);

        // Convert BigInt to Number before using in Math.ceil
        const totalElements = Number(countResult[0].count);

        const query = `SELECT * FROM main.${this.tableName} LIMIT ${pageable.size} OFFSET ${pageable.page * pageable.size}`;
        const content = await this.repository.executeQuery(query);

        return {
            content,
            pageable: {
                page: pageable.page,
                size: pageable.size
            },
            totalElements,
            totalPages: Math.ceil(totalElements / pageable.size)
        };
    }

    async findBy(entity: Partial<T>, columns: string[]): Promise<T[]> {
        let query = `SELECT * FROM main.${this.tableName} WHERE `;
        for (const column of columns) {
            query += `${column}='${(entity as any)[column]}' AND `;
        }
        query = query.slice(0, query.length - 5);
        const result = await this.repository.executeQuery(query);
        return result;
    }

    async removeAll(): Promise<void> {
        // First delete all data from the table
        const query = `DELETE FROM main.${this.tableName}`;
        await this.repository.executeQuery(query);

        // Then check for and drop any associated sequences
        await this.dropAssociatedSequences();
    }

    // Add new helper method to drop associated sequences
    private async dropAssociatedSequences(): Promise<void> {
        // Retrieve sequences from metadata
        const sequences = Reflect.getMetadata('Sequences', this.classType) || {};

        // Drop each sequence if it exists
        for (const [propertyName, sequenceName] of Object.entries(sequences)) {
            try {
                // Check if the sequence exists before trying to drop it
                const checkSequenceQuery = `SELECT sequence_name FROM information_schema.sequences WHERE sequence_name = '${sequenceName}'`;
                const sequenceExists = await this.repository.executeQuery(checkSequenceQuery);

                if (sequenceExists && sequenceExists.length > 0) {
                    const dropSequenceQuery = `DROP SEQUENCE IF EXISTS ${sequenceName}`;
                    await this.repository.executeQuery(dropSequenceQuery);
                    console.log(`Dropped sequence ${sequenceName} for table ${this.tableName}`);
                }

                // Optionally recreate the sequence if needed
                // This is useful if you want to reset the counter to start from initial value
                const autoIncrement = Reflect.getMetadata('AutoIncrement', this.classType.prototype, propertyName);
                const isPrimaryKey = Reflect.getMetadata('PrimaryKey', this.classType.prototype, propertyName);

                if (autoIncrement && isPrimaryKey) {
                    const createSequenceStatement = `CREATE SEQUENCE IF NOT EXISTS ${sequenceName} START 1`;
                    await this.repository.executeQuery(createSequenceStatement);
                    console.log(`Recreated sequence ${sequenceName} for table ${this.tableName}`);
                }
            } catch (error) {
                console.error(`Error managing sequence ${sequenceName}:`, error);
                // Optionally throw or continue based on your error handling strategy
            }
        }
    }

    async createQueryBuilder(): Promise<QueryBuilder<T>> {
        return new QueryBuilder<T>(this.classType);
    }

    // Support for transactions
    async withTransaction<R>(callback: (transaction: Transaction) => Promise<R>): Promise<R> {
        const transaction = this.repository.createTransaction();
        try {
            await transaction.begin();
            const result = await callback(transaction);
            await transaction.commit();
            return result;
        } catch (error) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                throw new TransactionError('rollback', rollbackError as Error);
            }
            throw new TransactionError('execution', error as Error);
        }
    }

    toEntity(data: Record<string, any>): T {
        const entity = new this.classType();
        Object.assign(entity, data);
        return entity;
    }

    // Add this method to your BaseRepository class

    async exportData(options: ExportOptions): Promise<void> {
        return this.repository.exportTable(this.tableName, options);
    }

    async exportQuery(query: string, options: ExportOptions): Promise<void> {
        return this.repository.exportQuery(query, options);
    }

    /**
     * Efficiently inserts a large batch of entities using the DuckDB Appender API.
     * This is significantly faster than `saveAll` for large datasets as it bypasses
     * SQL statement parsing and uses DuckDB's native binary ingestion path.
     */
    async appendEntities(entities: T[]): Promise<void> {
        if (!entities.length) return;
        const appender = await this.repository.createAppender(this.tableName);
        // Compute property names once to avoid repeated prototype instantiation per row.
        const propertyNames = Object.getOwnPropertyNames(new this.classType());
        try {
            for (const entity of entities) {
                appendEntity(appender, entity, this.classType, propertyNames);
            }
            appender.flushSync();
        } finally {
            appender.closeSync();
        }
    }
}
