/* eslint-disable @typescript-eslint/no-explicit-any */
import { DuckDBConnection } from '@duckdb/node-api';

export async function executeDuckDbQuery(connection?: DuckDBConnection, query?: string): Promise<void> {
    if (!connection || !query) {
        throw new Error("Connection or query is missing");
    }
    await connection.run(query);
}

export async function bulkInsert(connection?: DuckDBConnection, query?: string): Promise<void> {
    if (!connection) {
        throw new Error("Connection is not established. Make sure you've connected to DuckDB before inserting data.");
    }

    if (!query || query.trim() === '') {
        throw new Error("Query is empty or undefined");
    }

    // Add logging to see the exact query being executed
    console.log("Executing bulk insert query:", query);

    try {
        await connection.run(query);
    } catch (err) {
        console.error("Error bulk inserting!", err);
        throw err;
    }
}

export async function dropTable(connection?: DuckDBConnection, tableName?: string): Promise<void> {
    if (!connection || !tableName) {
        throw new Error("Connection or table name is missing");
    }
    const query = `DROP TABLE IF EXISTS ${tableName}`;
    try {
        await connection.run(query);
    } catch (err) {
        console.error(`Error dropping table "${tableName}":`, err);
        throw err;
    }
}

export async function saveToParquet(connection?: DuckDBConnection, fileName?: string, tableName?: string, folder?: string): Promise<void> {
    if (!connection || !fileName || !tableName) {
        throw new Error("Connection, file name, or table name is missing");
    }

    const folderPath = folder ? `${folder}/${fileName}` : fileName;
    const query = `COPY ${tableName} TO '${folderPath}' (FORMAT PARQUET, COMPRESSION ZSTD)`;

    try {
        await connection.run(query);
        console.log(`Dumped table ${tableName} into ${folderPath}`);
    } catch (err) {
        console.error(`Error saving to Parquet:`, err);
        throw err;
    }
}

export async function deleteTableData(connection?: DuckDBConnection, tableName?: string): Promise<any[]> {
    if (!connection || !tableName) {
        throw new Error("Connection or table name is missing");
    }

    const query = `DELETE FROM ${tableName}`;
    try {
        const reader = await connection.runAndReadAll(query);
        return reader.getRowObjects();
    } catch (err) {
        console.error(`Error deleting table data from "${tableName}":`, err);
        throw err;
    }
}

export async function executeQuery(connection?: DuckDBConnection, query?: string): Promise<any[]> {
    if (!connection) {
        throw new Error("Connection is not established. Make sure you've connected to DuckDB before executing queries.");
    }

    if (!query || query.trim() === '') {
        throw new Error("Query is empty or undefined");
    }

    try {
        const reader = await connection.runAndReadAll(query);
        return reader.getRowObjects();
    } catch (err) {
        console.error(`Error executing query: ${query}`, err);
        throw err;
    }
}

export async function saveQueryToParquet(connection?: DuckDBConnection, fileName?: string, query?: string, folder?: string): Promise<void> {
    if (!connection || !fileName || !query) {
        throw new Error("Connection, file name, or query is missing");
    }

    const folderPath = folder ? `${folder}/${fileName}` : fileName;
    const copyQuery = `COPY (${query}) TO '${folderPath}' (FORMAT PARQUET, COMPRESSION ZSTD)`;

    try {
        await connection.run(copyQuery);
        console.log(`Saved query results to ${folderPath}`);
    } catch (err) {
        console.error(`Error saving query to Parquet:`, err);
        throw err;
    }
}

export async function exportToCSV(connection: DuckDBConnection, source: string, fileName: string, options?: { header?: boolean, delimiter?: string }): Promise<void> {
    const header = options?.header !== false ? 'HEADER' : 'NO_HEADER';
    const delimiter = options?.delimiter ?? ',';

    const isQuery = source.trim().toUpperCase().startsWith('SELECT');
    const copyCommand = isQuery
        ? `COPY (${source}) TO '${fileName}' (FORMAT CSV, ${header}, DELIMITER '${delimiter}')`
        : `COPY ${source} TO '${fileName}' (FORMAT CSV, ${header}, DELIMITER '${delimiter}')`;

    try {
        await connection.run(copyCommand);
        console.log(`Exported to CSV: ${fileName}`);
    } catch (err) {
        console.error('CSV export failed:', err);
        throw err;
    }
}

export async function exportToJSON(connection: DuckDBConnection, source: string, fileName: string, options?: { pretty?: boolean }): Promise<void> {
    const formatOption = options?.pretty ? 'FORMAT JSON, ARRAY TRUE' : 'FORMAT JSON';

    const isQuery = source.trim().toUpperCase().startsWith('SELECT');
    const copyCommand = isQuery
        ? `COPY (${source}) TO '${fileName}' (${formatOption})`
        : `COPY ${source} TO '${fileName}' (${formatOption})`;

    try {
        await connection.run(copyCommand);
        console.log(`Exported to JSON: ${fileName}`);
    } catch (err) {
        console.error('JSON export failed:', err);
        throw err;
    }
}

export async function exportToParquet(connection: DuckDBConnection, source: string, fileName: string, options?: { compression?: string }): Promise<void> {
    const compression = options?.compression ?? 'ZSTD'; // Default to ZSTD compression

    const isQuery = source.trim().toUpperCase().startsWith('SELECT');
    const copyCommand = isQuery
        ? `COPY (${source}) TO '${fileName}' (FORMAT PARQUET, COMPRESSION ${compression})`
        : `COPY ${source} TO '${fileName}' (FORMAT PARQUET, COMPRESSION ${compression})`;

    try {
        await connection.run(copyCommand);
        console.log(`Exported to Parquet: ${fileName}`);
    } catch (err) {
        console.error('Parquet export failed:', err);
        throw err;
    }
}