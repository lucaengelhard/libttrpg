import { Tag } from "../../lib/tag.ts";
import type { Expression, Resolver } from "./index.ts";
import type { BinopKind } from "./binop.ts";
import type { Query } from "./query.ts";
import { type Num, reduce, Undefined, type Values } from "./index.ts";
import type { Selector } from "./selector.ts";

export type Reduce = Expression<
  "Reduce",
  {
    query: Query | Selector;
    kind: BinopKind;
  }
>;

export const REDUCE: Resolver<Reduce> = (node, ctx) => {
  const query = ctx.resolve(node.query);

  const result = ctx.vertex<Values, Num | Undefined>("values", (input) => {
    const values = input[0];
    if (values === undefined || values.size === 0) return Undefined;

    return Tag(
      "number",
      reduce(
        node.kind,
        values.values().toArray() as [number, ...number[]],
      ),
    );
  });

  ctx.edge(query, result);

  return result;
};
