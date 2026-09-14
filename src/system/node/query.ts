import { Tag } from "../../lib/tag.ts";
import { type NodeFactory, NodeResolver } from "./index.ts";
import {
  condition,
  CONDITION_OPERATORS,
  type ConditionKind,
} from "./condition.ts";
import type { Values } from "./index.ts";

export type Query = NodeFactory<"Query", { query: string }>;

export const QUERY = NodeResolver("QUERY", (node, ctx) => {
  const result = ctx.vertex<Values, Values>("values", (input) => {
    const values = input[0];
    if (values === undefined) return Tag("values", new Map());

    const filtered = values.entries().filter((e) => applyFilter(e, node.query));

    return Tag("values", new Map(filtered));
  });

  ctx.edge(ctx.values, result);

  return result;
});

function applyFilter([key, value]: [string, number], query: string): boolean {
  const [selector, params] = query.split("?");

  const selectorSegments = selector.split(".");
  const nameSegments = key.split(".");

  const isInSelection = selectorSegments
    .every((segment, index) => segment === nameSegments[index]);

  if (!isInSelection) return false;
  if (params === undefined) return true;

  const [param] = params.split(";");

  const operator = getOperator(param);
  if (operator === undefined) return false;

  return apply(value, operator, param);
}

function getOperator(expression: string) {
  return CONDITION_OPERATORS.find((o) => expression.includes(o));
}

function apply(
  value: number,
  operator: ConditionKind,
  expression: string,
): boolean {
  const comparator = Number(expression.replace(operator, ""));
  return condition(value, operator, comparator);
}
