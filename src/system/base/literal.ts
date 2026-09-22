import * as z from "@zod/zod";
import { Tag } from "../../lib/tag.ts";
import type { Resolver } from "../parse.ts";
import { type Infer, Schema } from "../schema.ts";

type LiteralSchema = {
  value: z.ZodNumber;
};

export type Literal = Infer<typeof Literal>;
export const Literal: Schema<"Literal", LiteralSchema> = Schema(
  "Literal",
  () => ({
    value: z.number(),
  }),
);

export const LITERAL: Resolver<Literal> = (node, ctx) => {
  const result = ctx.source(() => Tag("number", node.value));
  return result;
};
