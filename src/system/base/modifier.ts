import type { Vertex } from "../../lib/graph.ts";
import { Tag } from "../../lib/tag.ts";
import {
  type Bool,
  filterBools,
  isFalse,
  type Modifier as ModifierTag,
  type Named,
  NOOP,
  type Num,
  type ResolveContext,
  type Resolver,
  type Values,
} from "../parse.ts";
import type { Expression, Statement } from "../node.ts";
import type { Query } from "./query.ts";
import type { Selector } from "./selector.ts";

export type Modifier = Statement<
  "Modifier",
  {
    target: Query | Selector;
    value: Expression;
  }
>;
export type Override = Statement<
  "Override",
  Modifier
>;

export const MODIFIER: Resolver<Modifier> = applyModifier;
export const OVERRIDE: Resolver<Override> = applyModifier;

function applyModifier(node: Modifier | Override, ctx: ResolveContext): Vertex {
  const valueVertex = ctx.resolve(node.value);
  const targetVertex = ctx.resolve(node.target);

  const vertex = ctx.vertex<Num | Named | Values | Bool, ModifierTag>(
    ["number", "values", "boolean", "named"],
    (input) => {
      if (isFalse(input)) return Tag("modifier", []) as ModifierTag;
      const filtered = filterBools(input);

      const number = filtered.find((v) => typeof v === "number");
      const named = filtered.find((v) => Array.isArray(v));

      const value = number ?? (named !== undefined ? named[1] : undefined);

      const targets = filtered.find((v) => v instanceof Map);

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

  ctx.edge(
    vertex,
    node.$type === "MODIFIER" ? ctx.modifiers : ctx.overrides,
  );

  return NOOP;
}
