import { Tag } from "../../lib/tag.ts";
import type { Expression, Resolver } from "./index.ts";
import { type Num, Undefined } from "./index.ts";

export type UnaryOpKind = "CEIL" | "FLOOR";

export type UnaryOperation = Expression<
  "UnaryOperation",
  { kind: UnaryOpKind; value: Expression }
>;

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
  const result = ctx.vertex<Num, Num | Undefined>("number", (values) => {
    if (values.length === 0) return Undefined;
    return Tag("number", unaryop(node.kind, values[0]));
  });

  ctx.edge(value, result);

  return result;
};
