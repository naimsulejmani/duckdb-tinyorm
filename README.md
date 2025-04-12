# 🦆 DuckDB TinyORM

A lightweight, TypeScript-friendly ORM designed specifically for DuckDB, focusing on simplicity and ease of use.

## 📋 Table of Contents

- [🦆 DuckDB TinyORM](#-duckdb-tinyorm)
  - [📋 Table of Contents](#-table-of-contents)
  - [📥 Installation](#-installation)
  - [🚀 Quick Start](#-quick-start)
  - [✨ Core Features](#-core-features)
  - [🏗️ Entity Definition](#️-entity-definition)
    - [🔧 Column Options](#-column-options)
  - [📚 Repository Pattern](#-repository-pattern)
  - [💾 Data Operations](#-data-operations)
    - [✏️ Create](#️-create)
    - [🔍 Read](#-read)
    - [🔄 Update](#-update)
    - [🗑️ Delete](#️-delete)
  - [🔧 Query Builder](#-query-builder)
  - [🔒 Transactions](#-transactions)
  - [📊 Data Export](#-data-export)
  - [🧠 Advanced Usage](#-advanced-usage)
    - [🛠️ Custom Repositories](#️-custom-repositories)
    - [⚙️ DuckDB Database Configuration](#️-duckdb-database-configuration)
  - [📘 API Reference](#-api-reference)
    - [🏷️ Decorators](#️-decorators)
    - [🔙 Legacy Decorators (backward compatibility)](#-legacy-decorators-backward-compatibility)
    - [🧰 Repository Methods](#-repository-methods)
  - [📜 License](#-license)

## 📥 Installation

```bash
npm install duckdb-tinyorm
# or
yarn add duckdb-tinyorm
```

DuckDB TinyORM requires `reflect-metadata` for decorator support:

```bash
npm install reflect-metadata
# or
yarn add reflect-metadata
```

Make sure to import `reflect-metadata` at the beginning of your application:

```typescript
import 'reflect-metadata';
```

## 🚀 Quick Start

```typescript
import 'reflect-metadata';
import { 
  DuckDbRepository, 
  Entity, 
  Column, 
  Repository, 
  BaseRepository, 
  DuckDbLocation 
} from 'duckdb-tinyorm';

// Initialize DuckDB repository (in-memory)
const duckDbRepository = DuckDbRepository.getInstances({
  name: 'default',
  location: DuckDbLocation.Memory
});

// Define your entity
@Entity({ name: 'products' })
class Product {
  @Column({
    type: 'INTEGER',
    primaryKey: true,
    autoIncrement: true
  })
  Id!: number;
  
  @Column({
    type: 'VARCHAR',
    notNull: true
  })
  Name!: string;
  
  @Column({
    type: 'DOUBLE',
    notNull: true
  })
  Price!: number;
  
  constructor(name: string = "", price: number = 0) {
    this.Name = name;
    this.Price = price;
  }
}

// Create a repository for your entity
@Repository(Product)
class ProductRepository extends BaseRepository<Product, number> {
  constructor() {
    super(duckDbRepository);
  }
}

// Use the repository
async function main() {
  const productRepo = new ProductRepository();
  await productRepo.init(); // Initialize the repository (creates the table)
  
  // Create and save a new product
  const product = new Product("Laptop", 999.99);
  const savedProduct = await productRepo.save(product);
  console.log(`Created product with ID: ${savedProduct.Id}`);
  
  // Query products
  const allProducts = await productRepo.findAll();
  console.table(allProducts);
}

main();
```

## ✨ Core Features

- 🚀 **Modern TypeScript Support**: Full TypeScript integration with decorators
- 🗃️ **Entity-Relationship Mapping**: Map your classes to DuckDB tables
- 📚 **Repository Pattern**: Type-safe data access operations
- 📝 **SQL Generation**: Automatic SQL query generation
- 🔒 **Transaction Support**: ACID-compliant transaction handling
- 🔍 **Query Builder**: Fluent API for building complex queries
- 📊 **Data Export**: Export data to CSV, JSON, and Parquet formats
- 📄 **Pagination**: Built-in support for paginating large datasets

## 🏗️ Entity Definition

Entities represent tables in your database. Use decorators to define your entity schema:

```typescript
@Entity({ name: 'subjects' }) // Optional table name (defaults to class name)
export class Subject {
  @Column({
    type: 'INTEGER',
    primaryKey: true,
    autoIncrement: true
  })
  Id!: number;

  @Column({
    type: 'VARCHAR',
    notNull: true,
    unique: true
  })
  Code!: string;

  @Column({
    type: 'VARCHAR',
    notNull: true
  })
  Name!: string;

  @Column({
    type: 'TEXT'
  })
  Description?: string;

  @Column({
    type: 'INT',
    defaultValue: new Date().getFullYear(),
    check: 'Year >= 2000'
  })
  Year!: number;

  constructor(code: string = "", name: string = "", description?: string, year: number = new Date().getFullYear()) {
    this.Code = code;
    this.Name = name;
    this.Description = description;
    this.Year = year;
  }
}
```

### 🔧 Column Options

- 📊 `type`: SQL data type ('INTEGER', 'VARCHAR', 'DOUBLE', etc.)
- 🔑 `primaryKey`: Defines a primary key column
- 🔢 `autoIncrement`: Auto-increments the column value
- ⚠️ `notNull`: Adds NOT NULL constraint
- 🎯 `unique`: Adds UNIQUE constraint
- 🏷️ `defaultValue`: Sets a default value
- ✅ `check`: Adds a CHECK constraint

## 📚 Repository Pattern

Repositories provide data access operations for entities:

```typescript
@Repository(Subject)
class SubjectRepository extends BaseRepository<Subject, number> {
  constructor() {
    super(duckDbRepository);
  }
  
  // Add custom methods specific to this entity
  async findByCode(code: string): Promise<Subject | null> {
    const query = `SELECT * FROM main.${this.tableName} WHERE Code='${code}'`;
    const result = await this.repository.executeQuery(query);
    return result.length > 0 ? result[0] : null;
  }
}
```

## 💾 Data Operations

### ✏️ Create

```typescript
const subject = new Subject('CS101', 'Computer Science', 'Introduction to CS', 2024);
const savedSubject = await subjectRepository.save(subject);
console.log(`Created with ID: ${savedSubject.Id}`);

// Bulk insert
const subjects = [
  new Subject('CS102', 'Data Structures', 'Advanced data structures', 2024),
  new Subject('CS103', 'Algorithms', 'Algorithm design', 2024)
];
await subjectRepository.saveAll(subjects);
```

### 🔍 Read

```typescript
// Find by ID
const subject = await subjectRepository.findById(1);

// Find all
const allSubjects = await subjectRepository.findAll();

// Find with criteria
const subjects2024 = await subjectRepository.findBy({ Year: 2024 }, ["Year"]);

// Pagination
const page = await subjectRepository.findWithPagination({ page: 0, size: 10 });
console.log(`Found ${page.totalElements} subjects across ${page.totalPages} pages`);
```

### 🔄 Update

```typescript
subject.Description = "Updated description";
await subjectRepository.save(subject);
```

### 🗑️ Delete

```typescript
// Delete by ID
await subjectRepository.removeById(1);

// Custom delete method
await subjectRepository.removeByCode("CS101");

// Delete all
await subjectRepository.removeAll();
```

## 🔧 Query Builder

Build complex queries with the fluent query builder API:

```typescript
const queryBuilder = await subjectRepository.createQueryBuilder();
const query = queryBuilder
  .select(['Id', 'Name', 'Year'])
  .where('Year = 2024')
  .andWhere('Name LIKE \'%Science%\'')
  .orderBy('Name', 'ASC')
  .limit(5)
  .offset(10)
  .getQuery();

const results = await duckDbRepository.executeQuery(query);
```

## 🔒 Transactions

Handle multiple operations in a transaction:

```typescript
await subjectRepository.withTransaction(async (transaction) => {
  const subject1 = new Subject('MATH101', 'Mathematics', 'Basic math', 2024);
  const subject2 = new Subject('PHYS101', 'Physics', 'Basic physics', 2024);
  
  await subjectRepository.save(subject1);
  await subjectRepository.save(subject2);
  
  // If any operation throws an error, the transaction will roll back
  // Otherwise, it will commit automatically
});
```

## 📊 Data Export

Export your data to various formats:

```typescript
// Export table to CSV
await subjectRepository.exportData({
  format: 'csv',
  fileName: 'subjects.csv',
  csvOptions: {
    header: true,
    delimiter: ','
  }
});

// Export query results to JSON
const query = `SELECT * FROM main.subjects WHERE Year = 2024`;
await subjectRepository.exportQuery(query, {
  format: 'json',
  fileName: 'subjects-2024.json',
  jsonOptions: {
    pretty: true
  }
});

// Export table to Parquet
await duckDbRepository.exportTable('subjects', {
  format: 'parquet',
  fileName: 'subjects.parquet',
  parquetOptions: {
    compression: 'ZSTD'
  }
});
```

## 🧠 Advanced Usage

### 🛠️ Custom Repositories

Extend the base repository with custom methods:

```typescript
@Repository(Subject)
class SubjectRepository extends BaseRepository<Subject, number> {
  constructor() {
    super(duckDbRepository);
  }
  
  async findByCodeAndYear(code: string, year: number): Promise<Subject | null> {
    const query = `SELECT * FROM main.${this.tableName} WHERE Code='${code}' AND Year=${year}`;
    const result = await this.repository.executeQuery(query);
    return result.length > 0 ? result[0] : null;
  }
  
  async findActive(): Promise<Subject[]> {
    const currentYear = new Date().getFullYear();
    return this.findBy({ Year: currentYear }, ["Year"]);
  }
}
```

### ⚙️ DuckDB Database Configuration

```typescript
// In-memory database
const inMemoryDb = DuckDbRepository.getInstances({
  name: 'default',
  location: DuckDbLocation.Memory
});

// File-based database
const fileDb = DuckDbRepository.getInstances({
  name: 'production',
  location: DuckDbLocation.File,
  filename: './data/mydb.db'
});
```

## 📘 API Reference

### 🏷️ Decorators

- 🏢 `@Entity(options?)`: Defines a class as an entity
- 📝 `@Column(options)`: Defines a property as a column
- 🗂️ `@Repository(entityClass)`: Defines a repository for an entity

### 🔙 Legacy Decorators (backward compatibility)

- 📋 `@DataTypeDecorator(type)`: Defines a column type `@Column()`
- 🔑 `@Id()`: Defines a primary key
- 🎯 `@Unique()`: Adds a unique constraint
- ⚠️ `@NotNull()`: Adds a NOT NULL constraint
- 🏷️ `@Default(value)`: Sets a default value
- ✅ `@Check(constraint)`: Adds a CHECK constraint
- 🔢 `@AutoIncrement()`: Sets column as auto-increment

### 🧰 Repository Methods

- 🚀 `init()`: Initializes the repository and creates the table
- 💾 `save(entity)`: Saves an entity (insert or update)
- 📦 `saveAll(entities)`: Saves multiple entities
- 📋 `findAll()`: Retrieves all entities
- 🔍 `findById(id)`: Retrieves an entity by ID
- ⚡ `findByIdOrThrow(id)`: Retrieves an entity by ID or throws an error
- 🔎 `findBy(criteria, columns)`: Retrieves entities matching criteria
- 📄 `findWithPagination(pageable)`: Retrieves entities with pagination
- 🗑️ `removeById(id)`: Deletes an entity by ID
- 🧹 `removeAll()`: Deletes all entities
- 🔧 `createQueryBuilder()`: Creates a query builder
- 🔄 `withTransaction(callback)`: Executes operations within a transaction
- 📊 `exportData(options)`: Exports table data
- 📈 `exportQuery(query, options)`: Exports query results

## 📜 License

MIT
