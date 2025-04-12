/* eslint-disable @typescript-eslint/no-explicit-any */
import { Connection, Database } from 'duckdb';

import { mapToSQLFieldsValues } from '../helpers/mapping.helper';
import { generateCreateTableStatement, generateInsertIntoStatement } from '../helpers/table-util.helper';
import { bulkInsert, deleteTableData, dropTable, executeQuery, exportToCSV, exportToJSON, exportToParquet, saveQueryToParquet, saveToParquet } from '../helpers/db.helper';
import { Transaction } from './transaction';  // Add this import
import { ConnectionError } from '../errors/orm-errors';

export enum DuckDbLocation {
    File = "",
    Memory = ':memory:'
}

export interface DuckDbConfig {
    name: string;
    location: DuckDbLocation;
    filename?: string;
}

export class DuckDbRepository {
    private db?: Database = undefined;
    private connection?: Connection = undefined;
    // private statement: Statement;
    // private toDropTable: boolean = true;


    private tables: Map<string, boolean> = new Map();
    private isClosed = true;

    // private readonly tableName: string;
    // private readonly fileName: string;
    private static instance: DuckDbRepository | null = null;



    public static getInstances(duckdbConfig?: DuckDbConfig): DuckDbRepository {

   
        if (!duckdbConfig) {
            duckdbConfig = {
                name: 'default',
                location: DuckDbLocation.Memory,
                filename: undefined
            };
        }
        if (duckdbConfig?.location == DuckDbLocation.File && !duckdbConfig.filename) {
            throw new Error("Filepath for duckdb is missing");
        }

        const dbLocation = duckdbConfig.location == DuckDbLocation.File ? duckdbConfig.filename : DuckDbLocation.Memory.toString();
        console.log(dbLocation)
            
        if (!this.instance) {
            this.instance = new DuckDbRepository(dbLocation);

        }
        return this.instance;
    }

    protected constructor(location?: string) {
        if (!this.db) {
            this.db = new Database(location ?? ':memory:');
            this.connect();
        }
    }

    public connect(): void {
        if (this.isClosed) {
            this.connection = this.db?.connect();
            this.isClosed = false;
        }
    }

    // Fix the sequence creation logic

