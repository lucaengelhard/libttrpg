import { Tag } from "../../lib/tag.ts";
import { type Num, reduce, type Resolver, Undefined } from "../parse.ts";
import type { Expression } from "../node.ts";

export type BinopKind =
  | "DIVIDE"
  | "SUBTRACT"
  | "ADD"
  | "MULTIPLY"
  | "MAX"
  | "MIN";

export type BinaryOperation = Expression<
  "BinaryOperation",
  { kind: BinopKind; left: Expression; right: Expression }
>;

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

export const BINARYOPERATION: Resolver<BinaryOperation> = (node, ctx) => {
  const left = ctx.resolve(node.left);
  const right = ctx.resolve(node.right);

  const result = ctx.vertex<Num, Num | Undefined>(
    "number",
    (values) => {
      if (values.length < 2) return Undefined;
      return Tag("number", reduce(node.kind, [values[0], values[1]]));
    },
  );

  ctx.edge(left, result);
  ctx.edge(right, result);

  return result;
};
