import { recordMap } from "../../lib/utils.ts";
import { isNode, type Multiple, type Node, type Resolvable } from "./nodes.ts";

export type Root = {
  type: "ROOT";
  definitions: Record<string, Definition>;
  entry: Multiple;
};

export type Definition = { bindings: string[]; definition: Node };

type BindingValue = number | string | Node;

export type Apply = {
  type: "APPLY";
  name: string;
  bindings: Record<string, BindingValue>;
};

// TODO: Not sure if this works correctly or if closures are relevant
export function desugar(root: Root): Node {
  const definitions = new Map(Object.entries(root.definitions));

  return apply(root.entry, new Map());

  function apply(
    node: Node | Apply,
    bindings: Map<string, BindingValue>,
  ): Node {
    switch (node.type) {
      case "MULTIPLE": {
        return {
          ...node,
          values: node.values.map((n) => apply(n, bindings)),
        };
      }
      case "VALUE": {
        const value = typeof node.value === "number"
          ? node.value
          : typeof node.value === "object"
          ? apply(node.value, bindings)
          : get(node.value) ?? node.value;

        return {
          ...node,
          name: get(node.name, "string") ?? node.name,
          value: value as Resolvable,
        };
      }
      case "BINOP": {
        return {
          ...node,
          left: apply(node.left, bindings) as Resolvable,
          right: apply(node.right, bindings) as Resolvable,
        };
      }
      case "UNARYOP": {
        return {
          ...node,
          value: apply(node.value, bindings) as Resolvable,
        };
      }
      case "OVERRIDE":
      case "MODIFIER": {
        return {
          ...node,
          value: apply(node.value, bindings) as Resolvable,
          target: get(node.target, "string") ?? node.target,
        };
      }
      case "APPLY": {
        const definition = definitions.get(node.name);
        if (!definition) throw `Missing definition for: ${node.name}`;
        const newBindings = new Map(bindings);
        for (const identifier of definition.bindings) {
          newBindings.set(identifier, node.bindings[identifier]);
        }

        return apply(definition.definition, newBindings); // TODO maybe return apply with a result prop?
      }
      case "CHOICE": {
        return {
          ...node,
          count: apply(node.count, bindings) as Resolvable,
          options: recordMap(node.options, (v) => apply(v, bindings)),
          selected: recordMap(node.selected, (v) => apply(v, bindings)),
        };
      }

      case "QUERY": {
        const res = get(node.query);
        return isNode(res) ? apply(res, bindings) : node;
      }
    }

    function get<Constraint extends "number" | "string" | "node" | undefined>(
      identifier: string | undefined,
      constraint?: Constraint,
    ):
      | (Constraint extends "number" ? number | undefined
        : Constraint extends "string" ? string | undefined
        : Constraint extends "node" ? Node | undefined
        : BindingValue | undefined)
      | undefined {
      // TODO template strings
      if (identifier === undefined || !identifier.startsWith("$")) return;
      const cleaned = identifier.replace("$", "");
      const res = bindings.get(cleaned);

      // deno-lint-ignore no-explicit-any
      if (constraint === undefined || res === undefined) return res as any;

      if (constraint === "number" || constraint === "string") {
        // deno-lint-ignore no-explicit-any valid-typeof
        return typeof res === constraint ? res as any : undefined;
      }

      // deno-lint-ignore no-explicit-any
      return isNode(res) ? res as any : undefined;
    }
  }
}
