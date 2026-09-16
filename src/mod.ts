export { createTraversal } from "./system/traverse.ts";
export type { AnyNode } from "./system/traverse.ts";

export type {
  BaseExpression,
  BaseNode,
  BaseStatement,
  NodeFactory,
} from "./system/node/index.ts";
export { is, parse } from "./system/node/index.ts";

export { desugar } from "./system/sugar.ts";
export type { Expression, ExtendAST, Node, Statement } from "./system/sugar.ts";

export { getOr, getValue, setOr, setValue } from "./system/getset.ts";
export type { GetCtx, SetCtx } from "./system/getset.ts";

export { nestedMap } from "./lib/utils.ts";
