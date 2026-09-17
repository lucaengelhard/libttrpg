// SYSTEM
export type {
  BASE_NODES,
  BaseNode,
  Expression,
  GetExpressions,
  GetStatements,
  Node,
  NodeMap,
  Statement,
  Tree,
} from "./system/node/index.ts";
export { isNode, parse, ResolverMap } from "./system/node/index.ts";

export { getValue, hasValue, setValue } from "./system/getset.ts";

export type { Handlers, SUGAR_NODES, SugarNode } from "./system/sugar.ts";
export { desugar, SUGAR_HANDLERS } from "./system/sugar.ts";

// UTILS
export type { OmitDistributive } from "./lib/utils.ts";
export { nestedMap } from "./lib/utils.ts";
