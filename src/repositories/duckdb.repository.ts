/* eslint-disable @typescript-eslint/no-explicit-any */
import { Connection, Database } from 'duckdb';

import { mapToSQLFieldsValues } from '../helpers/mapping.helper';
import { generateCreateTableStatement, generateInsertIntoStatement } from '../helpers/table-util.helper';
import { bulkInsert, deleteTableData, dropTable, executeQuery, exportToCSV, exportToJSON, exportToParquet, saveQueryToParquet, saveToParquet } from '../helpers/db.helper';
import { Transaction } from './transaction';  // Add this import
import { ConnectionError } from '../errors/orm-errors';
import { AzureCredentialChainSecret, AzureProviderType, AzureSecret, S3Secret, Secret, SecretType } from './models.interface';

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

    public async dropSequence(sequenceName: string): Promise<void> {
        try {
            const query = `DROP SEQUENCE IF EXISTS ${sequenceName}`;
            await this.executeQuery(query);
            console.log(`Sequence ${sequenceName} dropped successfully`);
        } catch (err) {
            console.error(`ERROR DROPPING SEQUENCE: `, err);
            throw err;
        }
    }

    public async sequenceExists(sequenceName: string): Promise<boolean> {
        try {
            const query = `SELECT sequence_name FROM information_schema.sequences WHERE sequence_name = '${sequenceName}'`;
            const result = await this.executeQuery(query);
            return result && result.length > 0;
        } catch (err) {
            console.error(`ERROR CHECKING SEQUENCE: `, err);
            return false;
        }
    }

    // Method to create a secret in DuckDB
    public async createSecret(secret: Secret): Promise<void> {
        let query = '';

        switch (secret.type) {
            case SecretType.S3:
                query = this.buildS3SecretQuery(secret);
                break;
            case SecretType.AZURE:
                query = this.buildAzureSecretQuery(secret);
                break;
            default:
                throw new Error(`Secret type '${secret}' not supported`);
        }

        try {
            await this.executeQuery(query);
            console.log(`Secret '${secret.name}' created successfully`);
        } catch (error) {
            console.error(`Error creating secret '${secret.name}':`, error);
            throw error;
        }
    }

    // Method to drop a secret
    public async dropSecret(secretName: string): Promise<void> {
        const query = `DROP SECRET IF EXISTS ${secretName}`;

        try {
            await this.executeQuery(query);
            console.log(`Secret '${secretName}' dropped successfully`);
        } catch (error) {
            console.error(`Error dropping secret '${secretName}':`, error);
            throw error;
        }
    }

    // Method to replace (update) a secret
    public async replaceSecret(secret: Secret): Promise<void> {
        // Drop the existing secret first if it exists
        await this.dropSecret(secret.name);

        // Create the new secret
        await this.createSecret(secret);
    }

    // Method to list all secrets
    public async listSecrets(): Promise<any[]> {
        const query = `SELECT * FROM duckdb_secrets()`;
        return this.executeQuery(query);
    }

    // Helper method to build S3 secret query
    private buildS3SecretQuery(secret: S3Secret): string {
        let query = `CREATE SECRET ${secret.name} (\n    TYPE ${secret.type},\n    KEY_ID '${secret.keyId}',\n    SECRET '${secret.secret}'`;

        if (secret.region) {
            query += `,\n    REGION '${secret.region}'`;
        }

        if (secret.scope) {
            query += `,\n    SCOPE '${secret.scope}'`;
        }

        query += '\n)';

        return query;
    }

    // Helper method to build Azure secret query
    private buildAzureSecretQuery(secret: AzureSecret): string {
        let query = `CREATE SECRET ${secret.name} (\n    TYPE ${secret.type}`;

        // Handle different Azure provider types
        if ('connectionString' in secret) {
            query += `,\n    CONNECTION_STRING '${secret.connectionString}'`;
        } else if ('provider' in secret) {
            query += `,\n    PROVIDER ${secret.provider}`;

            if (secret.provider === AzureProviderType.CREDENTIAL_CHAIN) {
                query += `,\n    CHAIN '${(secret as AzureCredentialChainSecret).chain}'`;
            }

            query += `,\n    ACCOUNT_NAME '${secret.accountName}'`;
        }

        query += '\n)';

        return query;
    }

    // Method to check if a secret exists
    public async secretExists(secretName: string): Promise<boolean> {
        const query = `SELECT name FROM duckdb_secrets() WHERE name = '${secretName}'`;
        const result = await this.executeQuery(query);
        return result && result.length > 0;
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