import * as path from "@std/path";
import {
  Node,
  NodeType,
  NodeWith,
  NodeWithKey,
  NodeWithName,
  ProficiencyValue,
  Value,
} from "../system/tree.ts";

export function getModifier(value: number): number {
  return Math.floor((value - 10) / 2);
}

export function getProficiencyBonus(level: number) {
  return Math.ceil(level / 4) + 1;
}

const cache = new Map<string, Node>();
export async function readData(currentPath: string, importPath: string) {
  let newAbsPath = path.resolve(path.dirname(currentPath), importPath);
  const info = await Deno.stat(newAbsPath);
  if (info.isDirectory) {
    newAbsPath = path.join(newAbsPath, "index.json");
  }

  if (cache.has(newAbsPath)) {
    return { data: cache.get(newAbsPath)!, newPath: newAbsPath };
  }

  const data = await Deno.readTextFile(newAbsPath);

  const parsed = JSON.parse(data) as Node;
  cache.set(newAbsPath, parsed);
  return { data: parsed, newPath: newAbsPath };
}

export function expect<N extends NodeType>(
  node: Node,
  { path, log = false, panic = false }: {
    path: string;
    log?: boolean;
    panic?: boolean;
  },
  ...types: N[]
): node is NodeWith<N> {
  const res = is(node, ...types);
  if (!res) {
    const wantedTypes = types.length === 1 ? types[0] : types.join(" | ");
    const errorString =
      `Expected: ${wantedTypes}, Got: ${node.type} at ${path}`;

    if (panic) throw errorString;
    else if (log) console.warn(errorString);
  }
  return res;
}

export function assert<N extends NodeType>(
  node: Node,
  path: string,
  ...types: N[]
): asserts node is NodeWith<N> {
  expect(node, { path, panic: true }, ...types);
}

export function is<T extends NodeType>(
  node: Node,
  ...types: T[]
): node is NodeWith<T> {
  return types.some((t) => node.type === t);
}

export function isValue(node: Node | undefined): node is Value {
  if (!node) return false;
  return is(node, "LITERAL") || is(node, "COMPUTED");
}

export function hasKeyOrValue<N extends Node>(
  node: N,
  shouldLog = false,
): node is N & (NodeWithKey | NodeWithName) {
  if (!(node.key !== undefined || "name" in node) && shouldLog) {
    console.warn("Missing key or name for node:");
    console.log(node);
  }

  return node.key !== undefined || "name" in node;
}

export function resolveValue(
  node: Value,
): string | number | boolean | undefined {
  switch (node.type) {
    case "LITERAL":
      return node.value;
    case "COMPUTED": {
      if (node.overwrite) return resolveValue(node.overwrite);
      const base = node.base ? resolveValue(node.base) : undefined;
      const modifiers = node.modifiers.map(resolveValue).filter((v) =>
        v !== undefined
      );

      const values = base ? [base, ...modifiers] : modifiers;
      return values.length > 0
        ? values
          .reduce((acc, curr) => {
            const isBool = typeof acc === "boolean" ||
              typeof curr === "boolean";
            const isNumber = typeof acc === "number" ||
              typeof curr === "number";

            return isBool
              ? (Boolean(acc) && Boolean(curr))
              : isNumber
              ? Number(acc) + Number(curr)
              : acc + curr;
          })
        : undefined;
    }
  }
}

export function getProficiency(
  input: { value: ProficiencyValue; source: string }[],
): number {
  let max: number | null = null;
  for (const value of input) {
    if (max === null || value.value > max) max = value.value;
  }

  return max === null ? 1 : max;
}

type CaseInsensitiveKey<R, K extends string> = {
  [P in keyof R & string]: Lowercase<P> extends Lowercase<K> ? P : never;
}[keyof R & string];

export function caseInsensitiveGet<
  R extends Record<string, unknown>,
  K extends string,
>(
  record: R,
  key: K,
): R[CaseInsensitiveKey<R, K>] | undefined {
  if (key in record) {
    return record[key as keyof R] as R[CaseInsensitiveKey<R, K>];
  }

  const upper = key.toUpperCase() as keyof R;
  if (upper in record) {
    return record[upper] as R[CaseInsensitiveKey<R, K>];
  }

  const lower = key.toLowerCase() as keyof R;
  if (lower in record) {
    return record[lower] as R[CaseInsensitiveKey<R, K>];
  }

  return undefined;
}

export function log(input: unknown, active: boolean) {
  if (active) console.log(input);
}

export function printNode(input: Node): string {
  return JSON.stringify(input, null, 1);
}
