import type { Expression } from "../node.ts";
import { Tag } from "../../lib/tag.ts";
import type { Resolver } from "../parse.ts";

export type Literal = Expression<"Literal", { value: number }>;

export const LITERAL: Resolver<Literal> = (node, ctx) => {
  const result = ctx.source(() => Tag("number", node.value));
  return result;
};
