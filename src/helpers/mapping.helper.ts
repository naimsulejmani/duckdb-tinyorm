/* eslint-disable @typescript-eslint/no-explicit-any */

export function modelToArray<T>(model: T, classType: new() => T): unknown[] {
    const propertyNames = Object.getOwnPropertyNames(new classType());
    const array = [];
    for (const propertyName of propertyNames) {
        array.push(model[propertyName]);
    }
    return array;
}

export function mapToSQLFieldsValues<T>(model: T, classType: new() => T): string {
    const values = modelToArray(model, classType);
    const query = values.map(item => {
        let obj = null;
        switch (typeof item) {
            case 'number':
                obj = item;
                break;
            case 'string':

                // eslint-disable-next-line no-control-regex
                obj = `'${item.replace(/'/g, '\'\'').replace(/\u0000/g, '')}'`;
                break;
            case 'boolean':
                obj = item ? 1 : 0;
                break;
            case 'object':
                if (!item) {
                    obj = 'null';
                } else if (Array.isArray(item)) {
                    obj = `'${JSON.stringify(item)}'`;
                }
                else if (item instanceof Date) {
                    obj = `'${item.toISOString()}'`; // Convert date to ISO 8601 string format
                }
                else {
                    obj = `'${JSON.stringify(item)}'`;
                }
                break;
            default:
                obj = 'null';
                break;
        }
        return obj;
    }).join(',');
    return `(${query})`;
}

export function parseJson(input: any): any {
    return input ? JSON.parse(input) : null;
}