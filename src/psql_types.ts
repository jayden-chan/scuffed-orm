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
  key: "SmallInt",
  sqlName: "SMALLINT",
  typeScriptName: "number",
};

export const Integer: IntegerType = {
  key: "Integer",
  sqlName: "INTEGER",
  typeScriptName: "number",
};

export const BigInt: BigIntType = {
  key: "BigInt",
  sqlName: "BIGINT",
  typeScriptName: "BigInt",
};

export const Real: RealType = {
  key: "Real",
  sqlName: "REAL",
  typeScriptName: "number",
};

export const Double: DoubleType = {
  key: "Double",
  sqlName: "DOUBLE PRECISION",
  typeScriptName: "number",
};

export const SmallSerial: SmallSerialType = {
  key: "SmallSerial",
  sqlName: "SMALLSERIAL",
  typeScriptName: "number",
};

export const Serial: SerialType = {
  key: "Serial",
  sqlName: "SERIAL",
  typeScriptName: "number",
};

export const BigSerial: BigSerialType = {
  key: "BigSerial",
  sqlName: "BIGSERIAL",
  typeScriptName: "number",
};

export const Timestamp: TimestampType = {
  key: "Timestamp",
  sqlName: "TIMESTAMP WITHOUT TIME ZONE",
  typeScriptName: "string",
};

export const Text: TextType = {
  key: "Text",
  sqlName: "TEXT",
  typeScriptName: "string",
};

export const VarChar: (length: number) => VarCharType = (length: number) => {
  return {
    key: "VarChar",
    sqlName: "VARCHAR",
    typeScriptName: "string",
    length,
  };
};

export const Boolean: BooleanType = {
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

export type SmallIntType = {
  key: "SmallInt";
  sqlName: "SMALLINT";
  typeScriptName: "number";
};

export type IntegerType = {
  key: "Integer";
  sqlName: "INTEGER";
  typeScriptName: "number";
};

export type BigIntType = {
  key: "BigInt";
  sqlName: "BIGINT";
  typeScriptName: "BigInt";
};

export type RealType = {
  key: "Real";
  sqlName: "REAL";
  typeScriptName: "number";
};

export type DoubleType = {
  key: "Double";
  sqlName: "DOUBLE PRECISION";
  typeScriptName: "number";
};

export type SmallSerialType = {
  key: "SmallSerial";
  sqlName: "SMALLSERIAL";
  typeScriptName: "number";
};

export type SerialType = {
  key: "Serial";
  sqlName: "SERIAL";
  typeScriptName: "number";
};

export type BigSerialType = {
  key: "BigSerial";
  sqlName: "BIGSERIAL";
  typeScriptName: "number";
};

export type TimestampType = {
  key: "Timestamp";
  sqlName: "TIMESTAMP WITHOUT TIME ZONE";
  typeScriptName: "string";
};

export type TextType = {
  key: "Text";
  sqlName: "TEXT";
  typeScriptName: "string";
};

export type VarCharType = {
  key: "VarChar";
  sqlName: "VARCHAR";
  typeScriptName: "string";
  length: number;
};

export type BooleanType = {
  key: "Boolean";
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
  | IntegerType
  | BigIntType
  | RealType
  | DoubleType
  | SmallSerialType
  | SerialType
  | BigSerialType
  | EnumType;
