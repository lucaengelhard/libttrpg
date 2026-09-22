import * as z from "@zod/zod";
import { Tag } from "../../lib/tag.ts";
import {
  getNumber,
  type Named,
  type Num,
  reduce,
  type Resolver,
  Undefined,
} from "../parse.ts";
import { type Infer, Schema } from "../schema.ts";

const BINOP_KINDS = [
  "DIVIDE",
  "SUBTRACT",
  "ADD",
  "MULTIPLY",
  "MAX",
  "MIN",
] as const;

export type BinopKind = typeof BINOP_KINDS[number];
export const BinopKind: z.ZodUnion<z.ZodLiteral<BinopKind>[]> = z.union(
  BINOP_KINDS.map((o) => z.literal(o)),
);

export type BinaryOperation = Infer<typeof BinaryOperation>;
export const BinaryOperation = Schema("BinaryOperation", (node) => ({
  kind: BinopKind,
  left: node,
  right: node,
}));

export function binop(kind: BinopKind, left: number, right: number): number {
  switch (kind) {
    case "DIVIDE":
      return left / right;
    case "SUBTRACT":
      return left - right;
    case "ADD":
      return left + right;
    case "MULTIPLY":
      return left * right;
    case "MAX":
      return Math.max(left, right);
    case "MIN":
      return Math.min(left, right);
  }
}

export const BINARYOPERATION: Resolver<BinaryOperation> = (
  node,
  ctx,
) => {
  const left = ctx.resolve(node.left);
  const right = ctx.resolve(node.right);

  const result = ctx.vertex<Num | Named, Num | Undefined>(
    ["number", "named"],
    (values) => {
      if (values.length < 2) return Undefined;
      return Tag(
        "number",
        reduce(node.kind, [getNumber(values[0]), getNumber(values[1])]),
      );
    },
  );

  ctx.edge(left, result);
  ctx.edge(right, result);

  return result;
};
