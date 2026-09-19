import * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import {
  getNumber,
  type Named,
  type Num,
  type Resolver,
  Undefined,
} from "../parse.ts";
import { createNode, Expression } from "../schema.ts";

export type UnaryOpKind = z.infer<typeof UnaryOpKind>;
export const UnaryOpKind = z.union([z.literal("CEIL"), z.literal("FLOOR")]);

export type UnaryOperation = z.infer<typeof UnaryOperation>;
export const UnaryOperation = createNode("Expression", "UnaryOperation", {
  kind: UnaryOpKind,
  value: Expression(),
});

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
