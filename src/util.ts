export function newlinePad(toPad: string): string {
  return toPad.length ? `${toPad}\n\n` : "";
}

export function toPascalCase(toConvert: string): string {
  return toConvert.charAt(0).toUpperCase() + toCamelCase(toConvert.slice(1));
}

export function toCamelCase(toConvert: string): string {
  return toConvert.replace(
    /_(\w)/g,
    (_, firstLetter) => `${firstLetter.toUpperCase()}`
  );
}
