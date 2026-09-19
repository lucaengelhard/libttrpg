import * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import type { Resolver } from "../parse.ts";
import { createNode } from "../schema.ts";

export type Literal = z.infer<typeof Literal>;
export const Literal = createNode("Expression", "Literal", {
  value: z.number(),
});

export const LITERAL: Resolver<Literal> = (node, ctx) => {
  const result = ctx.source(() => Tag("number", node.value));
  return result;
};
