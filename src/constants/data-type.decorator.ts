/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';

export function DataTypeDecorator(dataType: string): PropertyDecorator {
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
            // If the property doesn't exist, create it with the specified data type
            Object.defineProperty(target, propertyKey, {
                value: propertyValue,
                writable: true,
                enumerable: true,
                configurable: true,
            });
        }

        // Set the data type as metadata using Reflect.defineMetadata
        Reflect.defineMetadata('FieldType', dataType, target, propertyKey);
    };
}


export function Id(): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        Reflect.defineMetadata('PrimaryKey', true, target, propertyKey);
    };
}

export function Unique(): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        Reflect.defineMetadata('Unique', true, target, propertyKey);
    };
}


export function Entity(target: Function) {
    // Add metadata to the class using the 'entityType' key
    Reflect.defineMetadata('entityType', target, target);
}

// Apply this decorator to the repository class, not the entity
export function Repository(entity: new () => any) {
    return function (target: Function) {
        Reflect.defineMetadata('entityType', entity, target);
    };
}