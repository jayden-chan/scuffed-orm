import { toPascalCase } from "./util";
/********************************************************/
/*                     Schema Types                     */
/********************************************************/

export type ForeignKey = {
  localCol: string;
  foreignTable: string;
  foreignCol: string;
};

export type Table = {
  name: string;
  typeName: string;
  columns: Column[];
  pKeys: string[];
  fKeys: ForeignKey[];
};

export type Column = {
  name: string;
  type: TSSQLType;
  nullable: boolean;
};

/********************************************************/
/*                     Value Types                      */
/********************************************************/

export const SmallInt: SmallIntType = {
  key: "SmallIntType",
  sqlName: "SMALLINT",
  typeScriptName: "number",
};

export const Timestamp: TimestampType = {
  key: "TimestampType",
  sqlName: "TIMESTAMP WITHOUT TIME ZONE",
  typeScriptName: "string",
};

export const Text: TextType = {
  key: "TextType",
  sqlName: "TEXT",
  typeScriptName: "string",
};

export const VarChar: (length: number) => VarCharType = (length: number) => {
  return {
    key: "VarCharType",
    sqlName: "VARCHAR",
    typeScriptName: "string",
    length,
  };
};

export const Boolean: BooleanType = {
  key: "BooleanType",
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

export type SmallIntType = {
  key: "SmallIntType";
  sqlName: "SMALLINT";
  typeScriptName: "number";
};

export type TimestampType = {
  key: "TimestampType";
  sqlName: "TIMESTAMP WITHOUT TIME ZONE";
  typeScriptName: "string";
};

export type TextType = {
  key: "TextType";
  sqlName: "TEXT";
  typeScriptName: "string";
};

export type VarCharType = {
  key: "VarCharType";
  sqlName: "VARCHAR";
  typeScriptName: "string";
  length: number;
};

export type BooleanType = {
  key: "BooleanType";
  sqlName: "BOOLEAN";
  typeScriptName: "boolean";
};

export type UserDefinedType = {
  key: "UserDefinedType";
  sqlName: string;
  typeScriptName: string;
};

export type TSSQLType =
  | SmallIntType
  | TimestampType
  | TextType
  | VarCharType
  | BooleanType
  | EnumType;
