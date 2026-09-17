import { isNode } from "./node/index.ts";

export function getValue<
  T extends { $type: string },
  Type extends Extract<T, { name?: string }>["$type"],
  Key extends keyof Extract<T, { $type: Type }>,
  Value extends Extract<T, { $type: Type }>[Key],
>(
  node: T,
  type: Type,
  name: string,
  key: Key,
): Value | undefined {
  if (!isNode(node)) {
    if (Array.isArray(node)) {
      return (node as T[])
        .map((n) => getValue(n, type, name, key))
        .find((v) => v !== undefined) as Value | undefined;
    }

    return;
  }

  if (
    node.$type === type &&
    "name" in node &&
    typeof node.name === "string" &&
    node.name === name
  ) {
    return node[key as keyof typeof node] as Value;
  }

  return Object.values(node)
    .map((n) => getValue(n as T, type, name, key))
    .find((v) => v !== undefined) as Value | undefined;
}

export function hasValue<
  T extends { $type: string },
  Type extends Extract<T, { name?: string }>["$type"],
>(
  node: T,
  type: Type,
  name: string,
): boolean {
  return getValue(node, type, name, "$type") !== undefined;
}

export function setValue<
  T extends { $type: string },
  Type extends Extract<T, { name?: string }>["$type"],
  Key extends Exclude<keyof Extract<T, { $type: Type }>, "$type" | "name">,
  Value extends Extract<T, { $type: Type }>[Key],
>(
  node: T,
  type: Type,
  name: string,
  key: Key,
  value: Value,
): T {
  if (!isNode(node)) {
    if (Array.isArray(node)) {
      return (node as T[])
        .map((n) => setValue(n, type, name, key, value)) as unknown as T;
    }

    return node;
  }

  if (
    node.$type === type && "name" in node && typeof node.name === "string" &&
    node.name === name && key in node
  ) {
    return { ...node, [key]: value };
  }

  return Object.fromEntries(
    Object.entries(node).map((
      [k, v],
    ) => [k, setValue(v as T, type, name, key, value)]),
  ) as unknown as T;
}

export function deleteNode<
  T extends { $type: string },
  Type extends Extract<T, { name?: string }>["$type"],
>(
  node: T,
  type: Type,
  name: string,
  isInArray?: boolean,
): T | { $type: "NULL" } {
  if (!isNode(node)) {
    if (Array.isArray(node)) {
      return (node as T[])
        .map((n) => deleteNode(n, type, name, true))
        .flatMap((v) => v) as unknown as T;
    }

    return node;
  }

  if (
    node.$type === type && "name" in node && typeof node.name === "string" &&
    node.name === name
  ) {
    return isInArray ? [] as unknown as T : { $type: "NULL" };
  }

  return Object.fromEntries(
    Object.entries(node).map((
      [k, v],
    ) => [k, deleteNode(v as T, type, name, false)]),
  ) as unknown as T;
}
