import { DuckDBConnection } from '@duckdb/node-api';

export async function bulkInsert(connection: DuckDBConnection, query: string): Promise<void> {
    // Add logging to see the exact query being executed
    console.log("Executing bulk insert query:", query);

    try {
        await connection.run(query);
    } catch (err) {
        console.error("Error bulk inserting!", err);
        throw err;
    }
}