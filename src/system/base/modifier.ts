import * as z from "zod";
import type { Vertex } from "../../lib/graph.ts";
import { Tag } from "../../lib/tag.ts";
import {
  type Bool,
  filterBools,
  isFalse,
  type Modifier as ModifierTag,
  type Named,
  type Num,
  type ResolveContext,
  type Resolver,
  type Values,
  VOID,
} from "../parse.ts";
import {
  type Infer,
  Schema,
  type SchemaNode,
  type ZodNode,
} from "../schema.ts";
import { Query } from "./query.ts";
import { Selector } from "./selector.ts";

type ModifierSchema = {
  target: z.ZodUnion<(ZodNode<"Query"> | ZodNode<"Selector">)[]>;
  value: SchemaNode;
};

export type Modifier = Infer<typeof Modifier>;
export const Modifier: Schema<"Modifier", ModifierSchema> = Schema(
  "Modifier",
  (node) => ({
    target: z.union([Query.apply(node), Selector.apply(node)]),
    value: node,
  }),
);
export type Override = Infer<typeof Override>;
export const Override: Schema<"Override", ModifierSchema> = Schema(
  "Override",
  (node) => ({
    target: z.union([Query.apply(node), Selector.apply(node)]),
    value: node,
  }),
);

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

  return VOID;
}
