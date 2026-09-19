import { Tag } from "../lib/tag.ts";
import type { Selector } from "./base/selector.ts";
import type { Choice as ChoiceType } from "./base/choice.ts";
import { Edge, GraphBuilder, Vertex } from "../lib/graph.ts";
import { binop, type BinopKind } from "./base/binop.ts";

import { type NestedMap, nestedMap } from "../lib/utils.ts";
import type { Node } from "./schema.ts";

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
  type: (Selector | ChoiceType)["$type"];
};
export type Choice = Tag<"choice", [string, ChoiceObj]>;
export type Choices = Tag<"choices", Map<string, ChoiceObj>>;

export const VOID = Vertex<Undefined, Undefined>("undefined", () => Undefined);
export function Source<T extends Tag>(resolve: () => T): Vertex<Tag, T> {
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

export function getNumber(value: (Num | Named)["$value"]): number {
  if (Array.isArray(value)) return value[1];
  return value;
}

// RESOLVE
export type ResolveContext = {
  resolve: (
    node: Node,
    updatedCtx?: Partial<ResolveContext>,
  ) => Vertex;
  vertex: typeof Vertex;
  source: typeof Source;
  edge: (from: Vertex, to: Vertex, overwrite?: boolean) => void;
  condition: Vertex<Tag, Bool>;
  values: Vertex<Named, Values>;
  modifiers: Vertex<Modifier, Modifiers>;
  overrides: Vertex<Modifier, Modifiers>;
  choices: Vertex<Choice, Choices>;
};

export type Resolver<N extends Node> = (
  node: N,
  ctx: ResolveContext,
) => Vertex;

export type ResolverMap<N extends Node> = {
  [T in N as T["$type"]]: Resolver<T>;
};

type ParseResult = {
  resolved: Map<Vertex<Tag, Tag>, Tag>;
  values: NestedMap<number>;
  choices: Map<string, ChoiceObj>;
};

export function parse<N extends Node>(
  tree: N,
  resolvers: ResolverMap<N>,
): ParseResult {
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
    resolve: () => VOID,
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
    values: nestedMap(resolved.get(values)?.$value as Map<string, number>),
    choices: resolved.get(choices)?.$value as Map<string, ChoiceObj>,
  };

  function traverse(node: N, ctx: ResolveContext): Vertex {
    const handler = resolvers[node.$type as keyof typeof resolvers] as
      | Resolver<N>
      | undefined;

    if (handler === undefined) return VOID;

    return handler(node, {
      ...ctx,
      resolve: (node, updatedCtx) =>
        traverse(node as N, { ...ctx, ...updatedCtx }),
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
