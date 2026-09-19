import type * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import {
  type Num,
  reduce,
  type Resolver,
  Undefined,
  type Values,
} from "../parse.ts";
import { Child, NodeSchema, type ZodNode } from "../schema.ts";
import { BinopKind } from "./binop.ts";

export type Reduce = z.infer<typeof Reduce>;
export const Reduce: ZodNode<
  "Reduce",
  {
    query: ZodNode<"QUERY" | "SELECTOR">;
    kind: typeof BinopKind;
  }
> = NodeSchema("Reduce", {
  query: Child("QUERY", "SELECTOR"),
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
