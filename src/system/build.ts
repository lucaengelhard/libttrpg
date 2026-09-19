import type * as z from "zod";
import type { ZodNode } from "./schema.ts";

type GetStatements<N extends ZodNode> = Extract<
  N,
  { shape: { $kind: { value: "STATEMENT" } } }
>;
type GetExpressions<N extends ZodNode> = Extract<
  N,
  { shape: { $kind: { value: "EXPRESSION" } } }
>;

type NodeKind<N extends ZodNode> = N["shape"]["$kind"]["value"];
type NodeType<N extends ZodNode> = N["shape"]["$type"]["value"];

type FactoryIdentifer<N extends ZodNode, C extends ZodNode> =
  NodeKind<C> extends "STATEMENT"
    ? NodeType<C> extends NodeType<GetExpressions<N>>
      ? `${NodeType<C>}_STATEMENT`
    : NodeType<C>
    : NodeType<C> extends NodeType<GetStatements<N>>
      ? `${NodeType<C>}_EXPRESSION`
    : NodeType<C>;

type FactoryFn<T extends ZodNode> = (
  value: Omit<z.output<T>, "$kind" | "$type">,
) => z.output<T>;

export type FactoryMap<N extends ZodNode> = {
  [Type in N as FactoryIdentifer<N, Type>]: (
    value: Omit<z.output<Type>, "$kind" | "$type">,
  ) => z.output<Type>;
};

export function createFactory<
  T extends ZodNode[],
>(...types: T): FactoryMap<T[number]> {
  const entries = types.map((t) =>
    [
      t.shape.$type.value,
      (value) => ({
        ...value,
        $type: t.shape.$type.value,
        $kind: t.shape.$kind.value,
      }),
    ] as [string, FactoryFn<T[number]>]
  );

  return Object.fromEntries(entries) as FactoryMap<T[number]>;
}
