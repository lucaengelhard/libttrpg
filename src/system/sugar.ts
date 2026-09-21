import * as z from "zod";
import { type BaseNode, BaseNodeFactory } from "./base/index.ts";
import {
  type Infer,
  isNode,
  type Node,
  Schema,
  type SchemaNode,
} from "./schema.ts";

type Flag = Infer<typeof Flag>;
const Flag: Schema<
  "Flag",
  { name: z.ZodString; true: z.ZodOptional<z.ZodBoolean> }
> = Schema(
  "Flag",
  () => ({ name: z.string(), true: z.boolean().optional() }),
);

type If = Infer<typeof If>;
const If: Schema<"If", { flag: z.ZodString; effect: SchemaNode }> = Schema(
  "If",
  (node) => ({ flag: z.string(), effect: node }),
);

type Level = Infer<typeof Level>;
const Level: Schema<"Level", {
  reference: SchemaNode;
  levels: z.ZodRecord<z.ZodNumber, SchemaNode>;
}> = Schema("Level", (node) => ({
  reference: node,
  levels: z.record(z.number().int().gte(0), node),
}));

type Section = Infer<typeof Section>;
const Section: Schema<"Section", {
  name: z.ZodString;
  value: SchemaNode;
}> = Schema("Section", (node) => ({
  name: z.string(),
  value: node,
}));

type Get = Infer<typeof Get>;
const Get: Schema<"Get", { query: z.ZodString }> = Schema("Get", () => ({
  query: z.string(),
}));

export const SUGAR_SCHEMATA = [
  Flag,
  If,
  Level,
  Section,
  Get,
] as const;

export type SugarNode = Infer<typeof SUGAR_SCHEMATA[number]>;

type Handler<From extends Node, To extends Node, T extends Node> = (
  node: T,
) => From | To;

export type Handlers<From extends Node, To extends Node> = {
  [T in From as T["$type"]]: Handler<From, To, T>;
};

const { CONDITION, VALUE, LITERAL, MULTIPLE, REDUCE, QUERY } = BaseNodeFactory;

export const SUGAR_HANDLERS: Handlers<SugarNode, BaseNode> = {
  FLAG: (node) =>
    VALUE({ name: node.name, value: LITERAL({ value: node.true ? 1 : 0 }) }),
  IF: (node) =>
    CONDITION({
      kind: ">",
      left: QUERY({ query: node.flag }),
      right: LITERAL({ value: 0 }),
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
