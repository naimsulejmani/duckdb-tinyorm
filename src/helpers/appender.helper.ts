/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { DuckDBAppender } from '@duckdb/node-api';

/**
 * Appends a single JavaScript value to an open DuckDBAppender column.
 * Uses the declared SQL FieldType metadata (if provided) to choose the most
 * appropriate typed append method; falls back on the runtime JS type.
 */
export function appendValue(appender: DuckDBAppender, value: any, sqlType?: string): void {
    if (value === undefined || value === null) {
        appender.appendNull();
        return;
    }

    const normalizedType = (sqlType ?? '').toUpperCase().trim();

    if (typeof value === 'boolean') {
        appender.appendBoolean(value);
        return;
    }

    if (typeof value === 'bigint') {
        if (normalizedType.includes('HUGEINT') || normalizedType.includes('UHUGEINT')) {
            appender.appendHugeInt(value);
        } else if (normalizedType.includes('UBIGINT')) {
            appender.appendUBigInt(value);
        } else {
            appender.appendBigInt(value);
        }
        return;
    }

    if (typeof value === 'number') {
        if (
            normalizedType.includes('FLOAT') ||
            normalizedType.includes('DOUBLE') ||
            normalizedType.includes('REAL') ||
            normalizedType.includes('DECIMAL') ||
            normalizedType.includes('NUMERIC')
        ) {
            appender.appendDouble(value);
        } else if (normalizedType.includes('TINYINT') || normalizedType === 'INT1') {
            appender.appendTinyInt(value);
        } else if (normalizedType.includes('SMALLINT') || normalizedType === 'INT2') {
            appender.appendSmallInt(value);
        } else if (
            normalizedType.includes('HUGEINT') ||
            normalizedType.includes('BIGINT') ||
            normalizedType === 'INT8'
        ) {
            appender.appendBigInt(BigInt(value));
        } else if (
            normalizedType === 'INTEGER' ||
            normalizedType === 'INT' ||
            normalizedType === 'INT4' ||
            normalizedType === 'SIGNED'
        ) {
            appender.appendInteger(value);
        } else {
            // Default numeric fallback: use double for fractional, integer for whole
            if (Number.isInteger(value)) {
                appender.appendInteger(value);
            } else {
                appender.appendDouble(value);
            }
        }
        return;
    }

    if (typeof value === 'string') {
        appender.appendVarchar(value);
        return;
    }

    if (value instanceof Uint8Array) {
        appender.appendBlob(value);
        return;
    }

    // Fallback: serialize as VARCHAR
    appender.appendVarchar(String(value));
}

/**
 * Appends all fields of an entity to the appender and calls endRow().
 * All column values (including primary keys) are taken directly from the entity.
 * Note: when using the appender, auto-increment primary key values must be
 * provided by the caller, as DuckDB sequence-based defaults are not supported
 * via the Appender API. For auto-generated IDs, use `saveAll` instead.
 *
 * @param propertyNames - Pre-computed list of property names to avoid repeated
 *                        prototype instantiation in batch operations.
 */
export function appendEntity<T extends object>(
    appender: DuckDBAppender,
    entity: T,
    classType: new () => T,
    propertyNames?: string[]
): void {
    const names = propertyNames ?? Object.getOwnPropertyNames(new classType());

    for (const propertyName of names) {
        const sqlType: string | undefined = Reflect.getMetadata('FieldType', classType.prototype, propertyName);
        const value = (entity as any)[propertyName];
        appendValue(appender, value, sqlType);
    }

    appender.endRow();
}
