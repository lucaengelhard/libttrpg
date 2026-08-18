import {
  EMPTY,
  type Multiple,
  type Node,
  type NodeType,
  type NodeWith,
  type NodeWithout,
} from "../system/tree/types.ts";
import { CaseInsensitiveSet } from "./set.ts";
import { resolveValue } from "./value.ts";

export function assert<N extends NodeType>(
  node: Node,
  ...types: N[]
): asserts node is NodeWith<N> {
  if (!is(node, ...types)) {
    const wantedTypes = types.length === 1 ? types[0] : types.join(" | ");
    throw new Error(
      `Expected: ${wantedTypes}, Got: ${node.type}`,
    );
  }
}

export function is<T extends NodeType>(
  node: Node,
  ...types: T[]
): node is NodeWith<T> {
  return types.some((t) => node.type === t);
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

export function wrapInMultiple(
  values: Node[] = [],
): Multiple {
  return { type: "MULTIPLE", values };
}

export function isSafeWrite(node: Node): boolean {
  return is(node, "DEPENDENCY") &&
    node.query.toLowerCase().startsWith("character");
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
