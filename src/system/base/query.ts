import * as z from "@zod/zod";
import { Tag } from "../../lib/tag.ts";
import type { Resolver, Values } from "../parse.ts";
import {
  condition,
  CONDITION_OPERATORS,
  type ConditionKind,
} from "./condition.ts";
import { type Infer, Schema } from "../schema.ts";

type QuerySchema = { query: z.ZodString };

export type Query = Infer<typeof Query>;
export const Query: Schema<"Query", QuerySchema> = Schema(
  "Query",
  () => ({ query: z.string() }), // TODO make query string schema
);

export const QUERY: Resolver<Query> = (node, ctx) => {
  const result = ctx.vertex<Values, Values>("values", (input) => {
    const values = input[0];
    if (values === undefined) return Tag("values", new Map());

    const filtered = values.entries().filter((e) => applyFilter(e, node.query));

    return Tag("values", new Map(filtered));
  });

  ctx.edge(ctx.values, result);

  return result;
};

function applyFilter([key, value]: [string, number], query: string): boolean {
  const [selector, params] = query.split("?");

  const selectorSegments = selector.split(".");
  const nameSegments = key.split(".");

  const isInSelection = selectorSegments
    .every((segment, index) => segment === nameSegments[index]);

  if (!isInSelection) return false;
  if (params === undefined) return true;

  const paramEls = params.split(";");

  return paramEls.every((param) => {
    const [category, ...rest] = param.split("=");
    const args = rest.join("=").trim();

    switch (category) {
      case "value": {
        const comparatorString = args.substring(1).replace(")", "");
        const operator = getOperator(comparatorString);
        if (operator === undefined) return false;

        return applyComparator(value, operator, comparatorString);
      }
      case "name": {
        const options = args.split("|");
        const name = nameSegments[nameSegments.length - 1];

        return options.includes(name);
      }
    }

    return false;
  });
}

function getOperator(expression: string) {
  return CONDITION_OPERATORS.find((o) => expression.includes(o));
}

function applyComparator(
  value: number,
  operator: ConditionKind,
  expression: string,
): boolean {
  const comparator = Number(expression.replace(operator, ""));
  return condition(value, operator, comparator);
}
