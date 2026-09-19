import * as z from "zod";
import { type Resolver, VOID } from "../parse.ts";
import { Child, NodeSchema, type ZodNode } from "../schema.ts";

export type Multiple = z.infer<typeof Multiple>;
export const Multiple: ZodNode<"Multiple", { values: z.ZodArray<ZodNode> }> =
  NodeSchema("Multiple", {
    values: z.array(Child()),
  });

export const MULTIPLE: Resolver<Multiple> = (node, ctx) => {
  for (const value of node.values) {
    ctx.resolve(value);
  }
  return VOID;
};
