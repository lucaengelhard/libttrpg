import type { ExhaustiveTuple } from "../lib/utils.ts";

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

export type Filter<N extends Node, T extends N["$type"]> = Extract<
  N,
  { $type: T }
>;

export type NodeMap<N extends Node> = {
  [K in N["$type"]]: Extract<N, { $type: K }>;
};

export function isNode(input: unknown): input is Node {
  return input !== null &&
    input !== undefined &&
    typeof input === "object" &&
    "$type" in input &&
    typeof input.$type === "string";
}

export type Creators<N extends Node> =
  & {
    [
      T in Extract<N, { $kind: typeof StatementSymbol }> as T["$type"] extends
        Extract<N, { $kind: typeof ExpressionSymbol }>["$type"]
        ? `${T["$type"]}_STATEMENT`
        : T["$type"]
    ]: CreatorFn<T>;
  }
  & {
    [
      T in Extract<N, { $kind: typeof ExpressionSymbol }> as T["$type"] extends
        Extract<N, { $kind: typeof StatementSymbol }>["$type"]
        ? `${T["$type"]}_EXPRESSION`
        : T["$type"]
    ]: CreatorFn<T>;
  };

type CreatorFn<T extends Node> = (value: Omit<T, "$type" | "$kind">) => T;

type NodeFactory<N extends Node> = () => GetStatementNames<N>;

type GetStatementNames<N extends Node> = <
  S extends [
    Extract<N, { $kind: typeof StatementSymbol }>["$type"],
    ...Extract<N, { $kind: typeof StatementSymbol }>["$type"][],
  ],
>(
  names: ExhaustiveTuple<
    Extract<N, { $kind: typeof StatementSymbol }>["$type"],
    S
  >,
) => GetExpressionNames<N>;

type GetExpressionNames<N extends Node> = <
  E extends [
    Extract<N, { $kind: typeof ExpressionSymbol }>["$type"],
    ...Extract<N, { $kind: typeof ExpressionSymbol }>["$type"][],
  ],
>(
  names: ExhaustiveTuple<
    Extract<N, { $kind: typeof ExpressionSymbol }>["$type"],
    E
  >,
) => Creators<N>;

export function NodeFactory<N extends Node>(): GetStatementNames<N> {
  return (statmentNames) => {
    return (expressioNames) => {
      const res: Record<string, unknown> = {};
      for (const type of statmentNames) {
        const CreatorFn: CreatorFn<N> = (value) =>
          ({
            $kind: StatementSymbol,
            $type: type,
            ...value,
          }) as N;

        const functionName = expressioNames.includes(type)
          ? `${type}_STATEMENT`
          : type;

        res[functionName] = CreatorFn;
      }

      for (const type of expressioNames) {
        const CreatorFn: CreatorFn<N> = (value) =>
          ({
            $kind: ExpressionSymbol,
            $type: type,
            ...value,
          }) as N;

        const functionName = statmentNames.includes(type)
          ? `${type}_EXPRESSION`
          : type;

        res[functionName] = CreatorFn;
      }

      return res as Creators<N>;
    };
  };
}

// TODO Node clone function
