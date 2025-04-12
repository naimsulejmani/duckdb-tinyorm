export class OrmBaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, OrmBaseError.prototype);
  }
}

export class EntityNotFoundError extends OrmBaseError {
  constructor(entityName: string, id: any) {
    super(`Entity ${entityName} with id ${id} not found`);
    Object.setPrototypeOf(this, EntityNotFoundError.prototype);
  }
}

export class PrimaryKeyError extends OrmBaseError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, PrimaryKeyError.prototype);
  }
}

export class TableCreationError extends OrmBaseError {
  constructor(tableName: string, originalError?: Error) {
    const errorMsg = originalError 
      ? `Failed to create table ${tableName}: ${originalError.message}` 
      : `Failed to create table ${tableName}`;
    super(errorMsg);
    Object.setPrototypeOf(this, TableCreationError.prototype);
  }
}

export class QueryExecutionError extends OrmBaseError {
  constructor(query: string, originalError?: Error) {
    const errorMsg = originalError 
      ? `Error executing query: ${query.substring(0, 100)}...\nDetails: ${originalError.message}` 
      : `Error executing query: ${query.substring(0, 100)}...`;
    super(errorMsg);
    Object.setPrototypeOf(this, QueryExecutionError.prototype);
  }
}

export class TransactionError extends OrmBaseError {
  constructor(operation: string, originalError?: Error) {
    const errorMsg = originalError 
      ? `Transaction ${operation} failed: ${originalError.message}` 
      : `Transaction ${operation} failed`;
    super(errorMsg);
    Object.setPrototypeOf(this, TransactionError.prototype);
  }
}

export class ValidationError extends OrmBaseError {
  constructor(entityName: string, propertyName: string, value: any, constraint: string) {
    super(`Validation failed for ${entityName}.${propertyName}: ${value} violates constraint ${constraint}`);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class MigrationError extends OrmBaseError {
  constructor(version: string, operation: string, originalError?: Error) {
    const errorMsg = originalError 
      ? `Migration ${version} ${operation} failed: ${originalError.message}` 
      : `Migration ${version} ${operation} failed`;
    super(errorMsg);
    Object.setPrototypeOf(this, MigrationError.prototype);
  }
}