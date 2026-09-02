import { isNode, type Multiple, type Node, type Resolvable } from "./nodes.ts";

export type Root = {
  type: "ROOT";
  definitions: Record<string, Definition>;
  entry: Multiple;
};

export type Definition = { bindings: string[]; definition: Node };

export type Apply = {
  type: "APPLY";
  name: string;
  bindings: Record<string, any>;
};

// TODO: Not sure if this works correctly or if closures are relevant
export function desugar(root: Root): Node {
  const definitions = new Map(Object.entries(root.definitions));

  return apply(root.entry, new Map());

  function apply(
    node: Node | Apply,
    bindings: Map<string, any>,
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

        return { ...node, name: get(node.name) ?? node.name, value };
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
          target: get(node.target) ?? node.target,
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
          options: Object.fromEntries(
            Object.entries(node.options).map((
              [key, value],
            ) => [key, apply(value, bindings)]),
          ),
          selected: Object.fromEntries(
            Object.entries(node.selected).map((
              [key, value],
            ) => [key, apply(value, bindings)]),
          ),
        };
      }

      case "QUERY": {
        const res = get(node.query);
        return isNode(res) ? apply(res, bindings) : node;
      }
    }

    function get(identifier: string | undefined) {
      // TODO template strings
      if (identifier === undefined || !identifier.startsWith("$")) return;
      const cleaned = identifier.replace("$", "");
      return bindings.get(cleaned);
    }
  }
}
