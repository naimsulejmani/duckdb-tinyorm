import 'reflect-metadata';
import {
    DataTypeDecorator, Entity, Id, Repository, Unique,
    Column, ColumnOptions, NotNull, Default, Check, AutoIncrement, TableOptions
} from "./constants/data-type.decorator";
import { BaseRepository } from "./repositories/base.repository";
import { DuckDbRepository, DuckDbConfig, DuckDbLocation, ExportOptions } from './repositories/duckdb.repository';
import { IRepository } from './repositories/base.interface';
import { getClassName, getTableName, getPrimaryId, generateCreateTableStatement, generateInsertIntoStatement } from './helpers/table-util.helper';
import { QueryBuilder } from './query/query-builder';
import { Transaction } from './repositories/transaction';
import { Page, Pageable } from './pagination/pagination';
import { Migration, MigrationRunner, MigrationOptions } from './migration/migration';
import {
    OrmBaseError, EntityNotFoundError, PrimaryKeyError, TableCreationError,
    QueryExecutionError, TransactionError, ValidationError, MigrationError, ConnectionError
} from './errors/orm-errors';

export {
    // Original exports
    DataTypeDecorator,
    Id,
    Unique,
    BaseRepository,
    Entity,
    Repository,
    DuckDbRepository,
    IRepository,
    DuckDbConfig,
    DuckDbLocation,
    getClassName,
    getTableName,
    getPrimaryId,
    generateCreateTableStatement,
    generateInsertIntoStatement,
    QueryBuilder,
    Transaction,
    Page,
    Pageable,
    Migration,
    MigrationRunner,
    MigrationOptions,

    // New decorator exports
    Column,
    ColumnOptions,
    NotNull,
    Default,
    Check,
    AutoIncrement,
    TableOptions,

    // Error class exports
    OrmBaseError,
    ConnectionError,
    EntityNotFoundError,
    PrimaryKeyError,
    TableCreationError,
    QueryExecutionError,
    TransactionError,
    ValidationError,
    MigrationError,

    // New export
    ExportOptions
};