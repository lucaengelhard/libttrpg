import { Tag } from "../../lib/tag.ts";
import type { Node, NodeFactory, Resolvable } from "./index.ts";
import {
  type Bool,
  False,
  filterBools,
  isFalse,
  NodeResolver,
  NOOP,
  type Num,
} from "./index.ts";

export const CONDITION_OPERATORS = [
  "<=",
  ">=",
  "==",
  "!=",
  "<",
  ">",
] as const;

export type ConditionKind = (typeof CONDITION_OPERATORS)[number];

export type Condition = NodeFactory<
  "Condition",
  {
    kind: ConditionKind;
    left: Resolvable;
    right: Resolvable;
    effect: Node;
  }
>;

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

export const CONDITION = NodeResolver("CONDITION", (node, ctx) => {
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

  return NOOP;
});
