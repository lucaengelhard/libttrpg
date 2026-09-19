import * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import type { Resolver } from "../parse.ts";
import { NodeSchema, type ZodNode } from "../schema.ts";

export type Literal = z.infer<typeof Literal>;
export const Literal: ZodNode<"Literal", { value: z.ZodNumber }> = NodeSchema(
  "Literal",
  {
    value: z.number(),
  },
);

export const LITERAL: Resolver<Literal> = (node, ctx) => {
  const result = ctx.source(() => Tag("number", node.value));
  return result;
};
