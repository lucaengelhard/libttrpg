import { createFactory } from "../build.ts";
import type { ZodNode } from "../schema.ts";
import { BinaryOperation } from "./binop.ts";
import { Choice } from "./choice.ts";
import { Condition } from "./condition.ts";
import { Literal } from "./literal.ts";
import { Modifier } from "./modifier.ts";
import { Multiple } from "./multiple.ts";
import { Null } from "./null.ts";
import { Query } from "./query.ts";
import { Reduce } from "./reduce.ts";
import { Selector } from "./selector.ts";
import { UnaryOperation } from "./unaryop.ts";
import { ValueExpression, ValueStatement } from "./value.ts";

export const BaseNodes = [
  BinaryOperation,
  Choice,
  Condition,
  Literal,
  Modifier,
  Multiple,
  Null,
  Query,
  Reduce,
  Selector,
  UnaryOperation,
  ValueExpression,
  ValueStatement,
] as const satisfies ZodNode[];

export type BaseNode = typeof BaseNodes[number];

export const BaseNodeFactory = createFactory(...BaseNodes);
