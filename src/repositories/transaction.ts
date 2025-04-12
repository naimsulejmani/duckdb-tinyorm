import { Connection } from 'duckdb';
import { TransactionError } from '../errors/orm-errors';

export class Transaction {
    constructor(private connection: Connection) {}

    async begin(): Promise<void> {
        try {
            await this.execute('BEGIN TRANSACTION');
        } catch (error) {
            throw new TransactionError('begin', error as Error);
        }
    }

    async commit(): Promise<void> {
        try {
            await this.execute('COMMIT');
        } catch (error) {
            throw new TransactionError('commit', error as Error);
        }
    }

    async rollback(): Promise<void> {
        try {
            await this.execute('ROLLBACK');
        } catch (error) {
            throw new TransactionError('rollback', error as Error);
        }
    }

    private execute(query: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.connection.run(query, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}