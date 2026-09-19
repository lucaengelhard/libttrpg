import type * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import {
  type Num,
  reduce,
  type Resolver,
  Undefined,
  type Values,
} from "../parse.ts";

import type { Query } from "./query.ts";
import type { Selector } from "./selector.ts";
import { createNode, Expression } from "../schema.ts";
import { BinopKind } from "./binop.ts";

export type Reduce = z.infer<typeof Reduce>;
export const Reduce = createNode("Expression", "Reduce", {
  query: Expression("QUERY", "SELECTOR"),
  kind: BinopKind,
});

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
