# Scuffed ORM

A really bad ORM for TypeScript and PostgreSQL. Actually this isn't even an ORM, it just
generates SQL and TypeScript types from a schema. Too late to change the name now though

## Installation

```
npm install scuffed-orm
```

## Usage
Full length example:
```typescript
import PTSchema from "scuffed-orm";
import { TSSQLTypes } from "scuffed-orm";

type Table = TSSQLTypes.Table;
const { VarChar, Char, SmallInt } = TSSQLTypes;

const schema = new PTSchema();

const airports: Table = {
  name: "airports",
  typeName: "Airport",
  columns: {
    iata: {
      type: Char(3),
    },
    name: {
      type: VarChar(255),
    },
    country: {
      type: VarChar(255),
    },
  },
  primaryKeys: ["iata"],
  constraints: {
    name_non_zero: "(char_length(name) > 0)",
    country_non_zero: "(char_length(country) > 0)",
    iata_upper_case: "(upper(iata) = iata)",
  },
};

const internationalAirports: Table = {
  name: "intl_airports",
  typeName: "InternationalAirport",
  columns: {
    iata: {
      type: Char(3),
    },
  },
  primaryKeys: ["iata"],
  foreignKeys: [
    {
      table: "airports",
      columns: [
        {
          local: "iata",
          foreign: "iata",
        },
      ],
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
  ],
};

const airlines: Table = {
  name: "airlines",
  typeName: "Airline",
  columns: {
    name: {
      type: VarChar(255),
    },
  },
  primaryKeys: ["name"],
  constraints: {
    name_non_zero: "(char_length(name) > 0)",
  },
};

const aircraftModels: Table = {
  name: "aircraft_models",
  typeName: "AircraftModel",
  columns: {
    name: {
      type: VarChar(255),
    },
    capacity: {
      type: SmallInt,
    },
  },
  primaryKeys: ["name"],
  constraints: {
    name_non_zero: "(char_length(name) > 0)",
    capacity_non_negative: "(capacity >= 0)",
  },
};

const aircraft: Table = {
  name: "aircraft",
  typeName: "Aircraft",
  columns: {
    id: {
      type: VarChar(64),
    },
    owner: {
      type: VarChar(255),
    },
    model: {
      type: VarChar(255),
    },
  },
  primaryKeys: ["id"],
  foreignKeys: [
    {
      table: "airlines",
      columns: [
        {
          local: "owner",
          foreign: "name",
        },
      ],
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    {
      table: "aircraft_models",
      columns: [
        {
          local: "model",
          foreign: "name",
        },
      ],
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
  ],
  constraints: {
    id_alpha_numeric: "(id ~ '^[a-zA-Z0-9]+$')",
    country_non_zero: "(char_length(country) > 0)",
    iata_upper_case: "(upper(iata) = iata)",
  },
};

schema.addTables([
  airports,
  internationalAirports,
  airlines,
  aircraftModels,
  aircraft,
]);

console.log(schema.generateSQLSchema());
console.log();
console.log(schema.generateTypeScript());
```
Would output the following SQL and TypeScript:
```sql
CREATE TABLE airports (
  iata CHAR(3) NOT NULL,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(255) NOT NULL,

  PRIMARY KEY (iata),
  CONSTRAINT name_non_zero CHECK (char_length(name) > 0),
  CONSTRAINT country_non_zero CHECK (char_length(country) > 0),
  CONSTRAINT iata_upper_case CHECK (upper(iata) = iata)
);

CREATE TABLE intl_airports (
  iata CHAR(3) NOT NULL,

  PRIMARY KEY (iata),
  FOREIGN KEY (iata) REFERENCES airports (iata)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE airlines (
  name VARCHAR(255) NOT NULL,

  PRIMARY KEY (name),
  CONSTRAINT name_non_zero CHECK (char_length(name) > 0)
);

CREATE TABLE aircraft_models (
  name VARCHAR(255) NOT NULL,
  capacity SMALLINT NOT NULL,

  PRIMARY KEY (name),
  CONSTRAINT name_non_zero CHECK (char_length(name) > 0),
  CONSTRAINT capacity_non_negative CHECK (capacity >= 0)
);

CREATE TABLE aircraft (
  id VARCHAR(64) NOT NULL,
  owner VARCHAR(255) NOT NULL,
  model VARCHAR(255) NOT NULL,

  PRIMARY KEY (id),
  FOREIGN KEY (owner) REFERENCES airlines (name)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  FOREIGN KEY (model) REFERENCES aircraft_models (name)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT id_alpha_numeric CHECK (id ~ '^[a-zA-Z0-9]+$'),
  CONSTRAINT country_non_zero CHECK (char_length(country) > 0),
  CONSTRAINT iata_upper_case CHECK (upper(iata) = iata)
);
```
```typescript
export type Airport = {
  iata: string;
  name: string;
  country: string;
};

export type InternationalAirport = {
  iata: string;
};

export type Airline = {
  name: string;
};

export type AircraftModel = {
  name: string;
  capacity: number;
};

export type Aircraft = {
  id: string;
  owner: string;
  model: string;
};
```
