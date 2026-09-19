import * as z from "zod";
import { type BaseNode, BaseNodeFactory } from "./base/index.ts";
import {
  Child,
  isNode,
  type Node,
  NodeSchema,
  type ZodNode,
} from "./schema.ts";

type Switch = z.infer<typeof Switch>;
const Switch: ZodNode<"Switch", {
  name: z.ZodString;
  effect: ZodNode;
  active: z.ZodBoolean;
}> = NodeSchema("Switch", {
  name: z.string(),
  effect: Child(),
  active: z.boolean(),
});

type Level = z.infer<typeof Level>;
const Level: ZodNode<"Level", {
  reference: ZodNode;
  levels: z.ZodRecord<z.ZodNumber, ZodNode>;
}> = NodeSchema("Level", {
  reference: Child(),
  levels: z.record(z.number().int().gte(0), Child()),
});

type SectionStatement = z.infer<typeof SectionStatement>;
const SectionStatement: ZodNode<"Section", {
  name: z.ZodString;
  value: ZodNode;
}> = NodeSchema("Section", {
  name: z.string(),
  value: Child(),
});

type SectionExpression = z.infer<typeof SectionExpression>;
const SectionExpression: ZodNode<"Section", {
  name: z.ZodString;
  value: ZodNode;
}> = NodeSchema("Section", {
  name: z.string(),
  value: Child(),
});

type Get = z.infer<typeof Get>;
const Get: ZodNode<"Get", {
  query: z.ZodString;
}> = NodeSchema("Get", { query: z.string() });

export const SUGAR_NODES = [
  Switch,
  Level,
  SectionStatement,
  SectionExpression,
  Get,
] as const;

export type SugarNode = z.infer<typeof SugarNode>;
export const SugarNode: z.ZodUnion<typeof SUGAR_NODES> = z.union(SUGAR_NODES);

type Handler<From extends Node, To extends Node, T extends Node> = (
  node: T,
) => From | To;

export type Handlers<From extends Node, To extends Node> = {
  [T in From as T["$type"]]: Handler<From, To, T>;
};

const { CONDITION, VALUE, LITERAL, MULTIPLE, REDUCE, QUERY } = BaseNodeFactory;

export const SUGAR_HANDLERS: Handlers<SugarNode, BaseNode> = {
  SWITCH: (node) =>
    CONDITION({
      kind: "==",
      left: VALUE({ value: LITERAL({ value: 1 }) }),
      right: VALUE({
        value: LITERAL({ value: node.active ? 1 : 0 }),
      }),
      effect: node.effect,
    }),
  LEVEL: (node) => {
    const values = Object.entries(node.levels).map(
      ([levelStr, effect]) => {
        return CONDITION({
          left: VALUE({
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
