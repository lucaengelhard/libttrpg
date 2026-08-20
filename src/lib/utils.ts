import { PROFICIENCY_NAME, type Store } from "../system/tree/types.ts";

export function getModifier(value: number): number {
  return Math.floor((value - 10) / 2);
}

export function getProficiencyBonus(level: number) {
  return Math.ceil(level / 4) + 1;
}

export function add(a: number, b: number) {
  return a + b;
}

export function id<T>(a: T) {
  return a;
}

export function isPrimitive(value: unknown) {
  return typeof value === "string" || typeof value === "number" ||
    typeof value === "boolean";
}

export function exhaustiveUnionArray<Union extends string>() {
  return <T extends readonly Union[]>(
    array: Exclude<Union, T[number]> extends never ? T : never,
  ) => array;
}

export function getProficiency(
  store: Store,
  category: string,
  name: string,
): number {
  const proficiencies = store.character.get("proficiency");
  if (!proficiencies) return 0;
  for (const value of [0.5, 1, 2] as const) {
    const identifier = `${category}.${name}@${PROFICIENCY_NAME[value]}`;
    if (proficiencies.has(identifier)) return value;
  }

  return 0;
}

export function arrayCount<A>(
  array: A[],
  pred: (element: A) => boolean,
): number {
  let counter = 0;
  for (const element of array) {
    if (pred(element)) counter++;
  }
  return counter;
}
