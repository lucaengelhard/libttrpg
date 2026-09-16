import type { Condition } from "./node/condition.ts";
import type {
  BaseExpression,
  BaseNode,
  BaseStatement,
  NodeFactory,
} from "./node/index.ts";
import type { Query } from "./node/query.ts";
import { createTraversal } from "./traverse.ts";

type ExtendAST<
  T,
  BaseStatementType,
  BaseExpressionType,
  StatementSugar,
  ExpressionSugar,
> = T extends infer Item ? Item extends BaseExpressionType ?
      | {
        [K in keyof Item]: ExtendAST<
          Item[K],
          BaseStatementType,
          BaseExpressionType,
          StatementSugar,
          ExpressionSugar
        >;
      }
      | ExpressionSugar
  : Item extends BaseStatementType ?
      | {
        [K in keyof Item]: ExtendAST<
          Item[K],
          BaseStatementType,
          BaseExpression,
          StatementSugar,
          ExpressionSugar
        >;
      }
      | StatementSugar
  : Item extends Array<infer Element> ? Array<
      ExtendAST<
        Element,
        BaseStatementType,
        BaseExpressionType,
        StatementSugar,
        ExpressionSugar
      >
    >
  : Item extends Record<string, infer Element> ? Record<
      string,
      ExtendAST<
        Element,
        BaseStatementType,
        BaseExpressionType,
        StatementSugar,
        ExpressionSugar
      >
    >
  : Item
  : never;

type Switch = NodeFactory<
  "Switch",
  { name: string; effect: Node; active: boolean }
>;

type Level = NodeFactory<
  "Level",
  {
    reference: BaseExpression;
    levels: Record<number, Node>;
  }
>;

type Section = NodeFactory<
  "Section",
  { name: string; value: Node }
>;

type Get = NodeFactory<"Get", { query: string }>;

type StatementSugar = Switch | Level | Section;
type ExpressionSugar = Get;

export type Node = ExtendAST<
  BaseNode,
  BaseStatement,
  BaseExpression,
  StatementSugar,
  ExpressionSugar
>;

export type Statement = Extract<Node, { type: StatementSugar["type"] }>;
export type Expression = Extract<Node, { type: ExpressionSugar["type"] }>;

const baseDesugarer = createTraversal<BaseNode, BaseNode, undefined>(
  {
    VALUE: (node, desugar) => ({
      ...node,
      value: typeof node.value === "number"
        ? node.value
        : desugar(node.value) as BaseExpression,
    }),
    BINARYOPERATION: (node, desugar) => ({
      ...node,
      left: desugar(node.left) as BaseExpression,
      right: desugar(node.right) as BaseExpression,
    }),
    UNARYOPERATION: (node, desugar) => ({
      ...node,
      value: desugar(node.value) as BaseExpression,
    }),
    MULTIPLE: (node, desugar) => ({
      ...node,
      values: node.values.map((v) => desugar(v)),
    }),
    MODIFIER: (node, desugar) => ({
      ...node,
      value: desugar(node.value) as BaseExpression,
    }),
    OVERRIDE: (node, desugar) => ({
      ...node,
      value: desugar(node.value) as BaseExpression,
    }),
    CONDITION: (node, desugar) => ({
      ...node,
      left: desugar(node.left) as BaseExpression,
      right: desugar(node.right) as BaseExpression,
      effect: desugar(node.effect),
    }),

    REDUCE: (node) => node,
    QUERY: (node) => node,
    CHOICE: (node, desugar) => {
      const options = Object.fromEntries(
        Object
          .entries(node.options)
          .map(([key, value]) => [key, desugar(value)]),
      );

      return { ...node, options };
    },
    SELECTOR: (node, desugar) => ({
      ...node,
      query: desugar(node.query) as Query,
    }),
  },
);

export const desugar = createTraversal<
  Statement | Expression,
  BaseNode,
  undefined
>(
  {
    SWITCH: (node, desugar) => ({
      type: "CONDITION",
      kind: "==",
      left: { type: "VALUE", value: 1 },
      right: { type: "VALUE", value: node.active ? 1 : 0 },
      effect: desugar(node.effect),
    }),
    LEVEL: (node, desugar) => {
      const values: Condition[] = Object.entries(node.levels).map(
        ([levelStr, effect]) => {
          return {
            type: "CONDITION",
            left: { type: "VALUE", value: parseInt(levelStr) },
            kind: "<=",
            right: node.reference,
            effect: desugar(effect),
          };
        },
      );

      return { type: "MULTIPLE", values };
    },
    SECTION: (node, desugar) => desugar(node.value as ExpressionSugar),
    GET: (node) => ({
      type: "REDUCE",
      kind: "MAX",
      query: { type: "QUERY", query: node.query },
    }),
  },
  baseDesugarer,
);
