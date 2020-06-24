# Scuffed ORM

A really bad ORM for TypeScript and PostgreSQL

## Usage
Simple example:
```typescript
import PTSchema from "scuffed-orm";
import { Timestamp, SmallInt, Enum, Text } from "scuffed-orm";

const schema = new PTSchema();

schema.extension("pgcrypto");

const CustomerType = Enum({
  name: "customer_type",
  values: new Set(["hobby", "professional", "enterprise"]),
});

schema.addTable({
  title: "customers",
  typeName: "Customer",
  columns: [
    {
      name: "name",
      type: Text,
      nullable: false,
    },
    {
      name: "date_registered",
      type: Timestamp,
      nullable: false,
    },
    {
      name: "type",
      type: CustomerType,
      nullable: false,
    },
    {
      name: "email",
      type: Text,
      nullable: true,
    },
    {
      name: "num_purchases",
      type: SmallInt,
      nullable: false,
    },
  ],
  pKeys: new Set(["name"]),
  fKeys: [],
});

console.log(schema.generateSQL());
console.log();
console.log(schema.generateTypescript());
```
Would output the following SQL and TypeScript:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE customer_type AS ENUM ('hobby', 'professional', 'enterprise');

CREATE TABLE customers (
  name TEXT NOT NULL,
  date_registered TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  type customer_type NOT NULL,
  email TEXT,
  num_purchases SMALLINT NOT NULL,

  PRIMARY KEY (name)
);
```
```typescript
export enum CustomerType {
  Hobby,
  Professional,
  Enterprise,
}

export type Customer = {
  name: string;
  dateRegistered: string;
  type: CustomerType;
  email: string;
  numPurchases: number;
};
```
