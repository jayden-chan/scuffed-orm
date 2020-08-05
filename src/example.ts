import PTSchema from "./index";
import { TSSQLTypes } from "./index";

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
