# 🦆 DuckDB TinyORM

A lightweight, TypeScript-friendly ORM designed specifically for DuckDB, focusing on simplicity and ease of use.

## 📋 Table of Contents

- [🦆 DuckDB TinyORM](#-duckdb-tinyorm)
  - [📋 Table of Contents](#-table-of-contents)
  - [📥 Installation](#-installation)
    - [🧩 Supported DuckDB Version](#-supported-duckdb-version)
    - [⬆️ Upgrading from 3.x (DuckDB 1.x) to 4.x (DuckDB 2.0 LTS)](#️-upgrading-from-3x-duckdb-1x-to-4x-duckdb-20-lts)
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
  - [⚡ DuckDB Appender (High-Performance Batch Insert)](#-duckdb-appender-high-performance-batch-insert)
    - [High-Level: `appendEntities` (recommended)](#high-level-appendentities-recommended)
    - [Low-Level: Manual Appender Control](#low-level-manual-appender-control)
    - [Helper Functions: `appendValue` \& `appendEntity`](#helper-functions-appendvalue--appendentity)
    - [When to Use Appender vs `saveAll`](#when-to-use-appender-vs-saveall)
  - [🧠 Advanced Usage](#-advanced-usage)
    - [🛠️ Custom Repositories](#️-custom-repositories)
    - [⚙️ DuckDB Database Configuration](#️-duckdb-database-configuration)
  - [📘 API Reference](#-api-reference)
    - [🏷️ Decorators](#️-decorators)
    - [🔙 Legacy Decorators (backward compatibility)](#-legacy-decorators-backward-compatibility)
    - [🧰 Repository Methods](#-repository-methods)
    - [⚡ Appender Helpers](#-appender-helpers)
  - [🧪 Development \& Testing](#-development--testing)
  - [📜 License](#-license)

## 📥 Installation

```bash
npm install duckdb-tinyorm
# or
yarn add duckdb-tinyorm
```

DuckDB TinyORM requires `reflect-metadata` and the DuckDB Node-API for decorator support:

```bash
npm install reflect-metadata @duckdb/node-api@^2.0.0-r.1
# or
yarn add reflect-metadata @duckdb/node-api@^2.0.0-r.1
```

Make sure to import `reflect-metadata` at the beginning of your application:

```typescript
import 'reflect-metadata';
```

### 🧩 Supported DuckDB Version

| duckdb-tinyorm | `@duckdb/node-api` (peer) | DuckDB engine |
|---|---|---|
| **4.x** | `^2.0.0-r.1` | **2.0.0 LTS** |
| 3.x | `^1.5.3-r.2` | 1.5.x |

### ⬆️ Upgrading from 3.x (DuckDB 1.x) to 4.x (DuckDB 2.0 LTS)

The ORM's public API is unchanged. Upgrade both packages together:

```bash
npm install duckdb-tinyorm@^4 @duckdb/node-api@^2.0.0-r.1
```

Things to be aware of:

- **Storage format:** database files written by DuckDB 2.0 cannot be opened by DuckDB 1.x clients. DuckDB 2.0 can still open files created by 1.x. Back up file-based databases before upgrading if you need to roll back.
- **ICU extension:** ICU is no longer built into DuckDB core. If you use time zones or collations, run `INSTALL icu; LOAD icu;` via `executeQuery`.
- **`DuckDbConfig.options` is now applied:** options are passed to `DuckDBInstance.create()` as DuckDB configuration settings. In 3.x they were silently ignored, so check any options you already pass (e.g. `{ threads: '4' }`).
- **`removeAll()` resets auto-increment sequences** with `setval()`. Previously the reset failed silently because DuckDB won't drop a sequence that a column default depends on, so ids kept counting up.
- **`MigrationRunner`** now generates migration ids from a sequence (`seq_<table>_id`). Before, recording a migration failed with a `NOT NULL constraint failed: migrations.id` error. Migration tables created by 3.x still work.
- **Appender type mapping:** unsigned integer types (`UTINYINT`, `USMALLINT`, `UINTEGER`, `UBIGINT`, `UHUGEINT`), `FLOAT`, parameterized types such as `DECIMAL(10,2)`, and JS `Date` values for `DATE`, `TIMESTAMP` and `TIMESTAMPTZ` columns are now appended with the correct typed method.
- **New helper:** `DuckDbRepository.resetSequence(name, startValue = 1)`. `sequenceExists()` now uses `duckdb_sequences()`; it always returned `false` before because `information_schema.sequences` doesn't exist.

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
- 🔄 **Promise-based API**: Uses the new native Promise support in DuckDB Node-API
- ⚡ **DuckDB Appender**: High-performance batch insertion using DuckDB's native Appender API

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

## ⚡ DuckDB Appender (High-Performance Batch Insert)

The DuckDB [Appender API](https://duckdb.org/docs/data/appender.html) provides the fastest way to bulk-load data into a table. It bypasses SQL parsing entirely and uses DuckDB's native binary ingestion path, making it significantly faster than `saveAll` for large datasets.

> **Note:** The Appender API does **not** support sequence-based auto-increment defaults. All column values — including primary keys — must be provided by the caller. Use `saveAll` when you need auto-generated IDs.

### High-Level: `appendEntities` (recommended)

The simplest way to use the appender — just pass an array of entities to your repository:

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

@Entity({ name: 'events' })
class Event {
  @Column({ type: 'INTEGER', primaryKey: true })
  Id!: number;

  @Column({ type: 'VARCHAR', notNull: true })
  Type!: string;

  @Column({ type: 'DOUBLE' })
  Value!: number;

  constructor(id: number = 0, type: string = '', value: number = 0) {
    this.Id = id;
    this.Type = type;
    this.Value = value;
  }
}

@Repository(Event)
class EventRepository extends BaseRepository<Event, number> {
  constructor(db: DuckDbRepository) {
    super(db);
  }
}

async function main() {
  const db = await DuckDbRepository.getInstance({
    name: 'default',
    location: DuckDbLocation.Memory
  });

  const eventRepo = new EventRepository(db);
  await eventRepo.init();

  // Build a large batch
  const events: Event[] = [];
  for (let i = 1; i <= 100_000; i++) {
    events.push(new Event(i, i % 2 === 0 ? 'click' : 'view', Math.random() * 100));
  }

  // Bulk insert via the appender — much faster than saveAll for large arrays
  await eventRepo.appendEntities(events);

  const all = await eventRepo.findAll();
  console.log(`Inserted ${all.length} events`);
}

main();
```

`appendEntities` will:
1. Create an appender for the entity's table.
2. Iterate over every entity using `@Column({ type })` metadata to pick the correct typed append method.
3. Flush the appender on success and always close it (even on error).

### Low-Level: Manual Appender Control

For scenarios where you need full control (e.g., streaming rows, mixing sources, or custom column ordering), use the appender directly:

```typescript
import { DuckDbRepository, DuckDbLocation, DuckDBAppender } from 'duckdb-tinyorm';

async function main() {
  const db = await DuckDbRepository.getInstance({
    name: 'default',
    location: DuckDbLocation.Memory
  });

  // Create the table first
  await db.executeQuery(`
    CREATE TABLE IF NOT EXISTS events (
      Id INTEGER PRIMARY KEY,
      Type VARCHAR NOT NULL,
      Value DOUBLE
    )
  `);

  // Get a raw appender
  const appender: DuckDBAppender = await db.createAppender('events');

  appender.appendInteger(1);
  appender.appendVarchar('click');
  appender.appendDouble(42.5);
  appender.endRow();

  appender.appendInteger(2);
  appender.appendVarchar('view');
  appender.appendDouble(17.3);
  appender.endRow();

  // Flush & close (flushSync writes pending rows; closeSync releases the appender)
  appender.flushSync();
  appender.closeSync();

  const rows = await db.executeQuery('SELECT * FROM events');
  console.table(rows);
}

main();
```

### Helper Functions: `appendValue` & `appendEntity`

Two utility functions are exported for building custom appender workflows:

```typescript
import { appendValue, appendEntity, DuckDBAppender } from 'duckdb-tinyorm';

// appendValue — maps a single JS value to the right typed append method
appendValue(appender, 42);            // appendInteger
appendValue(appender, 'hello');       // appendVarchar
appendValue(appender, 3.14);          // appendDouble
appendValue(appender, true);          // appendBoolean
appendValue(appender, BigInt(999));   // appendBigInt
appendValue(appender, null);          // appendNull

// Override the inferred method via an explicit SQL type:
appendValue(appender, 7, 'SMALLINT'); // appendSmallInt
appendValue(appender, 7, 'DOUBLE');   // appendDouble
appendValue(appender, 200, 'UTINYINT');           // appendUTinyInt
appendValue(appender, 19.99, 'DECIMAL(10,2)');    // appendDouble (cast to DECIMAL by DuckDB)
appendValue(appender, new Date(), 'TIMESTAMP');   // appendTimestamp
appendValue(appender, new Date(), 'DATE');        // appendDate (UTC)

// appendEntity — appends all decorated columns of an entity + calls endRow()
appendEntity(appender, event, Event);

// Pre-compute property names outside the loop for maximum throughput:
const props = Object.getOwnPropertyNames(new Event());
for (const e of events) {
  appendEntity(appender, e, Event, props);
}
```

### When to Use Appender vs `saveAll`

| Feature | `saveAll` | `appendEntities` / Appender |
|---|---|---|
| Auto-increment PKs | ✅ Supported | ❌ Must supply all values |
| Speed (large batches) | Moderate (SQL parsing) | ⚡ Fast (binary ingestion) |
| SQL constraints evaluated | Per-statement | At flush time |
| Best for | Small-to-medium inserts, auto-IDs | Large bulk loads, ETL, analytics |

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
  filename: './data/mydb.db',
  options: {
    threads: '4'
  }
});
```

`options` are passed straight to `DuckDBInstance.create()` as [DuckDB configuration settings](https://duckdb.org/docs/stable/configuration/overview) (string values), e.g. `threads`, `memory_limit`, `access_mode`.

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
- ⚡ `appendEntities(entities)`: High-performance bulk insert via the DuckDB Appender API

### ⚡ Appender Helpers

- `appendValue(appender, value, sqlType?)`: Maps a JS value to the correct typed appender method
- `appendEntity(appender, entity, classType, propertyNames?)`: Appends all decorated columns and calls `endRow()`
- `createAppender(tableName, schema?, catalog?)`: Creates a raw `DuckDBAppender` (on `DuckDbRepository`)

### 🔢 Sequence Helpers (on `DuckDbRepository`)

- `sequenceExists(name)`: Checks whether a sequence exists (via `duckdb_sequences()`)
- `resetSequence(name, startValue = 1)`: Rewinds a sequence so the next `nextval()` returns `startValue`
- `dropSequence(name)`: Drops a sequence (fails if a column default still depends on it)

## 🧪 Development & Testing

The compatibility test suite uses Node's built-in test runner. It runs every scenario (repository init, CRUD, transactions, migration apply/revert, appender inserts) in both in-memory and file-based database modes:

```bash
npm install
npm test        # type-check + run tests/memory.test.ts and tests/file.test.ts
npm run build
```

## 📜 License

MIT
