import * as z from "zod";
import { type BaseNode, BaseNodeFactory } from "./base/index.ts";
import {
  createNode,
  Expression,
  isNode,
  type Node,
  Statement,
} from "./schema.ts";

type Switch = z.infer<typeof Switch>;
const Switch = createNode("Statement", "Switch", {
  name: z.string(),
  effect: Statement(),
  active: z.boolean(),
});

type Level = z.infer<typeof Level>;
const Level = createNode("Statement", "Level", {
  reference: Expression(),
  levels: z.record(z.number().int().gte(0), Statement()),
});

type SectionStatement = z.infer<typeof SectionStatement>;
const SectionStatement = createNode("Statement", "Section", {
  name: z.string(),
  value: Statement(),
});

type SectionExpression = z.infer<typeof SectionExpression>;
const SectionExpression = createNode("Expression", "Section", {
  name: z.string(),
  value: Expression(),
});

type Get = z.infer<typeof Get>;
const Get = createNode("Expression", "Get", { query: z.string() });

export const SugarNodes = z.union([
  Switch,
  Level,
  SectionStatement,
  SectionExpression,
  Get,
]);

export type SugarNode = z.infer<typeof SugarNodes>;

type Handler<From extends Node, To extends Node, T extends Node> = (
  node: T,
) => From | To;

export type Handlers<From extends Node, To extends Node> = {
  [T in From as T["$type"]]: Handler<From, To, T>;
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

    if (typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node)
          .map((
            [key, value],
          ) => [key, desugar(value as (From | To), handlers)]),
      ) as unknown as To;
    }

    return node as To;
  }

  const handler = handlers[node.$type as keyof typeof handlers] as unknown as
    | Handler<From, To, From | To>
    | undefined;

  const transformed = handler ? handler(node) : node;

  if (transformed.$type as string in handlers) {
    return desugar(transformed as From, handlers);
  }

  return Object.fromEntries(
    Object.entries(transformed)
      .map((
        [key, value],
      ) => [key, desugar(value as unknown as From, handlers)]),
  ) as unknown as To;
}
