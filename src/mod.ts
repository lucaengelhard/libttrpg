import type { Node as BaseNode } from "./system/node/index.ts";
import type { Sugar } from "./system/sugar.ts";
export { createTraversal } from "./system/traverse.ts";
export type { AnyNode } from "./system/traverse.ts";

export type {
  Node as BaseNode,
  NodeFactory,
  Resolvable,
} from "./system/node/index.ts";
export { is, parse } from "./system/node/index.ts";

export { desugar } from "./system/sugar.ts";
export type { Extend } from "./system/sugar.ts";
export type Node = BaseNode | Sugar;

export { getOr, getValue, setOr, setValue } from "./system/value.ts";
export type { GetCtx, SetCtx } from "./system/value.ts";

export { nestedMap } from "./lib/utils.ts";
