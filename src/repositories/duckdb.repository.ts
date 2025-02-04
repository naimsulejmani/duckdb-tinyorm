/* eslint-disable @typescript-eslint/no-explicit-any */
import { Connection, Database } from 'duckdb';

import { mapToSQLFieldsValues } from '../helpers/mapping.helper';
import { generateCreateTableStatement, generateInsertIntoStatement } from '../helpers/table-util.helper';
import { bulkInsert, deleteTableData, dropTable, executeQuery, saveQueryToParquet, saveToParquet } from '../helpers/db.helper';

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

    public async createTableIfNotExists<T>(tableName: string, classType: new() => T): Promise<void> {

        if(this.tables.get(tableName)) return;
        return new Promise((resolve, reject) => {
            this.connection?.run(generateCreateTableStatement(tableName, classType), err => {
                if (err) {
                    console.log('ERROR CREATING: ', err);
                    reject(err);
                } else {
                    // console.info('DuckDB table main.' + tableName + ' was created or already exists!');
                    this.tables.set(tableName, true);
                    resolve();
                }
            });
        });
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
        await this.createTableIfNotExists<T>(tableName, classType);
        const query = data.map(item => mapToSQLFieldsValues(item, classType)).join(', ');
        await bulkInsert(this.connection, generateInsertIntoStatement(tableName, classType) + query);

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

}
