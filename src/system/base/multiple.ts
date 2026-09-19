import * as z from "zod";
import { NOOP, type Resolver } from "../parse.ts";
import { createNode, Statement } from "../schema.ts";

export type Multiple = z.infer<typeof Multiple>;
export const Multiple = createNode("Statement", "Multiple", {
  values: z.array(Statement()),
});

export const MULTIPLE: Resolver<Multiple> = (node, ctx) => {
  for (const value of node.values) {
    ctx.resolve(value);
  }
  return NOOP;
};
