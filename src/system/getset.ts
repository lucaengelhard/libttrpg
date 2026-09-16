import { isNode, type Node, type Tree } from "./node/index.ts";

export function getValue<
  N extends Node,
  T extends N["$type"],
  K extends keyof Extract<N, { type: T }>,
>(
  node: Tree<N, N>,
  type: T,
  name: string,
  key: K,
): Extract<N, { type: T }>[K] | undefined {
  if (!isNode(node)) {
    if (Array.isArray(node)) {
      return (node as N[])
        .map((n) => getValue(n as Tree<N, N>, type, name, key))
        .find((v) => v !== undefined);
    }

    return;
  }

  if (
    node.$type === type &&
    "name" in node &&
    typeof node.name === "string" &&
    node.name === name
  ) {
    return node[key as keyof typeof node] as Extract<N, { type: T }>[K];
  }

  return Object.values(node)
    .map((n) => getValue(n as Node, type, name, key))
    .find((v) => v !== undefined);
}

export function setValue<
  N extends Node,
  T extends N["type"],
  K extends keyof Extract<N, { type: T }>,
>(
  node: Tree<N, N>,
  type: T,
  name: string,
  key: K,
  value: Extract<N, { type: T }>[K],
): N {
  if (!isNode(node)) return node as N;

  if (
    node.$type === type && "name" in node && typeof node.name === "string" &&
    node.name === name && key in node
  ) {
    return { ...node, [key]: value } as N;
  }

  return Object.fromEntries(
    Object.entries(node).map((
      [k, v],
    ) => [k, setValue(v as Tree<N, N>, type, name, key, value)]),
  ) as N;
}
