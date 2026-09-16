import { Tag } from "../../lib/tag.ts";
import type { Query } from "./query.ts";
import type { Choice, Expression, Resolver, Values } from "./index.ts";

export type Selector = Expression<
  "Selector",
  {
    name: string;
    count: number;
    active: string[];
    query: Query;
  }
>;

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
