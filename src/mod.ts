import { BASE_SCHEMATA, type BaseNode } from "./system/base/index.ts";
import { SUGAR_SCHEMATA, type SugarNode } from "./system/sugar.ts";
import { createFactory } from "./system/build.ts";
import { SchemaMap } from "./system/schema.ts";

export type { Library } from "./system/library.ts";
export {
  createLibrarySchema,
  importLibrary,
  lookup,
} from "./system/library.ts";

export type { Infer, Node, SchemaNode, ZodNode } from "./system/schema.ts";
export { createSchema, isNode, Schema } from "./system/schema.ts";

export { createFactory } from "./system/build.ts";

export {
  deleteNode,
  getAll,
  getValue,
  hasValue,
  setValue,
} from "./system/getset.ts";

export { hashObj, memoize } from "./lib/hash.ts";

export type { ResolverMap } from "./system/parse.ts";
export { parse } from "./system/parse.ts";

export type { Handlers } from "./system/sugar.ts";
export { desugar, SUGAR_HANDLERS } from "./system/sugar.ts";

export type { BaseNode } from "./system/base/index.ts";
export { BaseResolverMap } from "./system/base/index.ts";

export type CoreNode = BaseNode | SugarNode;
export const CORE_SCHEMATA = [...BASE_SCHEMATA, ...SUGAR_SCHEMATA] as const;
export const CORE = SchemaMap(...CORE_SCHEMATA);
export const CoreNodeFactory = createFactory<CoreNode>();
