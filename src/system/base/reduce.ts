import * as z from "@zod/zod";
import { Tag } from "../../lib/tag.ts";
import {
  type Num,
  reduce,
  type Resolver,
  Undefined,
  type Values,
} from "../parse.ts";
import { type Infer, Schema, type ZodNode } from "../schema.ts";
import { BinopKind } from "./binop.ts";
import { Query } from "./query.ts";
import { Selector } from "./selector.ts";

type ReduceSchema = {
  query: z.ZodUnion<(ZodNode<"Query"> | ZodNode<"Selector">)[]>;
  kind: typeof BinopKind;
};

export type Reduce = Infer<typeof Reduce>;
export const Reduce: Schema<"Reduce", ReduceSchema> = Schema(
  "Reduce",
  (node) => ({
    query: z.union([Query.apply(node), Selector.apply(node)]),
    kind: BinopKind,
  }),
);

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
