import PTSchema from "./schema";
import * as TSSQLTypes from "./psql_types";

export default PTSchema;
export { TSSQLTypes };

const schema = new PTSchema();

schema.extension("uuid-ossp");

const MyType = TSSQLTypes.Enum({
  name: "level",
  values: ["high", "med", "low"],
});

const myTable: TSSQLTypes.Table = {
  name: "tests",
  typeName: "Test",
  columns: {
    my_column: {
      type: TSSQLTypes.UUID,
      default: {
        key: "sql",
        value: "uuid_generate_v4()",
      },
    },
    the_level: {
      type: MyType,
    },
    the_level_again: {
      type: MyType,
    },
  },
  primaryKeys: ["my_column"],
};

schema.addTable(myTable);

console.log(schema.generateSQLSchema());
console.log();
console.log(schema.generateTypeScript());
