import * as z from "@zod/zod";
import { Tag } from "../../lib/tag.ts";
import {
  getNumber,
  type Named,
  type Num,
  type Resolver,
  Undefined,
} from "../parse.ts";
import { type Infer, Schema, type SchemaNode } from "../schema.ts";

const UNARYOP_KINDS = ["CEIL", "FLOOR"] as const;

export type UnaryOpKind = typeof UNARYOP_KINDS[number];
export const UnaryOpKind: z.ZodUnion<z.ZodLiteral<UnaryOpKind>[]> = z.union(
  UNARYOP_KINDS.map((o) => z.literal(o)),
);

type UnaryOperationSchema = {
  kind: typeof UnaryOpKind;
  value: SchemaNode;
};

export type UnaryOperation = Infer<typeof UnaryOperation>;
export const UnaryOperation: Schema<"UnaryOperation", UnaryOperationSchema> =
  Schema("UnaryOperation", (node) => ({
    kind: UnaryOpKind,
    value: node,
  }));

export function unaryop(kind: UnaryOpKind, value: number): number {
  switch (kind) {
    case "CEIL":
      return Math.ceil(value);
    case "FLOOR":
      return Math.floor(value);
  }
}

export const UNARYOPERATION: Resolver<UnaryOperation> = (node, ctx) => {
  const value = ctx.resolve(node.value);
  const result = ctx.vertex<Num | Named, Num | Undefined>(
    ["number", "named"],
    (values) => {
      if (values.length === 0) return Undefined;
      return Tag("number", unaryop(node.kind, getNumber(values[0])));
    },
  );

  ctx.edge(value, result);

  return result;
};
