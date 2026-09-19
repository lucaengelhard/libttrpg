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
import { Child, NodeSchema, type ZodNode } from "../schema.ts";

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

export type Condition = z.infer<typeof Condition>;
export const Condition: ZodNode<
  "Condition",
  {
    kind: typeof ConditionKind;
    left: ZodNode;
    right: ZodNode;
    effect: ZodNode;
  }
> = NodeSchema("Condition", {
  kind: ConditionKind,
  left: Child(),
  right: Child(),
  effect: Child(),
});

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
