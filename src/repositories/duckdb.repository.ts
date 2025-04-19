/* eslint-disable @typescript-eslint/no-explicit-any */
import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

import { mapToSQLFieldsValues } from '../helpers/mapping.helper';
import { generateCreateTableStatement, generateInsertIntoStatement } from '../helpers/table-util.helper';
import { bulkInsert, deleteTableData, dropTable, executeQuery, exportToCSV, exportToJSON, exportToParquet, saveQueryToParquet, saveToParquet } from '../helpers/db.helper';
import { Transaction } from './transaction';
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
    options?: Record<string, string>;
}

export class DuckDbRepository {
    private instance?: DuckDBInstance = undefined;
    private connection?: DuckDBConnection = undefined;

    private tables: Map<string, boolean> = new Map();
    private isClosed = true;
    private connectionPromise: Promise<void> | null = null;
    private initialized: Promise<void> | null = null;

    private static instance: DuckDbRepository | null = null;

    public static async getInstance(duckdbConfig?: DuckDbConfig): Promise<DuckDbRepository> {
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
        console.log(dbLocation);

        if (!this.instance) {
            this.instance = new DuckDbRepository(dbLocation, duckdbConfig.options);
            // Wait for initialization to complete
            await this.instance.initialized;
        }
        return this.instance;
    }

    // Legacy method to maintain backward compatibility
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
        console.log(dbLocation);
            
        if (!this.instance) {
            this.instance = new DuckDbRepository(dbLocation, duckdbConfig.options);
        }
        return this.instance;
    }

    protected constructor(location?: string, options?: Record<string, string>) {
        // Initialize with the provided location or default to ':memory:'
        this.initialized = this.initSync(location ?? ':memory:', options).catch(error => {
            console.error('Error initializing DuckDB instance:', error);
            throw error;
        });
    }

    private async initSync(location: string, options?: Record<string, string>): Promise<void> {
        try {
            // Create instance using the static create method as per DuckDB API
            this.instance = await DuckDBInstance.create(location);
            console.log(`DuckDB instance created at ${location}`);

            // If we have options and the instance is created successfully, set them
            if (options && this.instance) {
                // Set options on the instance if needed
            }

            // Connect immediately after creating the instance
            if (this.instance) {
                this.connection = await this.instance.connect();
                this.isClosed = false;
                console.log('DuckDB connection established successfully');
            }
        } catch (error) {
            console.error('Error initializing DuckDB repository:', error);
            throw error;
        }
    }

    public async connect(): Promise<void> {
        // If we're already connecting, return the existing promise
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        // If we're already connected, return immediately
        if (!this.isClosed && this.connection) {
            return Promise.resolve();
        }

        // Start a new connection process
        this.connectionPromise = new Promise<void>((resolve, reject) => {
            if (this.isClosed && this.instance) {
                this.instance.connect()
                    .then(connection => {
                        this.connection = connection;
                        this.isClosed = false;
                        resolve();
                    })
                    .catch(error => {
                        console.error('Error connecting to DuckDB:', error);
                        reject(error);
                    })
                    .finally(() => {
                        this.connectionPromise = null;
                    });
            } else {
                resolve();
            }
        });

        return this.connectionPromise;
    }

    private async ensureConnected(): Promise<void> {
        if (!this.connection || this.isClosed) {
            await this.connect();
        }
    }

    public async createTableIfNotExists<T>(tableName: string, classType: new() => T): Promise<void> {
        await this.ensureConnected();
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
        await this.ensureConnected();
        return this.executeQuery(`select extension_name, loaded, installed from duckdb_extensions() where extension_name='${extension_name}';`);
    }

    public async executeQuery(query: string): Promise<any[]> {
        await this.ensureConnected();
        return executeQuery(this.connection!, query);
    }

    public async pushToDuckDb<T>(tableName: string, classType: new() => T, data?: T[]) {
        await this.saveToDuckDB(tableName, classType, data);
    }

    public async saveToDuckDB<T>(tableName: string, classType: new() => T, data?: T[]) {
        await this.ensureConnected();
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
        await this.ensureConnected();
        const fileName = `${name}.parquet`;
        const tableName = `main.${name}`;
        await saveToParquet(this.connection, fileName, tableName, mainFolder);
    }

    public async saveToParquetByName(parquetFileName: string, duckDBTableName: string, mainFolder?: string) {
        await this.ensureConnected();
        const fileName = `${parquetFileName}.parquet`;
        await saveToParquet(this.connection, fileName, `main.${duckDBTableName}`, mainFolder);
    }

    public async dropTablesFromMemory() {
        await this.ensureConnected();
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
        await this.ensureConnected();
        await dropTable(this.connection, 'main.' + tableName);
        if (this.tables.get(tableName)) {
            this.tables.delete(tableName);
        }
    }

    public async deleteTableData(tableName: string) {
        await this.ensureConnected();
        return await deleteTableData(this.connection, tableName);
    }

    public async saveQueryToParquet(name: string, query: string, folder: string) {
        await this.ensureConnected();
        const fileName = `${name}.parquet`;
        await saveQueryToParquet(this.connection, fileName, query, folder);
    }

    // Add this method to the DuckDbRepository class
    public createTransaction(): Transaction {
        if (!this.connection) {
            throw new ConnectionError("Cannot create transaction: Connection is not established.");
        }
        return new Transaction(this.connection);
    }

    public async exportTable<T>(tableName: string, options: ExportOptions): Promise<void> {
        await this.ensureConnected();
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
        await this.ensureConnected();
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
        await this.ensureConnected();
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
        await this.ensureConnected();
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
        await this.ensureConnected();
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
        await this.ensureConnected();
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
        await this.ensureConnected();
        // Drop the existing secret first if it exists
        await this.dropSecret(secret.name);

        // Create the new secret
        await this.createSecret(secret);
    }

    // Method to list all secrets
    public async listSecrets(): Promise<any[]> {
        await this.ensureConnected();
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
        await this.ensureConnected();
        const query = `SELECT name FROM duckdb_secrets() WHERE name = '${secretName}'`;
        const result = await this.executeQuery(query);
        return result && result.length > 0;
    }

    // Close connection explicitly
    public async close(): Promise<void> {
        if (this.connection && !this.isClosed) {
            this.connection.disconnectSync();
            this.isClosed = true;
            this.connection = undefined;
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