import * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import type { Choice, Resolver, Values } from "../parse.ts";
import { Query } from "./query.ts";
import { type Infer, Schema } from "../schema.ts";

type SelectorSchema = {
  name: z.ZodString;
  count: z.ZodNumber;
  active: z.ZodArray<z.ZodString>;
  query: ReturnType<typeof Query["apply"]>;
};

export type Selector = Infer<typeof Selector>;
export const Selector: Schema<"Selector", SelectorSchema> = Schema(
  "Selector",
  (node) => ({
    name: z.string(),
    count: z.number().int().gte(0),
    active: z.array(z.string()),
    query: Query.apply(node),
  }),
);

export const SELECTOR: Resolver<Selector> = (node, ctx) => {
  const query = ctx.resolve(node.query);

  const result = ctx.vertex<Values, Values>("values", (input) => {
    const values = input[0];
    if (values === undefined) return Tag("values", new Map());

    const active = values
      .entries()
      .filter(([name]) => node.active.includes(name))
      .take(node.count);

    return Tag("values", new Map(active));
  });

  const choice = ctx.vertex<Values, Choice>("values", (input) => {
    const values = input[0];
    if (values === undefined) {
      return Tag("choice", [node.name, {
        options: [],
        active: node.active,
        count: node.count,
        type: node.$type,
      }]);
    }

    const options = values.keys().toArray();

    return Tag("choice", [node.name, {
      options,
      active: node.active,
      count: node.count,
      type: node.$type,
    }]);
  });

  ctx.edge(query, result);
  ctx.edge(query, choice);
  ctx.edge(choice, ctx.choices);

  return result;
};
