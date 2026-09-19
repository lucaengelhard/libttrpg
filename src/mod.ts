import { BASE_NODES, type BaseNode } from "./system/base/index.ts";
import { createFactory, type Factory } from "./system/build.ts";
import { SUGAR_NODES, type SugarNode } from "./system/sugar.ts";

export * as z from "zod";

export { deserialize, serialize } from "./store/serialize.ts";
export type { Library } from "./store/library.ts";
export { libraryLookup } from "./store/library.ts";

export type { Node, ZodNode } from "./system/schema.ts";
export {
  Child,
  createRegistry,
  isNode,
  NodeSchema,
  toJSONSchema,
} from "./system/schema.ts";

export type { Factory } from "./system/build.ts";
export { createFactory } from "./system/build.ts";

export { deleteNode, getValue, hasValue, setValue } from "./system/getset.ts";

export type { ResolverMap } from "./system/parse.ts";
export { parse } from "./system/parse.ts";

export type { Handlers, SugarNode } from "./system/sugar.ts";
export { desugar, SUGAR_HANDLERS, SUGAR_NODES } from "./system/sugar.ts";

export type { BaseNode } from "./system/base/index.ts";
export { BaseResolverMap } from "./system/base/index.ts";

export type CoreNode = BaseNode | SugarNode;
export const CORE_NODES = [...BASE_NODES, ...SUGAR_NODES] as const;
export const CoreNodeFactory: Factory<CoreNode> = createFactory(...CORE_NODES);
