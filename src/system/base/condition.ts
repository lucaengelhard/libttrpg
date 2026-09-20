import * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import {
  type Bool,
  False,
  filterBools,
  isFalse,
  type Num,
  type Resolver,
  VOID,
} from "../parse.ts";
import { type Infer, Schema, type SchemaNode } from "../schema.ts";

export const CONDITION_OPERATORS = [
  "<=",
  ">=",
  "==",
  "!=",
  "<",
  ">",
] as const;

export type ConditionKind = typeof CONDITION_OPERATORS[number];
export const ConditionKind: z.ZodUnion<z.ZodLiteral<ConditionKind>[]> = z.union(
  CONDITION_OPERATORS.map((o) => z.literal(o)),
);

type ConditionSchema = {
  kind: typeof ConditionKind;
  left: SchemaNode;
  right: SchemaNode;
  effect: SchemaNode;
};
export type Condition = Infer<typeof Condition>;
export const Condition: Schema<"Condition", ConditionSchema> = Schema(
  "Condition",
  (node) => ({
    kind: ConditionKind,
    left: node,
    right: node,
    effect: node,
  }),
);

export function condition(
  left: number,
  operator: ConditionKind,
  right: number,
): boolean {
  switch (operator) {
    case "<=":
      return left <= right;
    case ">=":
      return left >= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "<":
      return left < right;
    case ">":
      return left > right;
  }
}

export const CONDITION: Resolver<Condition> = (node, ctx) => {
  const left = ctx.resolve(node.left);
  const right = ctx.resolve(node.right);

  const cond = ctx.vertex<Num | Bool, Bool>("number", (values) => {
    if (isFalse(values)) return False;
    const filtered = filterBools(values);

    if (filtered.length < 2) return False;

    return Tag("boolean", condition(filtered[0], node.kind, filtered[1]));
  });

  ctx.resolve(node.effect, { condition: cond });

  ctx.edge(left, cond);
  ctx.edge(right, cond);

  return VOID;
};
