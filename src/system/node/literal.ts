import type { Expression, Resolver } from "./index.ts";
import { Tag } from "../../lib/tag.ts";

export type Literal = Expression<"Literal", { value: number }>;

export const LITERAL: Resolver<Literal> = (node, ctx) => {
  const result = ctx.source(() => Tag("number", node.value));
  return result;
};
