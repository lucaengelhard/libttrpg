import { EMPTY, Node, NodeType, NodeWith } from "../types.ts";

type HandlerFunction<T extends NodeType, A extends unknown, R extends unknown> =
  (node: NodeWith<T>, ...args: A[]) => R;
type Handlers<A extends unknown, R extends unknown> = {
  [K in NodeType]: HandlerFunction<K, A, R>;
};

export function createTraversalFunction<A extends unknown, R extends unknown>(
  defaultValue: R,
  handlers: Partial<Handlers<A, R>>,
) {
  function traverse(node: Node, ...args: A[]): R | R[] {
    if (handlers[node.type] !== undefined) {
      return handlers[node.type]!(node, ...args);
    }

    switch (node.type) {
      case "MULTIPLE": {
        return node.values.map((n) => traverse(n, ...args));
      }
      case "CHOOSE":
      case "DERIVE":
      case "OPTIONAL":
      case "IMPORT":
      case "LIBRARY":
      case "CLASS":
      case "CLASS_FEAT":
      case "FEAT":
      case "PROFICIENCY":
      case "MODIFIER":
      case "RESOURCE":
      case "ACTION":
      case "SPELL":
      case "SKILL":
      case "ROLL":
      case "LITERAL":
      case "EMPTY":
      default:
        return defaultValue;
    }
  }
}

const f = createTraversalFunction(EMPTY, {
  "ACTION": (node) => node,
});
