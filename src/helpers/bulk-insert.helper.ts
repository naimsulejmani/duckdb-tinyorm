export async function bulkInsert(connection: any, query: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // Add logging to see the exact query being executed
        console.log("Executing bulk insert query:", query);
        
        connection.run(query, (err: any) => {
            if (err) {
                console.error("Error bulk inserting!", err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}