import 'reflect-metadata';
import { PrimaryKeyError, TableCreationError } from '../errors/orm-errors';

export function getClassName<T>(classType: new() => T): string {
    return classType.name;
}

export function getTableName<T>(classType: new() => T): string {
    return getClassName(classType);
}

export function getPrimaryId<T>(classType: new() => T): string {
    // Get the property names from the class using reflection
    const propertyNames = Object.getOwnPropertyNames(new classType());
    let primaryKeys = 0;
    let columnName = "";

    for (const propertyName of propertyNames) {
        
        const primaryKey = Reflect.getMetadata('PrimaryKey', classType.prototype, propertyName);
        
        if (primaryKey) {
            primaryKeys++;
            columnName = propertyName;
        }
    }

    return primaryKeys==1 ? columnName: "";
}



export function generateCreateTableStatement<T>(tableName: string, classType: new() => T): string {
    let createTableStatement = `CREATE TABLE IF NOT EXISTS main.${tableName} (`;

    // Get the property names from the class using reflection
    const propertyNames = Object.getOwnPropertyNames(new classType());
    let primaryKeys = 0;
    const constraints: string[] = [];

    // Get sequences that were already created
    const sequences = Reflect.getMetadata('Sequences', classType) || {};

    for (let i = 0; i < propertyNames.length; i++) {
        const propertyName = propertyNames[i];

        // Retrieve column metadata using reflection
        const propertyType = Reflect.getMetadata('FieldType', classType.prototype, propertyName) || 'VARCHAR';
        const primaryKey = Reflect.getMetadata('PrimaryKey', classType.prototype, propertyName);
        const unique = Reflect.getMetadata('Unique', classType.prototype, propertyName);
        const notNull = Reflect.getMetadata('NotNull', classType.prototype, propertyName);
        const defaultValue = Reflect.getMetadata('DefaultValue', classType.prototype, propertyName);
        const check = Reflect.getMetadata('Check', classType.prototype, propertyName);
        const autoIncrement = Reflect.getMetadata('AutoIncrement', classType.prototype, propertyName);

        // Append the column definition to the statement
        createTableStatement += `${propertyName} ${propertyType}`;

        // Add constraints inline with the column
        if (primaryKey) {
            createTableStatement += ' PRIMARY KEY';
            primaryKeys++;
        }

        if (autoIncrement && sequences[propertyName]) {
            const sequenceName = sequences[propertyName];
            createTableStatement += ` DEFAULT nextval('${sequenceName}')`;
        } else if (defaultValue !== undefined) {
            if (typeof defaultValue === 'string') {
                createTableStatement += ` DEFAULT '${defaultValue}'`;
            } else if (defaultValue === null) {
                createTableStatement += ' DEFAULT NULL';
            } else {
                createTableStatement += ` DEFAULT ${defaultValue}`;
            }
        }

        if (notNull) {
            createTableStatement += ' NOT NULL';
        }

        if (unique) {
            createTableStatement += ' UNIQUE';
        }

        // Add check constraints to a collection to add after all columns
        if (check) {
            constraints.push(`CHECK (${check})`);
        }

        // Add a comma if it's not the last property or if we have constraints to add
        if (i < propertyNames.length - 1 || constraints.length > 0) {
            createTableStatement += ', ';
        }
    }

    // Add any additional constraints
    if (constraints.length > 0) {
        createTableStatement += constraints.join(', ');
    }

    // Close the CREATE TABLE statement
    createTableStatement += ');';

    if (primaryKeys > 1) {
        throw new PrimaryKeyError('Multiple primary keys are not supported!');
    }

    return createTableStatement;
}

export function generateInsertIntoStatement<T>(tableName: string, classType: new() => T): string {
    return `INSERT INTO main.${tableName} `;
}
