import { toPascalCase } from "./util";
/********************************************************/
/*                     Schema Types                     */
/********************************************************/

export type MutateAction =
  | "NO ACTION"
  | "RESTRICT"
  | "CASCADE"
  | "SET NULL"
  | "SET DEFAULT";

export type ForeignKey = {
  columns: {
    local: string;
    foreign: string;
  }[];
  table: string;
  onDelete?: MutateAction;
  onUpdate?: MutateAction;
};

export type Table = {
  name: string;
  typeName: string;
  columns: { [key: string]: Column };
  primaryKeys: string[];
  foreignKeys?: ForeignKey[];
  constraints?: { [key: string]: string };
};

export type Column = {
  type: TSSQLType;
  nullable?: boolean;
  default?: Default;
};

export type Default =
  | {
      type: "value";
      value: any;
    }
  | {
      type: "raw_sql";
      value: string;
    };

export type SchemaValidationErrors = {
  errors: string[];
  perTableErrors: {
    [key: string]: string[];
  };
};

/********************************************************/
/*                     Value Types                      */
/********************************************************/

export const UUID = {
  key: "UUID",
  sqlName: "UUID",
  typeScriptName: "string",
};

export const SmallInt = {
  key: "SmallInt",
  sqlName: "SMALLINT",
  typeScriptName: "number",
};

export const Integer = {
  key: "Integer",
  sqlName: "INTEGER",
  typeScriptName: "number",
};

export const BigInt = {
  key: "BigInt",
  sqlName: "BIGINT",
  typeScriptName: "BigInt",
};

export const Real = {
  key: "Real",
  sqlName: "REAL",
  typeScriptName: "number",
};

export const Double = {
  key: "Double",
  sqlName: "DOUBLE PRECISION",
  typeScriptName: "number",
};

export const SmallSerial = {
  key: "SmallSerial",
  sqlName: "SMALLSERIAL",
  typeScriptName: "number",
};

export const Serial = {
  key: "Serial",
  sqlName: "SERIAL",
  typeScriptName: "number",
};

export const BigSerial = {
  key: "BigSerial",
  sqlName: "BIGSERIAL",
  typeScriptName: "number",
};

export const Timestamp = {
  key: "Timestamp",
  sqlName: "TIMESTAMP WITHOUT TIME ZONE",
  typeScriptName: "string",
};

export const Text = {
  key: "Text",
  sqlName: "TEXT",
  typeScriptName: "string",
};

export const VarChar: (length: number) => VarCharType = (length: number) => {
  return {
    key: "VarChar",
    sqlName: `VARCHAR(${length})`,
    typeScriptName: "string",
    length,
  };
};

export const Char: (length: number) => CharType = (length: number) => {
  return {
    key: "Char",
    sqlName: `CHAR(${length})`,
    typeScriptName: "string",
    length,
  };
};

export const Boolean = {
  key: "Boolean",
  sqlName: "BOOLEAN",
  typeScriptName: "boolean",
};

export const Enum = ({ name, values }: { name: string; values: string[] }) => {
  const ret: EnumType = {
    key: "UserDefinedType",
    sqlName: name,
    typeScriptName: toPascalCase(name),
    values: new Set(values),
  };
  return ret;
};

/********************************************************/
/*                    Exported Types                    */
/********************************************************/

export type EnumType = UserDefinedType & {
  values: Set<string>;
};

export type VarCharType = {
  key: "VarChar";
  sqlName: string;
  typeScriptName: "string";
  length: number;
};

export type CharType = {
  key: "Char";
  sqlName: string;
  typeScriptName: "string";
  length: number;
};

export type UserDefinedType = {
  key: "UserDefinedType";
  sqlName: string;
  typeScriptName: string;
};

export type TSSQLType =
  | VarCharType
  | CharType
  | EnumType
  | typeof SmallInt
  | typeof Timestamp
  | typeof Text
  | typeof Boolean
  | typeof Integer
  | typeof BigInt
  | typeof Real
  | typeof Double
  | typeof SmallSerial
  | typeof Serial
  | typeof BigSerial;
