/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';

// Interface for column options
export interface ColumnOptions {
    type?: string;
    notNull?: boolean;
    unique?: boolean;
    defaultValue?: any;
    check?: string;
    primaryKey?: boolean;
    autoIncrement?: boolean;
}

// Column decorator with options
export function Column(options: ColumnOptions = {}): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        let propertyValue: any;
        const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey as string);

        if (descriptor) {
            // Modify the descriptor to include the specified data type
            descriptor.value = propertyValue;
            descriptor.writable = true;
            descriptor.enumerable = true;
            descriptor.configurable = true;
            Object.defineProperty(target, propertyKey, descriptor);
        } else {
            // If the property doesn't exist, create it
            Object.defineProperty(target, propertyKey, {
                value: propertyValue,
                writable: true,
                enumerable: true,
                configurable: true,
            });
        }

        // Set all options as metadata
        if (options.type) {
            Reflect.defineMetadata('FieldType', options.type, target, propertyKey);
        }
        if (options.primaryKey) {
            Reflect.defineMetadata('PrimaryKey', true, target, propertyKey);
        }
        if (options.unique) {
            Reflect.defineMetadata('Unique', true, target, propertyKey);
        }
        if (options.notNull) {
            Reflect.defineMetadata('NotNull', true, target, propertyKey);
        }
        if (options.defaultValue !== undefined) {
            Reflect.defineMetadata('DefaultValue', options.defaultValue, target, propertyKey);
        }
        if (options.check) {
            Reflect.defineMetadata('Check', options.check, target, propertyKey);
        }
        if (options.autoIncrement) {
            Reflect.defineMetadata('AutoIncrement', true, target, propertyKey);
        }
    };
}

// Legacy decorators for backward compatibility
export function DataTypeDecorator(dataType: string): PropertyDecorator {
    return Column({ type: dataType });
}

export function Id(): PropertyDecorator {
    return Column({ primaryKey: true });
}

export function Unique(): PropertyDecorator {
    return Column({ unique: true });
}

export function NotNull(): PropertyDecorator {
    return Column({ notNull: true });
}

export function Default(value: any): PropertyDecorator {
    return Column({ defaultValue: value });
}

export function Check(constraint: string): PropertyDecorator {
    return Column({ check: constraint });
}

export function AutoIncrement(): PropertyDecorator {
    return Column({ autoIncrement: true });
}

// Table decorator with options
export interface TableOptions {
    name?: string;
    schema?: string;
}

export function Entity(): ClassDecorator;
export function Entity(options: TableOptions): ClassDecorator;
export function Entity(options?: TableOptions): ClassDecorator {
    return function (target: Function) {
        // Add metadata to the class
        Reflect.defineMetadata('entityType', target, target);

        // Add table name if provided
        if (options?.name) {
            Reflect.defineMetadata('TableName', options.name, target);
        }

        // Add schema if provided
        if (options?.schema) {
            Reflect.defineMetadata('Schema', options.schema, target);
        }
    };
}

// Repository decorator
export function Repository(entity: new () => any) {
    return function (target: Function) {
        Reflect.defineMetadata('entityType', entity, target);
    };
}