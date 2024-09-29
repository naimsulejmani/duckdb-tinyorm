import 'reflect-metadata';

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

    for (let i = 0; i < propertyNames.length; i++) {
        const propertyName = propertyNames[i];

        // Retrieve the type of the property using reflection and the FieldType decorator
        const propertyType = Reflect.getMetadata('FieldType', classType.prototype, propertyName);
        const primaryKey = Reflect.getMetadata('PrimaryKey', classType.prototype, propertyName);
        const unique = Reflect.getMetadata('Unique', classType.prototype, propertyName)

        // Append the column definition to the statement
        createTableStatement += `${propertyName} ${propertyType ?? 'VARCHAR'}`;

        if (primaryKey) {
            createTableStatement += ' PRIMARY KEY';
            primaryKeys++;
        }
        if(unique) createTableStatement += ' UNIQUE';

        // Add a comma if it's not the last property
        if (i < propertyNames.length - 1) {
            createTableStatement += ', ';
        }
    }

    // Close the CREATE TABLE statement
    createTableStatement += ');';

    if(primaryKeys>1) throw new Error('Multiple primary keys are not supported!')

    return createTableStatement;
}

export function generateInsertIntoStatement<T>(tableName: string, classType: new() => T): string {
    let insertIntoTableStatement = `INSERT INTO main.${tableName} (`;

    const propertyNames = Object.getOwnPropertyNames(new classType());

    for (let i = 0; i < propertyNames.length; i++) {
        const propertyName = propertyNames[i];

        insertIntoTableStatement += `${propertyName}`;

        if (i < propertyNames.length - 1) {
            insertIntoTableStatement += ', ';
        }
    }

    insertIntoTableStatement += ') VALUES ';

    return insertIntoTableStatement;
}
