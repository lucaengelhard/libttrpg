import { isNode, type Node, type Tree } from "./node/index.ts";

export function getValue<T>(
  node: Tree<Node, Node>,
  type: string,
  name: string,
  key: string,
): T | undefined {
  if (!isNode(node)) {
    if (Array.isArray(node)) {
      return (node as Node[])
        .map((n) => getValue(n, type, name, key))
        .find((v) => v !== undefined) as T | undefined;
    }

    return;
  }

  if (
    node.$type === type &&
    "name" in node &&
    typeof node.name === "string" &&
    node.name === name
  ) {
    return node[key as keyof typeof node] as T;
  }

  return Object.values(node)
    .map((n) => getValue(n as Node, type, name, key))
    .find((v) => v !== undefined) as T | undefined;
}

export function setValue<T extends Tree<Node, Node>>(
  node: T,
  type: string,
  name: string,
  key: string,
  value: unknown,
): T {
  if (!isNode(node)) return node;

  if (
    node.$type === type && "name" in node && typeof node.name === "string" &&
    node.name === name && key in node
  ) {
    return { ...node, [key]: value };
  }

  return Object.fromEntries(
    Object.entries(node).map((
      [k, v],
    ) => [k, setValue(v as Tree<Node, Node>, type, name, key, value)]),
  ) as T;
}

export function hasValue(
  node: Tree<Node, Node>,
  type: string,
  name: string,
  key: string,
): boolean {
  return getValue(node, type, name, key) !== undefined;
}
