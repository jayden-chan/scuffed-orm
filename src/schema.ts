import { EnumType, Table, TSSQLType } from "./psql_types";
import { newlinePad, toPascalCase, toCamelCase, pluralize } from "./util";

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
    const validationErrors = this.validate(table);
    if (validationErrors.length > 0) {
      this.printValidationErrors(validationErrors, table.name);
      throw new Error("Validation failed");
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

    return `${this.sqlAutoGenNotice(true)}${newlinePad(extensions)}${newlinePad(
      typeDefs
    )}${tableDefs}${this.sqlAutoGenNotice(false)}`;
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
            const optional = column.nullable ? "?" : "";
            return `${indent}${fieldName}${optional}: ${typeName};`;
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
    const dropTables = this.tables
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
      return `export enum ${customType.typeScriptName} {\n${[
        ...(customType as EnumType).values,
      ]
        .map((v) => `${this.tsIndent()}${toPascalCase(v)},`)
        .join("\n")}\n}`;
    }

    throw new Error("Provided type is not a custom type");
  }

  private validate(table: Table): string[] {
    const columns = new Set();
    const fKeys = new Set();
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
      for (const [col, key] of Object.entries(table.foreignKeys)) {
        const localCol = table.columns[col];
        if (!localCol) {
          errors.push(
            `Local column "${col}" not found for table "${table.name}"`
          );
          continue;
        }

        if (fKeys.has(col)) {
          errors.push(
            `Duplicate foreign key "${col}" found in table "${table.name}"`
          );
          continue;
        }

        fKeys.add(col);

        const foreignTable = this.tables
          .filter((t) => t.name !== table.name)
          .find((t) => {
            return t.name === key.table && this.columnExists(t, key.column);
          });

        if (!foreignTable) {
          errors.push(
            `No foreign table with title "${key.table}" and column "${key.column}" exists`
          );
          continue;
        }

        if (foreignTable.columns[key.column]?.type !== localCol.type) {
          errors.push(
            `Column type mismatch on foreign key "${col}" in table "${table.name}"`
          );
        }
      }
    }

    return errors;
  }

  private validateAll() {
    const tables = new Set();
    for (const table of this.tables) {
      if (tables.has(table.name)) {
        throw new Error(`Table "${table.name}" already exists.`);
      }

      tables.add(table.name);

      const validationErrors = this.validate(table);
      if (validationErrors.length > 0) {
        this.printValidationErrors(validationErrors, table.name);
        throw new Error(`Error while validating table ${table.name}`);
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

  private printValidationErrors(errors: string[], tableName: string): void {
    console.error(
      `${errors.length} error${pluralize(
        errors.length
      )} found for table "${tableName}":`
    );

    errors.forEach((e) => {
      console.error(`    ${e}`);
    });
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
