/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { DuckDBAppender, DuckDBDateValue, DuckDBTimestampTZValue, DuckDBTimestampValue } from '@duckdb/node-api';

const MS_PER_DAY = 86_400_000;
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

/**
 * Normalizes a declared SQL column type to its base type name, e.g.
 * `decimal(10, 2)` -> `DECIMAL`, `varchar(255)` -> `VARCHAR`,
 * `timestamp with time zone` -> `TIMESTAMPTZ`.
 */
function normalizeSqlType(sqlType?: string): string {
    const base = (sqlType ?? '')
        .toUpperCase()
        .replace(/\(.*\)/, '')
        .replace(/\s+/g, ' ')
        .trim();

    switch (base) {
        case 'TIMESTAMP WITH TIME ZONE':
            return 'TIMESTAMPTZ';
        case 'TIMESTAMP WITHOUT TIME ZONE':
        case 'DATETIME':
            return 'TIMESTAMP';
        default:
            return base;
    }
}

function toBigInt(value: number | bigint): bigint {
    return typeof value === 'bigint' ? value : BigInt(value);
}

function toNumber(value: number | bigint): number {
    return typeof value === 'number' ? value : Number(value);
}

/**
 * Appends a numeric (number | bigint) value using the typed append method that
 * matches the declared column type exactly. Unsigned and wide integer types are
 * matched explicitly so that e.g. `UTINYINT` is not treated as `TINYINT`.
 */
function appendNumeric(appender: DuckDBAppender, value: number | bigint, type: string): void {
    switch (type) {
        case 'TINYINT':
        case 'INT1':
            appender.appendTinyInt(toNumber(value));
            return;
        case 'UTINYINT':
            appender.appendUTinyInt(toNumber(value));
            return;
        case 'SMALLINT':
        case 'INT2':
        case 'SHORT':
            appender.appendSmallInt(toNumber(value));
            return;
        case 'USMALLINT':
            appender.appendUSmallInt(toNumber(value));
            return;
        case 'INTEGER':
        case 'INT':
        case 'INT4':
        case 'SIGNED':
            appender.appendInteger(toNumber(value));
            return;
        case 'UINTEGER':
            appender.appendUInteger(toNumber(value));
            return;
        case 'BIGINT':
        case 'INT8':
        case 'LONG':
            appender.appendBigInt(toBigInt(value));
            return;
        case 'UBIGINT':
            appender.appendUBigInt(toBigInt(value));
            return;
        case 'HUGEINT':
        case 'INT128':
            appender.appendHugeInt(toBigInt(value));
            return;
        case 'UHUGEINT':
        case 'UINT128':
            appender.appendUHugeInt(toBigInt(value));
            return;
        case 'FLOAT':
        case 'FLOAT4':
        case 'REAL':
            appender.appendFloat(toNumber(value));
            return;
        case 'DOUBLE':
        case 'FLOAT8':
        case 'DECIMAL':
        case 'NUMERIC':
            // DuckDB casts DOUBLE -> DECIMAL(width, scale) on append.
            appender.appendDouble(toNumber(value));
            return;
    }

    // Unknown / undeclared type: infer from the runtime value.
    if (typeof value === 'bigint') {
        appender.appendBigInt(value);
    } else if (Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX) {
        appender.appendInteger(value);
    } else if (Number.isSafeInteger(value)) {
        appender.appendBigInt(BigInt(value));
    } else {
        appender.appendDouble(value);
    }
}

/** Appends a JS Date to DATE / TIMESTAMP / TIMESTAMPTZ columns (UTC based). */
function appendDate(appender: DuckDBAppender, value: Date, type: string): void {
    const ms = value.getTime();
    if (Number.isNaN(ms)) {
        throw new TypeError('Cannot append an invalid Date');
    }

    switch (type) {
        case 'DATE':
            appender.appendDate(new DuckDBDateValue(Math.floor(ms / MS_PER_DAY)));
            return;
        case 'TIMESTAMP':
            appender.appendTimestamp(new DuckDBTimestampValue(BigInt(ms) * 1000n));
            return;
        case 'TIMESTAMPTZ':
            appender.appendTimestampTZ(new DuckDBTimestampTZValue(BigInt(ms) * 1000n));
            return;
        default:
            // Let DuckDB cast the ISO-8601 string to the target column type.
            appender.appendVarchar(value.toISOString());
    }
}

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

    const normalizedType = normalizeSqlType(sqlType);

    if (typeof value === 'boolean') {
        appender.appendBoolean(value);
        return;
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
        appendNumeric(appender, value, normalizedType);
        return;
    }

    if (typeof value === 'string') {
        appender.appendVarchar(value);
        return;
    }

    if (value instanceof Date) {
        appendDate(appender, value, normalizedType);
        return;
    }

    if (value instanceof Uint8Array) {
        appender.appendBlob(value);
        return;
    }

    // Fallback: serialize as VARCHAR (JSON for plain objects / arrays)
    if (typeof value === 'object' && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype)) {
        appender.appendVarchar(JSON.stringify(value));
        return;
    }
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
