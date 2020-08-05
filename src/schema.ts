import {
  EnumType,
  Table,
  TSSQLType,
  SchemaValidationErrors,
} from "./psql_types";
import { newlinePad, toCamelCase } from "./util";
import { deepStrictEqual } from "assert";

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
  generateSQLSchema(): SchemaValidationErrors | string {
    const errors = this.validate();
    if (errors !== undefined) {
      return errors;
    }

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
        let tableString = `CREATE TABLE ${table.name} `;

        tableString += "(\n";
        tableString += Object.entries(table.columns)
          .map(([name, column]) => {
            const indent = this.sqlIndent();
            const sqlName = column.type.sqlName;
            const nullable = column.nullable ? "" : " NOT NULL";

            const defaultString = column.default
              ? column.default.type === "value"
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

        if (table.foreignKeys && table.foreignKeys.length > 0) {
          tableString += ",\n";
          tableString += table.foreignKeys
            .map((fKey) => {
              const indent = this.sqlIndent();
              return [
                `${indent}FOREIGN KEY`,
                `(${fKey.columns.map(({ local }) => local).join(", ")})`,
                "REFERENCES",
                fKey.table,
                `(${fKey.columns.map(({ foreign }) => foreign).join(", ")})\n`,
                `${indent} ON DELETE ${fKey.onDelete ?? "NO ACTION"}\n`,
                `${indent} ON UPDATE ${fKey.onUpdate ?? "NO ACTION"}`,
              ].join(" ");
            })
            .join(",\n");
        }

        if (table.constraints && Object.keys(table.constraints).length > 0) {
          tableString += ",\n";
          tableString += Object.entries(table.constraints)
            .map(
              ([name, cons]) =>
                `${this.sqlIndent()}CONSTRAINT ${name} CHECK ${cons}`
            )
            .join(",\n");
        }

        tableString += "\n);";
        return tableString;
      })
      .join("\n\n")
      .trim();

    return `${this.sqlAutoGenNotice(true)}${newlinePad(extensions)}${newlinePad(
      typeDefs
    )}${tableDefs}${this.sqlAutoGenNotice(false)}`;
  }

  /**
   * Generates TypeScript types for the schema
   *
   * @return {string} The TypeScript types
   */
  generateTypeScript(): SchemaValidationErrors | string {
    const errors = this.validate();
    if (errors !== undefined) {
      return errors;
    }

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
            return this.genTypeScriptType(column.type);
          })
          .join("\n\n");
      })
      .filter((t) => t.length > 0)
      .join("\n\n")
      .trim();

    const tableTypeDefs = this.tables
      .map((table) => {
        let typeString = `export type ${table.typeName}`;
        typeString += " = {\n";

        typeString += Object.entries(table.columns)
          .map(([name, column]) => {
            const indent = this.tsIndent();
            const fieldName = toCamelCase(name);
            const typeName = column.type.typeScriptName;
            const nullable = column.nullable ? " | null" : "";
            return `${indent}${fieldName}: ${typeName}${nullable};`;
          })
          .join("\n");

        typeString += "\n};";

        return typeString;
      })
      .join("\n\n");

    return `${this.tsAutoGenNotice(true)}${newlinePad(
      customTypeDefs
    )}${tableTypeDefs}${this.tsAutoGenNotice(false)}`;
  }

  generateDropSQL(): string {
    const dropTables = [...this.tables]
      .reverse()
      .map((t) => `DROP TABLE IF EXISTS ${t.name};`)
      .join("\n");

    const dropTypes = Object.keys(this.customTypes)
      .map((t) => `DROP TYPE IF EXISTS ${t};`)
      .join("\n");

    const dropExtensions = [...this.extensions]
      .map((t) => `DROP EXTENSION IF EXISTS "${t}";`)
      .join("\n");

    return `${dropTables}\n${dropTypes}\n${dropExtensions}`;
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
      const quotedValues = [...(customType as EnumType).values].map(
        (v) => `"${v}"`
      );

      const arrayName = `${customType.typeScriptName}Values`;
      const valuesArray = `export const ${arrayName} = [${quotedValues.join(
        ", "
      )}] as const;`;
      const valuesEnum = `export type ${customType.typeScriptName} = typeof ${arrayName}[number];`;
      return `${valuesArray}\n${valuesEnum}`;
    }

    throw new Error("Provided type is not a custom type");
  }

  private validateTable(table: Table): string[] {
    const columns = new Set();
    const errors = [];

    for (const name of Object.keys(table.columns)) {
      if (columns.has(name)) {
        errors.push(`Duplicate column "${name}" in table ${table.name}`);
      }

      columns.add(name);
    }

    if (table.primaryKeys.length === 0) {
      errors.push(`Table "${table.name}" must have a primary key`);
    }

    for (const key of table.primaryKeys) {
      if (!this.columnExists(table, key)) {
        errors.push(
          `Table "${table.name}" is missing column "${key}" for primary key constraint`
        );
      }
    }

    if (table.foreignKeys) {
      const localColsSeen = new Set();
      table.foreignKeys.forEach((fKey) => {
        fKey.columns.forEach(({ local, foreign }) => {
          const localCol = table.columns[local];
          if (!localCol) {
            errors.push(
              `Local column "${local}" not found for table "${table.name}"`
            );
            return;
          }

          if (localColsSeen.has(local)) {
            errors.push(
              `Column "${local}" in table "${table.name}" cannot appear in more than one foriegn key`
            );
            return;
          }
          localColsSeen.add(local);

          const foreignTable = this.tables
            .filter((t) => t.name !== table.name)
            .find(
              (t) => t.name === fKey.table && this.columnExists(t, foreign)
            );

          if (!foreignTable) {
            errors.push(
              `No foreign table with title "${fKey.table}" and column "${foreign}" exists`
            );
            return;
          }

          try {
            deepStrictEqual(foreignTable.columns[foreign]?.type, localCol.type);
          } catch {
            const error =
              "Invalid foreign key constraint: type of column" +
              local +
              " in table " +
              table.name +
              " does not match type of column " +
              foreign +
              " in table " +
              foreignTable.name;

            errors.push(error);
          }
        });
      });
    }

    return errors;
  }

  validate(): SchemaValidationErrors | undefined {
    const seenTables = new Set();
    const results: SchemaValidationErrors = {
      errors: [],
      perTableErrors: {},
    };

    this.tables.forEach((table) => {
      if (seenTables.has(table.name)) {
        results.errors.push(`Table "${table.name}" already exists.`);
        return;
      }

      seenTables.add(table.name);

      const validationErrors = this.validateTable(table);
      if (validationErrors.length > 0) {
        results.perTableErrors[table.name] = validationErrors;
      }
    });

    return results.errors.length > 0 ||
      Object.keys(results.perTableErrors).length > 0
      ? results
      : undefined;
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

  private tsAutoGenNotice(begin: boolean): string {
    return `${begin ? "" : "\n"}/*\n * ${
      begin ? "BEGIN" : "END"
    } AUTO GENERATED CONTENT BY scuffed-orm -- DO NOT EDIT\n */\n`;
  }

  private sqlAutoGenNotice(begin: boolean): string {
    return `${begin ? "" : "\n"}--\n-- ${
      begin ? "BEGIN" : "END"
    } AUTO GENERATED CONTENT BY scuffed-orm -- DO NOT EDIT\n--\n`;
  }
}
