import { Page, Pageable } from '../pagination/pagination';
import { QueryBuilder } from '../query/query-builder';
import { Transaction } from './transaction';
import { ExportOptions } from './duckdb.repository';

export interface IRepository<T extends object, Tid> {
    init(): Promise<void>;
    save(entity: T): Promise<T>;
    saveAll(entities: T[]): Promise<T[]>;
    insert(entity: T): Promise<T>;
    bulkInsert(entities: T[]): Promise<T[]>;
    findAll(): Promise<T[]>;
    findById(id: Tid): Promise<T>;
    findByIdOrThrow(id: Tid): Promise<T>;
    existsById(id: Tid): Promise<boolean>;
    findBy(entity: Partial<T>, columns: string[]): Promise<T[]>;
    findWithPagination(pageable: Pageable): Promise<Page<T>>;
    removeById(id: Tid): Promise<T>;
    removeAll(): Promise<void>;
    createQueryBuilder(): Promise<QueryBuilder<T>>;
    withTransaction<R>(callback: (transaction: Transaction) => Promise<R>): Promise<R>;
    toEntity(data: Record<string, any>): T;
    exportData(options: ExportOptions): Promise<void>;
    exportQuery(query: string, options: ExportOptions): Promise<void>;
    appendEntities(entities: T[]): Promise<void>
}