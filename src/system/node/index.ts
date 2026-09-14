import { Edge, GraphBuilder, Vertex } from "../../lib/graph.ts";
import { Tag } from "../../lib/tag.ts";
import {
  BINARYOPERATION,
  type BinaryOperation,
  binop,
  type BinopKind,
} from "./binop.ts";
import { SELECTOR, type Selector } from "./selector.ts";
import { CHOICE, type Choice as ChoiceType } from "./choice.ts";
import { CONDITION, type Condition } from "./condition.ts";
import { MODIFIER, OVERRIDE, type Override } from "./modifier.ts";
import { MULTIPLE, type Multiple } from "./multiple.ts";
import { QUERY, type Query } from "./query.ts";
import { REDUCE, type Reduce } from "./reduce.ts";
import { UNARYOPERATION, type UnaryOperation } from "./unaryop.ts";
import { VALUE, type Value } from "./value.ts";
import type { Modifier as ModifierType } from "./modifier.ts";

// Nodes
type Readable<R extends Record<string, unknown>> = {
  [K in keyof R]: R[K]; // TODO make recursive
};

export type NodeFactory<
  Type extends string,
  Values extends Record<string, unknown>,
> = Readable<
  {
    type: Uppercase<Type>;
  } & Values
>;

export type Resolvable =
  | Value
  | BinaryOperation
  | UnaryOperation
  | Query
  | Reduce
  | Selector;

export type Node =
  | Resolvable
  | Multiple
  | ModifierType
  | Override
  | Condition
  | ChoiceType;

export function is<T extends Node["type"]>(
  value: unknown,
  nodeType: T,
): value is Extract<Node, { type: T }> {
  return value !== null && value !== undefined && typeof value === "object" &&
    "type" in value && typeof value.type === "string" &&
    value.type === nodeType;
}

// TYPES
export type Bool = Tag<"boolean", boolean>;

export const True = Tag("boolean", true);
export const False: Bool = Tag("boolean", false);

export type Num = Tag<"number", number>;

export type Undefined = Tag<"undefined", undefined>;
export const Undefined: Undefined = Tag("undefined", undefined);

export type Named = Tag<"named", [string, number]>;
export type Values = Tag<"values", Map<string, number>>;

export type Modifier = Tag<"modifier", [string, number][]>;
export type Modifiers = Tag<"modifiers", Map<string, number[]>>;

type ChoiceObj = {
  options: string[];
  active: string[];
  count: number;
  type: (Selector | ChoiceType)["type"];
};
export type Choice = Tag<"choice", [string, ChoiceObj]>;
export type Choices = Tag<"choices", Map<string, ChoiceObj>>;

export const NOOP = Vertex<Undefined, Undefined>("undefined", () => Undefined);
export function Source<T extends Tag>(resolve: () => T) {
  return Vertex("__SOURCE__", resolve);
}

// HELPERS
export function isFalse<T>(values: (T | boolean)[]): boolean {
  return values.some((v) => typeof v === "boolean" && !v);
}

export function filterBools<T>(values: (T | boolean)[]): T[] {
  return values.filter((v) => typeof v !== "boolean") as T[];
}

export function reduce(kind: BinopKind, values: [number, ...number[]]): number {
  return values.reduce((prev, curr) => binop(kind, prev, curr));
}

// RESOLVE
export type ResolveContext = {
  resolve: (node: Node, updatedCtx?: Partial<ResolveContext>) => Vertex;
  vertex: typeof Vertex;
  source: typeof Source;
  edge: (from: Vertex, to: Vertex, overwrite?: boolean) => void;
  condition: Vertex<Tag, Bool>;
  values: Vertex<Named, Values>;
  modifiers: Vertex<Modifier, Modifiers>;
  overrides: Vertex<Modifier, Modifiers>;
  choices: Vertex<Choice, Choices>;
};

type ResolverFn<T extends Node["type"]> = (
  node: Extract<Node, { type: T }>,
  ctx: ResolveContext,
) => Vertex;

export function NodeResolver<T extends Node["type"]>(
  _type: T,
  resolver: ResolverFn<T>,
) {
  return resolver;
}

type RESOLVERS = { [T in Node["type"]]: ResolverFn<T> };
const RESOLVERS: RESOLVERS = {
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
};

export function parse(tree: Node) {
  const builder = GraphBuilder();

  const values = Vertex<Named, Values>(
    "named",
    (input) => Tag("values", new Map(input)),
  );

  const modifiers = Vertex<Modifier, Modifiers>("modifier", deriveModifiers);
  const overrides = Vertex<Modifier, Modifiers>("modifier", deriveModifiers);

  const choices = Vertex<Choice, Choices>(
    "choice",
    (values) => Tag("choices", new Map(values)),
  );

  builder.addVertex(values);
  builder.addVertex(modifiers);
  builder.addVertex(overrides);
  builder.addVertex(choices);

  const condition = Source(() => Tag("boolean", true));
  builder.addVertex(condition);

  traverse(tree, {
    resolve: () => NOOP,
    vertex: (...args) => {
      const v = Vertex(...args);
      builder.addVertex(v as unknown as Vertex);
      return v;
    },
    source: (resolve) => {
      const v = Source(resolve);
      builder.addVertex(v);
      return v;
    },
    edge: (from: Vertex, to: Vertex, override?: boolean) =>
      builder.addEdge(Edge(from, to, override)),
    condition,
    values,
    modifiers,
    overrides,
    choices,
  });

  const resolved = builder.resolve();

  return {
    resolved,
    values: resolved.get(values)?.$value,
    choices: resolved.get(choices)?.$value,
  };

  function traverse(node: Node, ctx: ResolveContext): Vertex {
    const handler = RESOLVERS[node.type] as
      | ResolverFn<Node["type"]>
      | undefined;

    if (handler === undefined) return NOOP;

    return handler(node, {
      ...ctx,
      resolve: (node, updatedCtx) => traverse(node, { ...ctx, ...updatedCtx }),
    });
  }
}

function deriveModifiers(input: [string, number][][]): Modifiers {
  const res: Modifiers["$value"] = new Map();

  for (const modifier of input) {
    for (const target of modifier) {
      res.getOrInsert(target[0], []).push(target[1]);
    }
  }

  return Tag("modifiers", res);
}
