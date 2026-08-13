import { Node, NodeType, NodeWith } from "../types.ts";
import * as path from "@std/path";

export function getModifier(value: number): number {
  return Math.floor((value - 10) / 2);
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

export type NodePath = string;
export const PATH_SEPARATOR = "_/_";
export const PATH_IDENTIFIER = "@";
export const PATH_COUNTER = "#";
export function getNodePathSegments(
  p: NodePath,
): { value: string; identifier?: string; counter?: number }[] {
  const segments = p.split(PATH_SEPARATOR);
  return segments.map((s) => {
    const [value, identifier] = s.split(PATH_IDENTIFIER);
    if (identifier) {
      const [name, counter] = identifier.split(PATH_COUNTER);
      return { value, identifier: name, counter: parseInt(counter) };
    }
    return { value };
  });
}

export function expect<N extends NodeType>(
  node: Node,
  { path, log = false }: { path: NodePath; log?: boolean },
  ...types: N[]
): node is NodeWith<N> {
  const res = is(node, ...types);
  if (!res && log) {
    const wantedTypes = types.length === 1 ? types[0] : types.join(" | ");
    console.warn(`Expected: ${wantedTypes}, Got: ${node.type} at ${path}`);
  }
  return res;
}

export function is<T extends NodeType>(
  node: Node,
  ...types: T[]
): node is NodeWith<T> {
  return types.some((t) => node.type === t);
}

export function getProficiencyBonus(level: number) {
  return Math.ceil(level / 4) + 1;
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
