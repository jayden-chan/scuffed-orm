import { EnumType, Table, TSSQLType } from "./psql_types";
import { newlinePad, toPascalCase, toCamelCase } from "./util";

type PTSchemaOptions = {
  typeScriptIndent: number;
  sqlIndent: number;
};

export default class PTSchema {
  tables: Table[] = [];
  extensions: Set<string> = new Set();
  options: PTSchemaOptions;
  customTypes: { [key: string]: TSSQLType } = {};

  constructor(options?: Partial<PTSchemaOptions>) {
    this.options = {
      sqlIndent: options?.sqlIndent ?? 2,
      typeScriptIndent: options?.typeScriptIndent ?? 2,
    };
  }

  /**
   * Add a PostgreSQL extension to the schema
   *
   * @param {string} extension The name of the extension to add
   */
  extension(extension: string) {
    this.extensions.add(extension);
  }

  /**
   * Add a table to the schema
   *
   * @param {Table} table The table to add
   */
  addTable(table: Table): void {
    if (this.tables.some((t) => t.name === table.name)) {
      throw new Error(`Table with name "${table.name}" already exists`);
    }

    table.primaryKeys = [...new Set(table.primaryKeys)];
    const validationResult = this.validate(table);
    if (validationResult) {
      throw new Error(validationResult);
    }

    Object.entries(table.columns)
      .filter(([, col]) => col.type.key === "UserDefinedType")
      .forEach(([, col]) => (this.customTypes[col.type.sqlName] = col.type));

    this.tables.push(table);
  }

  /**
   * Add multiple tables to the schema
   *
   * @param {Table[]} tables The tables to add
   */
  addTables(tables: Table[]): void {
    tables.forEach((t) => this.addTable(t));
  }

  /**
   * Generates SQL CREATE statements to initialize the database
   *
   * @return {string} The SQL schema
   */
  generateSQLSchema(): string {
    this.validateAll();

    const extensions = [...this.extensions]
      .map((extension) => {
        return `CREATE EXTENSION IF NOT EXISTS "${extension}";`;
      })
      .join("\n");

    const typeDefs = Object.values(this.customTypes)
      .map((type) => this.genSQLType(type))
      .join("\n")
      .trim();

    const tableDefs = this.tables
      .map((table) => {
        let tableString = `CREATE TABLE IF NOT EXISTS ${table.name} `;

        tableString += "(\n";
        tableString += Object.entries(table.columns)
          .map(([name, column]) => {
            const indent = this.sqlIndent();
            const sqlName = column.type.sqlName;
            const nullable = column.nullable ? "" : " NOT NULL";

            const defaultString = column.default
              ? column.default.key === "value"
                ? typeof column.default.value === "string"
                  ? ` DEFAULT "${column.default.value}"`
                  : ` DEFAULT ${column.default.value}`
                : ` DEFAULT ${column.default.value}`
              : "";

            return `${indent}${name} ${sqlName}${nullable}${defaultString}`;
          })
          .join(",\n");

        if (table.primaryKeys.length > 0) {
          tableString += `,\n\n${this.sqlIndent()}PRIMARY KEY (${[
            ...table.primaryKeys,
          ].join(", ")})`;
        }

        if (table.foreignKeys && Object.keys(table.foreignKeys).length > 0) {
          tableString += `,\n`;
          tableString += Object.entries(table.foreignKeys)
            .map(([col, fKey]) => {
              return `${this.sqlIndent()}FOREIGN KEY (${col}) REFERENCES ${
                fKey.table
              } (${fKey.column})`;
            })
            .join(",\n");
        }

        tableString += "\n);";
        return tableString;
      })
      .join("\n\n")
      .trim();

    return `${newlinePad(extensions)}${newlinePad(typeDefs)}${tableDefs}`;
  }

