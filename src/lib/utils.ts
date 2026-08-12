import { Node, NodeType, NodeWith } from "../types.ts";

export function getModifier(value: number): number {
  return Math.floor((value - 10) / 2);
}

export async function readData(path: string) {
  const data = await Deno.readTextFile(path);
  return JSON.parse(data);
}

export type NodePath = string;
export const PATH_SEPARATOR = "_/_";
export const PATH_IDENTIFIER = "@";
export function getNodePathSegments(
  p: NodePath,
): { value: string; identifier?: string }[] {
  const segments = p.split(PATH_SEPARATOR);
  return segments.map((s) => {
    const [value, identifier] = s.split(PATH_IDENTIFIER);
    return { value, identifier };
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
