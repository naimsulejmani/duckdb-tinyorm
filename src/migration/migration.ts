import { Connection } from 'duckdb';

// Add this type alias for DuckDB row data
type DuckDBRow = Record<string, any>;

export interface MigrationOptions {
    tableName?: string;
}

export abstract class Migration {
    abstract version: string;
    abstract up(): string;
    abstract down(): string;
}

export class MigrationRunner {
    private readonly migrationTableName: string;

    constructor(
        private readonly connection: Connection,
        options: MigrationOptions = {}
    ) {
        this.migrationTableName = options.tableName ?? 'migrations';
    }

    async initialize(): Promise<void> {
        await this.createMigrationTableIfNotExists();
    }

    private async createMigrationTableIfNotExists(): Promise<void> {
        const query = `
            CREATE TABLE IF NOT EXISTS ${this.migrationTableName} (
                id INTEGER PRIMARY KEY,
                version VARCHAR NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
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

    async applyMigrations(migrations: Migration[]): Promise<void> {
        await this.initialize();
        
        // Sort migrations by version
        migrations.sort((a, b) => a.version.localeCompare(b.version));
        
        // Check which migrations have been applied
        const appliedMigrations = await this.getAppliedMigrations();
        const appliedVersions = new Set(appliedMigrations.map(m => m.version));
        
        // Apply migrations that haven't been applied yet
        for (const migration of migrations) {
            if (!appliedVersions.has(migration.version)) {
                await this.applyMigration(migration);
            }
        }
    }

    async revertMigrations(migrations: Migration[], targetVersion?: string): Promise<void> {
        await this.initialize();
        
        // Sort migrations by version in descending order
        migrations.sort((a, b) => b.version.localeCompare(a.version));
        
        // Check which migrations have been applied
        const appliedMigrations = await this.getAppliedMigrations();
        const appliedVersions = new Map(appliedMigrations.map(m => [m.version, m]));
        
        // Revert migrations until target version
        for (const migration of migrations) {
            if (appliedVersions.has(migration.version)) {
                if (targetVersion && migration.version <= targetVersion) {
                    // Stop if we've reached or gone past the target version
                    break;
                }
                await this.revertMigration(migration);
            }
        }
    }

    private async getAppliedMigrations(): Promise<{ id: number; version: string; applied_at: string }[]> {
        const query = `SELECT * FROM ${this.migrationTableName} ORDER BY id ASC`;
        
        return new Promise((resolve, reject) => {
            this.connection.all(query, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    // Cast the result to the expected type
                    const typedResult = result.map((row: DuckDBRow) => ({
                        id: typeof row.id === 'number' ? row.id : Number(row.id),
                        version: String(row.version),
                        applied_at: String(row.applied_at)
                    }));
                    resolve(typedResult);
                }
            });
        });
    }

    private async applyMigration(migration: Migration): Promise<void> {
        const upQuery = migration.up();
        const insertQuery = `INSERT INTO ${this.migrationTableName} (version) VALUES ('${migration.version}')`;
        
        // Start transaction
        await this.executeQuery('BEGIN TRANSACTION');
        
        try {
            // Apply migration
            await this.executeQuery(upQuery);
            
            // Record migration
            await this.executeQuery(insertQuery);
            
            // Commit transaction
            await this.executeQuery('COMMIT');
            
            console.log(`Migration ${migration.version} applied successfully`);
        } catch (error) {
            // Rollback transaction on error
            await this.executeQuery('ROLLBACK');
            console.error(`Failed to apply migration ${migration.version}:`, error);
            throw error;
        }
    }

    private async revertMigration(migration: Migration): Promise<void> {
        const downQuery = migration.down();
        const deleteQuery = `DELETE FROM ${this.migrationTableName} WHERE version = '${migration.version}'`;
        
        // Start transaction
        await this.executeQuery('BEGIN TRANSACTION');
        
        try {
            // Revert migration
            await this.executeQuery(downQuery);
            
            // Remove migration record
            await this.executeQuery(deleteQuery);
            
            // Commit transaction
            await this.executeQuery('COMMIT');
            
            console.log(`Migration ${migration.version} reverted successfully`);
        } catch (error) {
            // Rollback transaction on error
            await this.executeQuery('ROLLBACK');
            console.error(`Failed to revert migration ${migration.version}:`, error);
            throw error;
        }
    }

    private async executeQuery(query: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.run(query, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }
}