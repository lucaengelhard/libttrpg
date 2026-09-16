import type { BaseNode, NodeFactory } from "./index.ts";
import { NodeResolver, NOOP } from "./index.ts";

export type Multiple = NodeFactory<"Multiple", { values: BaseNode[] }>;

export const MULTIPLE = NodeResolver("MULTIPLE", (node, ctx) => {
  for (const value of node.values) {
    ctx.resolve(value);
  }
  return NOOP;
});
