import type { OmitDistributive } from "../lib/utils.ts";
import {
  type BaseNode,
  type Expression,
  isNode,
  type Node,
  type NodeMap,
  type Statement,
  type Tree,
} from "./node/index.ts";

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

type Get = Expression<"Get", { query: string }>;

type SugarStatement = Switch | Level;
type SugarExpression = Get;
export type SugarNode = SugarStatement | SugarExpression;
export type SUGAR_NODES = NodeMap<SugarNode>;

type Handler<From extends Node, To extends Node, T extends string> = (
  node: Extract<From | To, { $type: T }>,
) => OmitDistributive<From | To, "$kind">;

export type Handlers<From extends Node, To extends Node> = {
  [T in From["$type"]]: Handler<From, To, T>;
};

export const SUGAR_HANDLERS: Handlers<SugarNode, BaseNode> = {
  SWITCH: (node) => ({
    $type: "CONDITION",
    kind: "==",
    left: { $type: "VALUE", value: { $type: "LITERAL", value: 1 } },
    right: {
      $type: "VALUE",
      value: { $type: "LITERAL", value: node.active ? 1 : 0 },
    },
    effect: node.effect,
  }),
  LEVEL: (node) => {
    const values = Object.entries(node.levels).map(
      ([levelStr, effect]) => {
        return {
          $type: "CONDITION",
          left: {
            $type: "VALUE",
            value: { $type: "LITERAL", value: parseInt(levelStr) },
          },
          kind: "<=",
          right: node.reference,
          effect,
        } as const;
      },
    );

    return { $type: "MULTIPLE", values };
  },
  GET: (node) => ({
    $type: "REDUCE",
    kind: "MAX",
    query: { $type: "QUERY", query: node.query },
  }),
};

export function desugar<From extends Node, To extends Node>(
  node: Tree<From | To, From | To>,
  handlers: Handlers<From, To>,
): Tree<To, To> {
  if (!isNode(node)) {
    if (Array.isArray(node)) {
      return node.map((v) => desugar(v, handlers)) as unknown as Tree<To, To>;
    }

    return node as unknown as Tree<To, To>;
  }

  const handler = handlers[node.$type as keyof typeof handlers] as unknown as
    | Handler<From, To, string>
    | undefined;

  const transformed =
    (handler
      ? handler(node as Extract<From, { $type: string }>)
      : node) as Node;

  if (transformed.$type in handlers) {
    return desugar(transformed as Tree<From | To, From | To>, handlers);
  }

  return Object.fromEntries(
    Object.entries(transformed).map((
      [key, value],
    ) => [key, desugar(value as Tree<From | To, From | To>, handlers)]),
  ) as Tree<To, To>;
}
