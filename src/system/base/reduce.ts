import { Tag } from "../../lib/tag.ts";
import {
  type Num,
  reduce,
  type Resolver,
  Undefined,
  type Values,
} from "../parse.ts";
import type { BinopKind } from "./binop.ts";
import type { Expression } from "../node.ts";
import type { Query } from "./query.ts";
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
