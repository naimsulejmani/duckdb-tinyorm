export interface IRepository<T, Tid> {
    save(entity: T): Promise<T>;
    findAll(): Promise<T[]>;
    findById(id: Tid): Promise<T>
    findBy(entity: T, columns: string[]): Promise<T[]>
}