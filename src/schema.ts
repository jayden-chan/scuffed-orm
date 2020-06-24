import { EnumType, Table, TSSQLType } from "./psql_types";
import { newlinePad, toPascalCase, toCamelCase } from "./util";

type PTSchemaOptions = {
  typeScriptIndent: number;
  sqlIndent: number;
};

export default class PTSchema {
  tables: Set<Table> = new Set();
  extensions: Set<string> = new Set();
  options: PTSchemaOptions;

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
   * Add a table to the database
   *
   * @param {Table} table The table to add
   */
  addTable(table: Table): void {
    const validationResult = this.validate(table);
    if (validationResult) {
      throw new Error(validationResult);
    }

    this.tables.add(table);
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
        return `CREATE EXTENSION IF NOT EXISTS ${extension};`;
      })
      .join("\n");

    const seenTypes = new Set();
    const typeDefs = [...this.tables]
      .map((table) => {
        return table.columns
          .filter(
            (c) =>
              c.type.key === "UserDefinedType" && !seenTypes.has(c.type.key)
          )
          .map((column) => {
            seenTypes.add(column.type.key);
            return this.genSQLType(column.type);
          })
          .join("\n");
      })
      .join("\n")
      .trim();

    const tableDefs = [...this.tables]
      .map((table) => {
        let tableString = `CREATE TABLE ${table.title} `;

        tableString += "(\n";
        tableString += table.columns
          .map((column) => {
            return `${this.sqlIndent()}${column.name} ${column.type.sqlName}${
              column.nullable ? "" : " NOT NULL"
            }`;
          })
          .join(",\n");

        if (table.pKeys.size > 0) {
          tableString += `,\n\n${this.sqlIndent()}PRIMARY KEY (${[
            ...table.pKeys,
          ].join(", ")})`;
        }

        if (table.fKeys.length > 0) {
          tableString += `,\n`;
          tableString += [...table.fKeys]
            .map((fKey) => {
              return `${this.sqlIndent()}FOREIGN KEY (${
                fKey.localCol
              }) REFERENCES ${fKey.foreignTable} (${fKey.foreignCol})`;
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
    const customTypeDefs = [...this.tables]
      .map((table) => {
        return table.columns
          .filter(
            (c) =>
              c.type.key === "UserDefinedType" && !seenTypes.has(c.type.key)
          )
          .map((column) => {
            seenTypes.add(column.type.key);
            return this.genTypeScriptType(column.type);
          })
          .join("\n");
      })
      .join("\n")
      .trim();

    const tableTypeDefs = [...this.tables]
      .map((table) => {
        let typeString = `export type ${table.typeName}`;
        typeString += " = {\n";

        typeString += table.columns
          .map((column) => {
            return `${this.tsIndent()}${toCamelCase(column.name)}: ${
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
    const seenColumns = new Set();
    const seenFkeys = new Set();

    for (const { name } of table.columns) {
      if (seenColumns.has(name)) {
        return `Duplicate column "${name}" in table ${table.title}`;
      }

      seenColumns.add(name);
    }

    for (const fKey of table.fKeys) {
      if (!this.columnExists(table, fKey.localCol)) {
        return `Local column "${fKey.localCol}" not found for table "${table.title}"`;
      }

      if (seenFkeys.has(fKey.localCol)) {
        return `Duplicate foreign key "${fKey.localCol}" found in table "${table.title}"`;
      }

      seenFkeys.add(fKey.localCol);

      if (
        ![...this.tables]
          .filter((t) => t.title !== table.title)
          .some((t) => {
            return (
              t.title === fKey.foreignTable &&
              this.columnExists(t, fKey.foreignCol)
            );
          })
      ) {
        return `No foreign table with title "${fKey.foreignTable}" and column "${fKey.foreignCol}" exists`;
      }
    }

    if (table.pKeys.size === 0) {
      return `Table "${table.title}" must have a primary key`;
    }

    for (const pKey of table.pKeys) {
      if (!this.columnExists(table, pKey)) {
        return `Table "${table.title}" is missing column "${pKey}" for primary key constraint`;
      }
    }
  }

  private validateAll() {
    for (const table of this.tables) {
      const validationError = this.validate(table);
      if (validationError) {
        throw new Error(
          `Error while validating table ${table.title}:\n${validationError}\n`
        );
      }
    }
  }

  private columnExists(table: Table, name: string): boolean {
    return table.columns.some((col) => col.name === name);
  }

  private tsIndent(): string {
    return " ".repeat(this.options.typeScriptIndent);
  }

  private sqlIndent(): string {
    return " ".repeat(this.options.sqlIndent);
  }
}
