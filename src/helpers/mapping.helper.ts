/* eslint-disable @typescript-eslint/no-explicit-any */

export function modelToArray<T>(model: T, classType: new() => T): unknown[] {
    const propertyNames = Object.getOwnPropertyNames(new classType());
    const array = [];
    for (const propertyName of propertyNames) {
        array.push((model as any)[propertyName]);
    }
    return array;
}

export function mapToSQLFieldsValues<T>(data: T, classType: new () => T): string {
    const fields: string[] = [];
    const values: string[] = [];

    // Get property names from the entity
    const propertyNames = Object.getOwnPropertyNames(data);

    for (const propertyName of propertyNames) {
        // Skip auto-increment primary keys
        const autoIncrement = Reflect.getMetadata('AutoIncrement', classType.prototype, propertyName);
        const isPrimaryKey = Reflect.getMetadata('PrimaryKey', classType.prototype, propertyName);

        if (autoIncrement && isPrimaryKey) {
            continue; // Skip this field in the INSERT statement
        }

        // Get the value
        const value = data[propertyName as keyof T];

        // Add field name
        fields.push(propertyName);

        // Format value based on its type
        if (value === undefined || value === null) {
            values.push('NULL');
        } else if (typeof value === 'string') {
            const escapedValue = (value as string).replace(/'/g, "''");
            values.push(`'${escapedValue}'`);
        } else if (typeof value === 'boolean') {
            values.push(value ? 'TRUE' : 'FALSE');
        } else {
            values.push(`${value}`);
        }
    }

    // Make sure we have fields to insert
    if (fields.length === 0) {
        throw new Error("No fields available for insert after excluding auto-increment fields");
    }

    return `(${fields.join(', ')}) VALUES (${values.join(', ')})`;
}

export function parseJson(input: any): any {
    return input ? JSON.parse(input) : null;
}