  /**
   * Generates TypeScript types for the schema
   *
   * @return {string} The TypeScript types
   */
  generateTypeScript(): string {
    this.validateAll();

    const seenTypes = new Set();
    const customTypeDefs = this.tables
      .map((table) => {
        return Object.values(table.columns)
          .filter((c) => {
            if (
              c.type.key === "UserDefinedType" &&
              !seenTypes.has(c.type.sqlName)
            ) {
              seenTypes.add(c.type.sqlName);
              return true;
            }
            return false;
          })
          .map((column) => {
            seenTypes.add(column.type.key);
            return this.genTypeScriptType(column.type);
          })
          .join("\n\n");
      })
      .join("\n\n")
      .trim();

    const tableTypeDefs = this.tables
      .map((table) => {
        let typeString = `export type ${table.typeName}`;
        typeString += " = {\n";

        typeString += Object.entries(table.columns)
          .map(([name, column]) => {
            return `${this.tsIndent()}${toCamelCase(name)}: ${
              column.type.typeScriptName
            };`;
          })
          .join("\n");

        typeString += "\n};";

        return typeString;
      })
      .join("\n\n");

    return `${newlinePad(customTypeDefs)}${tableTypeDefs}`;
  }

  private genSQLType(customType: TSSQLType): string {
    if ((customType as EnumType).values) {
      return `CREATE TYPE ${customType.sqlName} AS ENUM (${[
        ...(customType as EnumType).values,
      ]
        .map((t) => `'${t}'`)
        .join(", ")});`;
    }

    throw new Error("Provided type is not a custom type");
  }

  private genTypeScriptType(customType: TSSQLType): string {
    if ((customType as EnumType).values) {
      return `export enum ${customType.typeScriptName} {\n${[
        ...(customType as EnumType).values,
      ]
        .map((v) => `${this.tsIndent()}${toPascalCase(v)},`)
        .join("\n")}\n}`;
    }

    throw new Error("Provided type is not a custom type");
  }

  private validate(table: Table): string | undefined {
    const columns = new Set();
    const fKeys = new Set();

    for (const name of Object.keys(table.columns)) {
      if (columns.has(name)) {
        return `Duplicate column "${name}" in table ${table.name}`;
      }

      columns.add(name);
    }

    if (table.primaryKeys.length === 0) {
      return `Table "${table.name}" must have a primary key`;
    }

    for (const key of table.primaryKeys) {
      if (!this.columnExists(table, key)) {
        return `Table "${table.name}" is missing column "${key}" for primary key constraint`;
      }
    }

    if (table.foreignKeys) {
      for (const [col, key] of Object.entries(table.foreignKeys)) {
        const localCol = table.columns[col];
        if (!localCol) {
          return `Local column "${col}" not found for table "${table.name}"`;
        }

        if (fKeys.has(col)) {
          return `Duplicate foreign key "${col}" found in table "${table.name}"`;
        }

        fKeys.add(col);

        const foreignTable = this.tables
          .filter((t) => t.name !== table.name)
          .find((t) => {
            return (
              t.name === key.table &&
              this.columnExists(t, key.column)
            );
          });

        if (!foreignTable) {
          return `No foreign table with title "${key.table}" and column "${key.column}" exists`;
        }

        if (foreignTable.columns[key.column]?.type !== localCol.type) {
          return `Column type mismatch on foreign key "${col}" in table "${table.name}"`;
        }
      }
    }
  }

  private validateAll() {
    const tables = new Set();
    for (const table of this.tables) {
      if (tables.has(table.name)) {
        throw new Error(`Table "${table.name}" already exists.`);
      }

      tables.add(table.name);

      const validationError = this.validate(table);
      if (validationError) {
        throw new Error(
          `Error while validating table ${table.name}:\n${validationError}\n`
        );
      }
    }
  }

  private columnExists(table: Table, name: string): boolean {
    return table.columns[name] !== undefined;
  }

  private tsIndent(): string {
    return " ".repeat(this.options.typeScriptIndent);
  }

  private sqlIndent(): string {
    return " ".repeat(this.options.sqlIndent);
  }
}
