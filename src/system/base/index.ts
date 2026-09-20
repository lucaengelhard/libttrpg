import { createFactory } from "../build.ts";
import type { ResolverMap } from "../parse.ts";
import { BINARYOPERATION, BinaryOperation } from "./binop.ts";
import { CHOICE, Choice } from "./choice.ts";
import { CONDITION, Condition } from "./condition.ts";
import { LITERAL, Literal } from "./literal.ts";
import { MODIFIER, Modifier, OVERRIDE, Override } from "./modifier.ts";
import { MULTIPLE, Multiple } from "./multiple.ts";
import { NULL, Null } from "./null.ts";
import { QUERY, Query } from "./query.ts";
import { REDUCE, Reduce } from "./reduce.ts";
import { SELECTOR, Selector } from "./selector.ts";
import { UNARYOPERATION, UnaryOperation } from "./unaryop.ts";
import { VALUE, Value } from "./value.ts";
import type { Infer } from "../schema.ts";

export const BASE_SCHEMATA = [
  BinaryOperation,
  Choice,
  Condition,
  Literal,
  Modifier,
  Override,
  Multiple,
  Null,
  Query,
  Reduce,
  Selector,
  UnaryOperation,
  Value,
] as const;

export type BaseNode = Infer<typeof BASE_SCHEMATA[number]>;
export const BaseNodeFactory = createFactory<BaseNode>();

export const BaseResolverMap: ResolverMap<BaseNode> = {
  BINARYOPERATION,
  MULTIPLE,
  CHOICE,
  CONDITION,
  MODIFIER,
  OVERRIDE,
  QUERY,
  REDUCE,
  SELECTOR,
  UNARYOPERATION,
  VALUE,
  LITERAL,
  NULL,
};
