# Scuffed ORM

A really bad ORM for TypeScript and PostgreSQL. Actually this isn't even an ORM, it just
generates SQL and TypeScript types from a schema. Too late to change the name now though

## Installation

```
npm install scuffed-orm
```

## Usage
Simple example:
```typescript
import PTSchema from "scuffed-orm";
import { TSSQLTypes } from "scuffed-orm";

const { Enum, SmallInt, Text, Timestamp, UUID } = TSSQLTypes;

const schema = new PTSchema();

schema.extension("pgcrypto");
schema.extension("uuid-ossp");

const CustomerType = Enum({
  name: "customer_type",
  values: ["hobby", "professional", "enterprise"],
});

schema.addTable({
  name: "customers",
  typeName: "Customer",
  columns: {
    id: {
      type: UUID,
      default: {
        type: "raw_sql",
        value: "UUID_GENERATE_V4()",
      },
    },
    name: {
      type: Text,
    },
    date_registered: {
      type: Timestamp,
      default: {
        type: "raw_sql",
        value: "NOW()",
      },
    },
    type: {
      type: CustomerType,
    },
    num_purchases: {
      type: SmallInt,
    },
    email: {
      type: Text,
      nullable: true,
    },
  },
  primaryKeys: ["id"],
});

console.log(schema.generateSQLSchema());
console.log();
console.log(schema.generateTypeScript());
```
Would output the following SQL and TypeScript:
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE customer_type AS ENUM ('hobby', 'professional', 'enterprise');

CREATE TABLE IF NOT EXISTS customers (
  id UUID NOT NULL DEFAULT UUID_GENERATE_V4(),
  name TEXT NOT NULL,
  date_registered TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  type customer_type NOT NULL,
  num_purchases SMALLINT NOT NULL,
  email TEXT,

  PRIMARY KEY (id)
);
```
```typescript
export enum CustomerType {
  Hobby,
  Professional,
  Enterprise,
}

export type Customer = {
  id: string;
  name: string;
  dateRegistered: string;
  type: CustomerType;
  numPurchases: number;
  email?: string;
};
```
