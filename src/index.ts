import 'reflect-metadata';
import { DataTypeDecorator, Id, Unique } from "./constants/data-type.decorator";
import { BaseRepository, Entity, Repository } from "./repositories/base.repository";
import { DuckDbRepository } from "./repositories/duckdb.repository";
import { IRepository } from './repositories/base.interface';



module.exports = {
    DataTypeDecorator, Id, Unique, BaseRepository, Entity, Repository, DuckDbRepository, IRepository
}
