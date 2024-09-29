import 'reflect-metadata';
import { DataTypeDecorator, Entity, Id, Repository, Unique } from "./constants/data-type.decorator";
import { BaseRepository } from "./repositories/base.repository";
import { DuckDbRepository } from "./repositories/duckdb.repository";
import { IRepository } from './repositories/base.interface';



export {
    DataTypeDecorator,
    Id,
    Unique,
    BaseRepository,
    Entity,
    Repository,
    DuckDbRepository,
    IRepository
};