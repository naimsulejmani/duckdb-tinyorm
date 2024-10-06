import 'reflect-metadata';
import { DataTypeDecorator, Entity, Id, Repository, Unique } from "./constants/data-type.decorator";
import { BaseRepository } from "./repositories/base.repository";
import { DuckDbRepository, DuckDbConfig, DuckDbLocation } from './repositories/duckdb.repository';
import { IRepository } from './repositories/base.interface';
import { getClassName, getTableName, getPrimaryId, generateCreateTableStatement, generateInsertIntoStatement } from './helpers/table-util.helper';



export {
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
    generateInsertIntoStatement
};