import { DuckDBConnection } from '@duckdb/node-api';
import { TransactionError } from '../errors/orm-errors';

export class Transaction {
    constructor(private connection: DuckDBConnection) { }

    async begin(): Promise<void> {
        try {
            await this.connection.run('BEGIN TRANSACTION');
        } catch (error) {
            throw new TransactionError('begin', error as Error);
        }
    }

    async commit(): Promise<void> {
        try {
            await this.connection.run('COMMIT');
        } catch (error) {
            throw new TransactionError('commit', error as Error);
        }
    }

    async rollback(): Promise<void> {
        try {
            await this.connection.run('ROLLBACK');
        } catch (error) {
            throw new TransactionError('rollback', error as Error);
        }
    }
}