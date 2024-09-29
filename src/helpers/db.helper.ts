/* eslint-disable @typescript-eslint/no-explicit-any */
// import * as fs from 'fs/promises';
import { Connection, TableData } from 'duckdb';

export async function executeDuckDbQuery(connection?: Connection, query?: string) {
    return new Promise<void>((resolve, reject) => {
        connection?.run(query ?? "", (err, response) => {
            if (err) {
                return reject(err);
            }
            return resolve(response);
        });
    });
}

export async function bulkInsert(connection?: Connection, query?: string) {

    try {
        await executeDuckDbQuery(connection, query);
    } catch (err) {
        console.error('Error bulk inserting!', err);
    }
}

export async function dropTable(connection?: Connection, tableName?: string) {
    const query = `DROP TABLE IF EXISTS ${tableName}`;
    try {
        await executeDuckDbQuery(connection, query);
    } catch (err) {
        console.error(`Error dropping table "${tableName}":`, err);
    }
}

export async function saveToParquet(connection?: Connection, fileName?: string, tableName?: string, folder?: string,) {

    return new Promise<void>((resolve, reject) => {
        connection?.run(`COPY ${tableName} TO '${fileName}' (FORMAT PARQUET, COMPRESSION ZSTD)`, async function (err) {
            if (err) {
                console.log('dump failed', err);
                reject(err);
            } else {
                console.log(`Dumped table ${tableName} into ${fileName}`);
                try {
                    // await fs.unlink(fileName);
                    resolve();
                } catch (err) {
                    console.log('Error uploading Parquet file to Azure Blob Storage:', err);
                    return Promise.reject(err as Error);
                }
            }
        });
    });
}

export async function deleteTableData(connection?: Connection, fileName?: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        connection?.all(`DROP TABLE ${fileName}`, (err, table: TableData) => {
            if (err) {
                return Promise.reject(err as Error);
            }
            else {
                return resolve(table);
            }
        });
    });
}

export async function executeQuery(connection?: Connection, query?: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        connection?.all(query ?? "", (err:any, table: TableData) => {
            if (err) {
                return Promise.reject(err as Error);
            }
            else {
                return resolve(table);
            }
        });
    });
}

export async function saveQueryToParquet(connection?: Connection, fileName?: string, query?: string, folder?: string) {
    
    return new Promise<void>((resolve, reject) => {
        connection?.run(`COPY (${query}) TO '${fileName}' (FORMAT PARQUET, COMPRESSION ZSTD)`, async function (err) {
            if (err) {
                console.log('dump failed', err);
                reject(err);
            } else {
                try {
                    // await fs.unlink(fileName);
                    resolve();
                } catch (err) {
                    console.log('Error uploading Parquet file to Azure Blob Storage:', err);
                    return Promise.reject(err as Error);
                }
            }
        });
    });
}