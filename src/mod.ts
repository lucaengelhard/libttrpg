import {
  BASE_NODE_EXPRESSION_NAMES,
  BASE_NODE_STATEMENT_NAMES,
  type BaseNode,
} from "./system/base/index.ts";
import { type Creators, NodeFactory } from "./system/node.ts";
import {
  SUGAR_EXPRESSION_NAMES,
  SUGAR_STATEMENT_NAMES,
  type SugarNode,
} from "./system/sugar.ts";

// ----------------------------- //

export { createExhaustiveTuple, nestedMap } from "./lib/utils.ts";

export { parse, ResolverMap } from "./system/parse.ts";

export { deleteNode, getValue, hasValue, setValue } from "./system/getset.ts";

export type {
  Creators,
  Expression,
  Filter,
  Node,
  NodeMap,
  Statement,
} from "./system/node.ts";
export { isNode, NodeFactory } from "./system/node.ts";

export type { BASE_NODES, BaseNode } from "./system/base/index.ts";

export type { Handlers, SUGAR_NODES, SugarNode } from "./system/sugar.ts";
export { desugar, SUGAR_HANDLERS } from "./system/sugar.ts";

export const NODE_STATEMENT_NAMES = [
  ...BASE_NODE_STATEMENT_NAMES,
  ...SUGAR_STATEMENT_NAMES,
] as const;

export const NODE_EXPRESSION_NAMES = [
  ...BASE_NODE_EXPRESSION_NAMES,
  ...SUGAR_EXPRESSION_NAMES,
] as const;

export const Factory: Creators<BaseNode | SugarNode> = NodeFactory<
  BaseNode | SugarNode
>()([...NODE_STATEMENT_NAMES])([...NODE_EXPRESSION_NAMES]);
// TODO export each creator individually
