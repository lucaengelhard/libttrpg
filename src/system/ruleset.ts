import { nestedMap } from "../lib/utils.ts";
import type { Root } from "./tree/sugar.ts";
import type { Node } from "./tree/nodes.ts";

export function Ruleset(
  definitions: Root["definitions"],
  init: Node[],
) {
  const base: Root = {
    type: "ROOT",
    definitions: [...definitions],
    entry: { type: "MULTIPLE", values: [...init] },
  };

  return {
    create(bindings: Record<string, unknown>): Root {
      const bindingMap = nestedMap(bindings) as Map<
        string,
        Map<string, unknown>
      >;

      return {
        ...structuredClone(base),
        entry: apply(structuredClone(base.entry)),
      };
      function apply<N extends Node>(node: N): N {
        switch (node.type) {
          case "APPLY": {
            return {
              ...node,
              bindings: {
                ...node.bindings,
                ...Object.fromEntries(
                  bindingMap.get(node.name)?.entries() ?? [],
                ),
              },
            };
          }
          case "MULTIPLE":
            return { ...node, values: node.values.map(apply) };
          case "MODIFIER":
          case "OVERRIDE":
          case "BINOP":
          case "UNARYOP":
          case "VALUE":
          case "QUERY":
          case "CHOICE":
            return node;
        }
      }
    },
  };
}
