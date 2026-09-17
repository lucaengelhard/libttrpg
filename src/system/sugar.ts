import { createExhaustiveTuple } from "../lib/utils.ts";
import { type BaseNode, BaseNodeFactory } from "./base/index.ts";
import {
  type Expression,
  isNode,
  type Node,
  NodeFactory,
  type NodeMap,
  type Statement,
} from "./node.ts";

type Switch = Statement<
  "Switch",
  { name: string; effect: Statement; active: boolean }
>;

type Level = Statement<
  "Level",
  {
    reference: Expression;
    levels: Record<number, Statement>;
  }
>;

type SectionStatement = Statement<
  "Section",
  { name: string; value: Statement }
>;
type SectionExpression = Expression<
  "Section",
  { name: string; value: Expression }
>;

type Get = Expression<"Get", { query: string }>;

type SugarStatement = Switch | Level | SectionStatement;
type SugarExpression = Get | SectionExpression;
export type SugarNode = SugarStatement | SugarExpression;

export type SUGAR_NODES = NodeMap<SugarNode>;
export const SUGAR_STATEMENT_NAMES = createExhaustiveTuple<
  SugarStatement["$type"]
>()(["LEVEL", "SECTION", "SWITCH"]);
export const SUGAR_EXPRESSION_NAMES = createExhaustiveTuple<
  SugarExpression["$type"]
>()(["GET", "SECTION"]);
export const SugarNodeFactory = NodeFactory<SugarNode>()(SUGAR_STATEMENT_NAMES)(
  SUGAR_EXPRESSION_NAMES,
);

type Handler<From extends Node, To extends Node, T extends string> = (
  node: Extract<From | To, { $type: T }>,
) => From | To;

export type Handlers<From extends Node, To extends Node> = {
  [T in From["$type"]]: Handler<From, To, T>;
};

const { CONDITION, VALUE_EXPRESSION, LITERAL, MULTIPLE, REDUCE, QUERY } =
  BaseNodeFactory;

export const SUGAR_HANDLERS: Handlers<SugarNode, BaseNode> = {
  SWITCH: (node) =>
    CONDITION({
      kind: "==",
      left: VALUE_EXPRESSION({ value: LITERAL({ value: 1 }) }),
      right: VALUE_EXPRESSION({
        value: LITERAL({ value: node.active ? 1 : 0 }),
      }),
      effect: node.effect,
    }),
  LEVEL: (node) => {
    const values = Object.entries(node.levels).map(
      ([levelStr, effect]) => {
        return CONDITION({
          left: VALUE_EXPRESSION({
            value: LITERAL({ value: parseInt(levelStr) }),
          }),
          kind: "<=",
          right: node.reference,
          effect,
        });
      },
    );

    return MULTIPLE({ values });
  },
  GET: (node) =>
    REDUCE({
      kind: "MAX",
      query: QUERY({ query: node.query }),
    }),
  SECTION: (node) => node.value as BaseNode | SugarNode,
};

export function desugar<From extends Node, To extends Node>(
  node: From | To,
  handlers: Handlers<From, To>,
): To {
  if (!isNode(node)) {
    if (Array.isArray(node)) {
      return (node as (From | To)[]).map((v) =>
        desugar(v, handlers)
      ) as unknown as To;
    }

    return node as To;
  }

  const handler = handlers[node.$type as keyof typeof handlers] as unknown as
    | Handler<From, To, string>
    | undefined;

  const transformed =
    (handler
      ? handler(node as Extract<From, { $type: string }>)
      : node) as Node;

  if (transformed.$type in handlers) {
    return desugar(transformed as From, handlers);
  }

  return Object.fromEntries(
    Object.entries(transformed)
      .map(([key, value]) => [key, desugar(value as From, handlers)]),
  ) as To;
}