    public async createTableIfNotExists<T>(tableName: string, classType: new() => T): Promise<void> {
        try {
            // Get the actual table name from metadata if available
            const actualTableName = Reflect.getMetadata('TableName', classType) || tableName;

            // Extract auto-increment columns
            const instance = new classType();
            const propertyNames = Object.getOwnPropertyNames(instance);
            const sequences: Record<string, string> = {};

            for (const propertyName of propertyNames) {
                const autoIncrement = Reflect.getMetadata('AutoIncrement', classType.prototype, propertyName);
                const isPrimaryKey = Reflect.getMetadata('PrimaryKey', classType.prototype, propertyName);

                if (autoIncrement && isPrimaryKey) {
                // Create sequence name using the table name, not the class name
                    const sequenceName = `seq_${actualTableName}_${propertyName}`;
                    sequences[propertyName] = sequenceName;

                    // Create sequence first
                    const createSequenceStatement = `CREATE SEQUENCE IF NOT EXISTS ${sequenceName} START 1;`;
                    try {
                        await this.executeQuery(createSequenceStatement);
                        console.log(`Sequence ${sequenceName} is created successfully!`);
                    } catch (err) {
                        console.error(`ERROR CREATING SEQUENCE: `, err);
                        throw err;
                    }
                }
            }

            // Store sequences in metadata
            Reflect.defineMetadata('Sequences', sequences, classType);

            // Now create the table
            const createTableStatement = generateCreateTableStatement(actualTableName, classType);

            try {
                await this.executeQuery(createTableStatement);
                console.log(`Table ${actualTableName} is created successfully!`);
            } catch (err) {
                console.error(`ERROR CREATING: `, err);
                throw err;
            }
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    public async getDuckDbExtension(extension_name: string): Promise<any[]> {
        return this.executeQuery(`select extension_name, loaded, installed from duckdb_extensions() where extension_name='${extension_name}';`);
    }

    public async executeQuery(query: string) {
        return await executeQuery(this.connection, query);
    }

    public async pushToDuckDb<T>(tableName: string, classType: new() => T, data?: T[]) {
        await this.saveToDuckDB(tableName, classType, data);
    }

    public async saveToDuckDB<T>(tableName: string, classType: new() => T, data?: T[]) {
        if (!(data?.length)) return;

        // Get the actual table name from metadata if available
        const actualTableName = Reflect.getMetadata('TableName', classType) || tableName;

        await this.createTableIfNotExists<T>(actualTableName, classType);
        const query = data.map(item => mapToSQLFieldsValues(item, classType)).join(', ');

        // Log the SQL query for debugging
        const fullQuery = generateInsertIntoStatement(actualTableName, classType) + query;
        console.log("SQL Insert Query:", fullQuery);

        // Use actualTableName instead of tableName
        await bulkInsert(this.connection, fullQuery);
    }

    public async saveToParquet(name: string, mainFolder?: string) {
        const fileName = `${name}.parquet`;
        const tableName = `main.${name}`;
        await saveToParquet(this.connection, fileName, tableName, mainFolder);

    }

    public async saveToParquetByName(parquetFileName: string, duckDBTableName: string, mainFolder?: string) {
        const fileName = `${parquetFileName}.parquet`;
        await saveToParquet(this.connection, fileName, `main.${duckDBTableName}`, mainFolder);
    }


    public async dropTablesFromMemory() {
        const promiseDropTables:Promise<void>[] = [];
        this.tables.forEach((value, key) => {
            if (value)
                promiseDropTables.push(this.dropTable(key).then(() => {
                    console.log(`Dropped table main.${key} from DuckDb!`);
                }));
        });

        await Promise.all(promiseDropTables);
    }

    public async dropTable(tableName: string) {
        await dropTable(this.connection, 'main.' + tableName);
        if (this.tables.get(tableName)) {
            this.tables.delete(tableName);
        }
    }

    public async deleteTableData(tableName: string) {
        return await deleteTableData(this.connection, tableName);
    }

    public async saveQueryToParquet(name: string, query: string, folder: string) {
        const fileName = `${name}.parquet`;
        await saveQueryToParquet(this.connection, fileName, query, folder);
    }

    // Add this method to the DuckDbRepository class
    public createTransaction(): Transaction {
        if (!this.connection) {
            this.connect();
        }
        return new Transaction(this.connection!);
    }

    public async exportTable<T>(tableName: string, options: ExportOptions): Promise<void> {
        if (this.connection == undefined) {
            throw new ConnectionError("Connection is not established.");
        }
        const actualTableName = `main.${tableName}`;

        switch (options.format) {
            case 'csv':
                return await exportToCSV(
                    this.connection,
                    actualTableName,
                    options.fileName,
                    options.csvOptions
                );
            case 'json':
                return await exportToJSON(
                    this.connection,
                    actualTableName,
                    options.fileName,
                    options.jsonOptions
                );
            case 'parquet':
                return await exportToParquet(
                    this.connection,
                    actualTableName,
                    options.fileName,
                    options.parquetOptions
                );
            default:
                throw new Error(`Unsupported format: ${options.format}`);
        }
    }

    public async exportQuery(query: string, options: ExportOptions): Promise<void> {
        if (this.connection == undefined) {
            throw new ConnectionError("Connection is not established.");
        }
        switch (options.format) {
            case 'csv':
                return await exportToCSV(
                    this.connection,
                    query,
                    options.fileName,
                    options.csvOptions
                );
            case 'json':
                return await exportToJSON(
                    this.connection,
                    query,
                    options.fileName,
                    options.jsonOptions
                );
            case 'parquet':
                return await exportToParquet(
                    this.connection,
                    query,
                    options.fileName,
                    options.parquetOptions
                );
            default:
                throw new Error(`Unsupported format: ${options.format}`);
        }
    }

}
export interface ExportOptions {
    format: 'csv' | 'json' | 'parquet';
    fileName: string;
    // Format-specific options
    csvOptions?: {
        header?: boolean;
        delimiter?: string;
    };
    jsonOptions?: {
        pretty?: boolean;
    };
    parquetOptions?: {
        compression?: string;
    };
}