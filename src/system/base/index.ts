import type { BinaryOperation } from "./binop.ts";
import type { Selector } from "./selector.ts";
import type { Choice as ChoiceType } from "./choice.ts";
import type { Condition } from "./condition.ts";
import type { Modifier as ModifierType, Override } from "./modifier.ts";
import type { Multiple } from "./multiple.ts";
import type { Query } from "./query.ts";
import type { Reduce } from "./reduce.ts";
import type { UnaryOperation } from "./unaryop.ts";
import type { ValueExpression, ValueStatement } from "./value.ts";
import type { Literal } from "./literal.ts";
import type { Null } from "./null.ts";
import { createExhaustiveTuple } from "../../lib/utils.ts";
import { type Creators, NodeFactory, type NodeMap } from "../node.ts";

type BaseExpression =
  | ValueExpression
  | Literal
  | Null
  | BinaryOperation
  | UnaryOperation
  | Query
  | Reduce
  | Selector;

type BaseStatement =
  | ValueStatement
  | Multiple
  | ModifierType
  | Override
  | Condition
  | ChoiceType;

export type BaseNode = BaseExpression | BaseStatement;

export type BASE_NODES = NodeMap<BaseNode>;
export const BASE_NODE_STATEMENT_NAMES = createExhaustiveTuple<
  BaseStatement["$type"]
>()([
  "CHOICE",
  "CONDITION",
  "MODIFIER",
  "MULTIPLE",
  "OVERRIDE",
  "VALUE",
]);
export const BASE_NODE_EXPRESSION_NAMES = createExhaustiveTuple<
  BaseExpression["$type"]
>()([
  "BINARYOPERATION",
  "LITERAL",
  "NULL",
  "QUERY",
  "REDUCE",
  "SELECTOR",
  "UNARYOPERATION",
  "VALUE",
]);
export const BaseNodeFactory: Creators<BaseNode> = NodeFactory<BaseNode>()(
  BASE_NODE_STATEMENT_NAMES,
)(BASE_NODE_EXPRESSION_NAMES);
