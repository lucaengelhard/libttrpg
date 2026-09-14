import type { Node, NodeFactory } from "./index.ts";
import { NodeResolver, NOOP } from "./index.ts";

export type Multiple = NodeFactory<"Multiple", { values: Node[] }>;

export const MULTIPLE = NodeResolver("MULTIPLE", (node, ctx) => {
  for (const value of node.values) {
    ctx.resolve(value);
  }
  return NOOP;
});
