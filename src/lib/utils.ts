import * as path from "@std/path";
import {
  EMPTY,
  Multiple,
  Node,
  NodeType,
  NodeWith,
  NodeWithKey,
  NodeWithName,
  NodeWithout,
  PROFICIENCY_NAME,
  Store,
  Value,
} from "../system/tree/types.ts";
import { CaseInsensitiveSet } from "./set.ts";

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

  const fileContent = await Deno.readTextFile(newAbsPath);

  const parsed = JSON.parse(fileContent) as Node;
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

export function resolveValue(
  node: Value,
): string | number | boolean | undefined {
  switch (node.type) {
    case "LITERAL":
      return node.value;
    case "COMPUTED": {
      if (node.overwrite && node.overwrite.length > 0) {
        return resolveValue(getMaxValue(node.overwrite));
      }
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

export function getMaxValue(values: Value[]): Value {
  let current = values[0];
  for (const value of values) {
    if (
      typeof resolveValue(value) === "string" ||
      typeof resolveValue(value) === "number"
    ) return values[0];

    if (resolveValue(value) as number > (resolveValue(current) as number)) {
      current = value;
    }
  }
  return current;
}

export function unwrapDependency(node: Node): NodeWithout<"DEPENDENCY"> {
  if (node.type !== "DEPENDENCY") return node;
  return node.result ? unwrapDependency(node.result) : EMPTY;
}

export function unwrapChoose(node: Node) {
  if (!is(node, "CHOOSE")) {
    return is(node, "MULTIPLE") ? node : wrapInMultiple([]);
  }
  if (!node.selected) return wrapInMultiple([]);

  return node.selected;
}

export function printNode(input: Node): string {
  return JSON.stringify(input, null, 1);
}

export function exhaustiveUnionArray<Union extends string>() {
  return <T extends readonly Union[]>(
    array: Exclude<Union, T[number]> extends never ? T : never,
  ) => array;
}

export function getNodeIdentifier(node: Node): string | undefined {
  if ("name" in node) return node.name;
  else return node.key;
}

export function getMultipleKeys(node: Multiple) {
  return new CaseInsensitiveSet(
    node.values.map(getNodeIdentifier).filter((v) => v !== undefined),
  );
}

export function add(a: number, b: number) {
  return a + b;
}

export function wrapInMultiple(
  values: (NodeWithName | NodeWithKey)[] = [],
): Multiple {
  return { type: "MULTIPLE", values };
}

export function isSafeWrite(node: Node): boolean {
  return is(node, "DEPENDENCY") &&
    node.query.toLowerCase().startsWith("character");
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

export function getResource(node: Node) {
  {
    if (!is(node, "RESOURCE")) return;
    const usesNode = unwrapDependency(node.uses);
    if (!is(usesNode, "LITERAL", "COMPUTED")) return;
    const uses = resolveValue(usesNode) as number;
    const spent = node.spent ? resolveValue(node.spent) as number : 0;

    return [node.name, {
      uses,
      spent,
      resetTrigger: node.resetTrigger,
    }] as const;
  }
}

export function normalizeValue(value: unknown): string | string[] | undefined {
  if (isPrimitive(value)) {
    return value.toString().toLowerCase();
  }

  if (Array.isArray(value) && value.every(isPrimitive)) {
    return value.map(normalizeValue).filter((e) =>
      e !== undefined && e !== null && !Array.isArray(e)
    ) as string | string[] | undefined;
  }
}

function isPrimitive(value: unknown) {
  return typeof value === "string" || typeof value === "number" ||
    typeof value === "boolean";
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
