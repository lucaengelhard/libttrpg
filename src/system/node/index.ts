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
import {
  MODIFIER,
  type Modifier as ModifierType,
  OVERRIDE,
  type Override,
} from "./modifier.ts";
import { MULTIPLE, type Multiple } from "./multiple.ts";
import { QUERY, type Query } from "./query.ts";
import { REDUCE, type Reduce } from "./reduce.ts";
import { UNARYOPERATION, type UnaryOperation } from "./unaryop.ts";
import { VALUE, type ValueExpression, type ValueStatement } from "./value.ts";
import { LITERAL, type Literal } from "./literal.ts";

const ExpressionSymbol = Symbol("Expression");
export type Expression<
  Type extends string = string,
  Value extends Record<string, unknown> = Record<string, unknown>,
> = {
  $kind: typeof ExpressionSymbol;
  $type: Uppercase<Type>;
} & Omit<Value, "$kind" | "$type">;

const StatementSymbol = Symbol("Statement");
export type Statement<
  Type extends string = string,
  Value extends Record<string, unknown> = Record<string, unknown>,
> = {
  $kind: typeof StatementSymbol;
  $type: Uppercase<Type>;
} & Omit<Value, "$kind" | "$type">;

export type Node = Statement | Expression;

type BaseExpression =
  | ValueExpression
  | Literal
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

export type NodeMap<N extends Node> = {
  [K in N["$type"]]: Extract<N, { $type: K }>;
};

export type BASE_NODES = NodeMap<BaseNode>;

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

export type Resolver<N extends Node> = (
  node: N,
  ctx: ResolveContext,
) => Vertex;

type ResolverMap<N extends Node> = {
  [T in N["$type"]]: Resolver<Extract<BaseNode, { $type: T }>>;
};
export const ResolverMap: ResolverMap<BaseNode> = {
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
  LITERAL,
};

export type GetStatements<N extends Node> = Extract<
  N,
  { $kind: typeof StatementSymbol }
>;
export type GetExpressions<N extends Node> = Extract<
  N,
  { $kind: typeof ExpressionSymbol }
>;

export type Tree<
  Nodes extends Statement | Expression,
  Current,
> = Current extends Nodes ? {
    [K in keyof Omit<Current, "$kind">]: Current[K] extends Node
      ? Current[K]["$type"] extends Nodes["$type"] ? Tree<Nodes, Current[K]>
      : Current[K] extends Statement ? Tree<Nodes, GetStatements<Nodes>>
      : Tree<Nodes, GetExpressions<Nodes>>
      : Tree<Nodes, Current[K]>;
  }
  : Current extends Array<infer Value> ? Array<
      Value extends Node
        ? Value["$type"] extends Nodes["$type"] ? Tree<Nodes, Value>
        : Value extends Statement ? Tree<Nodes, GetStatements<Nodes>>
        : Tree<Nodes, GetExpressions<Nodes>>
        : Tree<Nodes, Value>
    >
  : Current extends Record<string, infer Value> ? Record<
      string,
      Value extends Node
        ? Value["$type"] extends Nodes["$type"] ? Tree<Nodes, Value>
        : Value extends Statement ? Tree<Nodes, GetStatements<Nodes>>
        : Tree<Nodes, GetExpressions<Nodes>>
        : Tree<Nodes, Value>
    >
  : Current;

export function parse<N extends Node>(
  tree: Tree<N, N>,
  resolvers: ResolverMap<N>,
) {
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

  function traverse(node: Tree<N, N>, ctx: ResolveContext): Vertex {
    const handler =
      resolvers[node.$type as keyof typeof resolvers] as unknown as
        | Resolver<N>
        | undefined;

    if (handler === undefined) return NOOP;

    return handler(node as N, {
      ...ctx,
      resolve: (node, updatedCtx) =>
        traverse(node as Tree<N, N>, { ...ctx, ...updatedCtx }),
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

export function isNode(input: unknown): input is Node {
  return input !== null &&
    input !== undefined &&
    typeof input === "object" &&
    "$type" in input &&
    typeof input.$type === "string";
}
