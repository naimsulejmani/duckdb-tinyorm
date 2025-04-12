export class QueryBuilder<T> {
    private selectClauses: string[] = ['*'];
    private fromTable = '';
    private whereClauses: string[] = [];
    private orderByClauses: string[] = [];
    private limitValue?: number;
    private offsetValue?: number;
    private groupByClauses: string[] = [];
    private havingClauses: string[] = [];
    private joinClauses: string[] = [];
    private parameters: any[] = [];

    constructor(entityClass: new () => T) {
        // Use metadata to get the table name
        const tableName = Reflect.getMetadata('TableName', entityClass) || entityClass.name;
        this.fromTable = `main.${tableName}`;
    }

    select(columns: string | string[]): QueryBuilder<T> {
        this.selectClauses = Array.isArray(columns) ? columns : [columns];
        return this;
    }

    where(condition: string, ...params: any[]): QueryBuilder<T> {
        this.whereClauses.push(condition);
        this.parameters.push(...params);
        return this;
    }

    andWhere(condition: string, ...params: any[]): QueryBuilder<T> {
        if (this.whereClauses.length > 0) {
            this.whereClauses.push(`AND ${condition}`);
        } else {
            this.whereClauses.push(condition);
        }
        this.parameters.push(...params);
        return this;
    }

    orWhere(condition: string, ...params: any[]): QueryBuilder<T> {
        if (this.whereClauses.length > 0) {
            this.whereClauses.push(`OR ${condition}`);
        } else {
            this.whereClauses.push(condition);
        }
        this.parameters.push(...params);
        return this;
    }

    orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder<T> {
        this.orderByClauses.push(`${column} ${direction}`);
        return this;
    }

    limit(limit: number): QueryBuilder<T> {
        this.limitValue = limit;
        return this;
    }

    offset(offset: number): QueryBuilder<T> {
        this.offsetValue = offset;
        return this;
    }

    groupBy(column: string | string[]): QueryBuilder<T> {
        const columns = Array.isArray(column) ? column : [column];
        this.groupByClauses.push(...columns);
        return this;
    }

    having(condition: string, ...params: any[]): QueryBuilder<T> {
        this.havingClauses.push(condition);
        this.parameters.push(...params);
        return this;
    }

    join(table: string, condition: string): QueryBuilder<T> {
        this.joinClauses.push(`JOIN ${table} ON ${condition}`);
        return this;
    }

    leftJoin(table: string, condition: string): QueryBuilder<T> {
        this.joinClauses.push(`LEFT JOIN ${table} ON ${condition}`);
        return this;
    }

    rightJoin(table: string, condition: string): QueryBuilder<T> {
        this.joinClauses.push(`RIGHT JOIN ${table} ON ${condition}`);
        return this;
    }

    getQuery(): string {
        let query = `SELECT ${this.selectClauses.join(', ')} FROM ${this.fromTable}`;

        if (this.joinClauses.length > 0) {
            query += ` ${this.joinClauses.join(' ')}`;
        }

        if (this.whereClauses.length > 0) {
            query += ` WHERE ${this.whereClauses.join(' ')}`;
        }

        if (this.groupByClauses.length > 0) {
            query += ` GROUP BY ${this.groupByClauses.join(', ')}`;
        }

        if (this.havingClauses.length > 0) {
            query += ` HAVING ${this.havingClauses.join(' AND ')}`;
        }

        if (this.orderByClauses.length > 0) {
            query += ` ORDER BY ${this.orderByClauses.join(', ')}`;
        }

        if (this.limitValue !== undefined) {
            query += ` LIMIT ${this.limitValue}`;
        }

        if (this.offsetValue !== undefined) {
            query += ` OFFSET ${this.offsetValue}`;
        }

        return query;
    }

    getParameters(): any[] {
        return this.parameters;
    }
}