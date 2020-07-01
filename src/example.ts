import PTSchema from "./index";
import { TSSQLTypes } from "./index";

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
