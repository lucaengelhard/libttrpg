import * as z from "@zod/zod";
import { type Resolver, VOID } from "../parse.ts";
import { type Infer, Schema } from "../schema.ts";

export type Multiple = Infer<typeof Multiple>;
export const Multiple = Schema("Multiple", (node) => ({
  values: z.array(node),
}));

export const MULTIPLE: Resolver<Multiple> = (node, ctx) => {
  for (const value of node.values) {
    ctx.resolve(value);
  }
  return VOID;
};
