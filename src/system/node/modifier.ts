import type { Vertex } from "../../lib/graph.ts";
import { Tag } from "../../lib/tag.ts";
import type { NodeFactory, Resolvable } from "./index.ts";
import type { Query } from "./query.ts";
import {
  type Bool,
  filterBools,
  isFalse,
  type Modifier as ModifierTag,
  NodeResolver,
  NOOP,
  type Num,
  type ResolveContext,
  type Values,
} from "./index.ts";
import type { Selector } from "./selector.ts";

export type Modifier = NodeFactory<
  "Modifier",
  { target: Query | Selector; value: Resolvable }
>;
export type Override = NodeFactory<"Override", Omit<Modifier, "type">>;

export const MODIFIER = NodeResolver("MODIFIER", applyModifier);
export const OVERRIDE = NodeResolver("OVERRIDE", applyModifier);

function applyModifier(node: Modifier | Override, ctx: ResolveContext): Vertex {
  const valueVertex = ctx.resolve(node.value);
  const targetVertex = ctx.resolve(node.target);

  const vertex = ctx.vertex<Num | Values | Bool, ModifierTag>(
    ["number", "values", "boolean"],
    (input) => {
      if (isFalse(input)) return Tag("modifier", []) as ModifierTag;
      const filtered = filterBools(input);

      const value = filtered.find((v) => typeof v === "number");
      const targets = filtered.find((v) => typeof v !== "number");
      if (value === undefined || targets === undefined) {
        return Tag("modifier", []) as ModifierTag;
      }

      const modifier = targets
        .keys()
        .map((k) => [k, value] as [string, number])
        .toArray();

      return Tag("modifier", modifier);
    },
  );

  ctx.edge(ctx.condition, vertex);
  ctx.edge(valueVertex, vertex);
  ctx.edge(targetVertex, vertex);

  return NOOP;
}
