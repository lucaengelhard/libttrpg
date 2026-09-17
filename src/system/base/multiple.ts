import { NOOP, type Resolver } from "../parse.ts";
import type { Statement } from "../node.ts";

export type Multiple = Statement<
  "Multiple",
  { values: Statement[] }
>;

export const MULTIPLE: Resolver<Multiple> = (node, ctx) => {
  for (const value of node.values) {
    ctx.resolve(value);
  }
  return NOOP;
};
