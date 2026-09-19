import type * as z from "zod";
import type { Node, ZodNode } from "./schema.ts";

type GetStatements<N extends Node> = Extract<
  N,
  { $kind: "STATEMENT" }
>;
type GetExpressions<N extends Node> = Extract<
  N,
  { $kind: "EXPRESSION" }
>;

type FactoryIdentifer<N extends Node, C extends Node> = C["$kind"] extends
  "STATEMENT"
  ? C["$type"] extends GetExpressions<N>["$type"] ? `${C["$type"]}_STATEMENT`
  : C["$type"]
  : C["$type"] extends GetStatements<N>["$type"] ? `${C["$type"]}_EXPRESSION`
  : C["$type"];

type FactoryFn<T extends Node> = (
  value: Omit<z.infer<T>, "$kind" | "$type">,
) => z.infer<T>;

export type Factory<N extends Node> = {
  [Type in N as FactoryIdentifer<N, Type>]: (
    value: Omit<Type, "$kind" | "$type">,
  ) => Type;
};

export function createFactory<
  T extends ZodNode[],
>(...types: T): Factory<z.infer<T[number]>> {
  const entries = types.map((t) =>
    [
      t.shape.$type.value,
      (value) => ({
        ...value,
        $type: t.shape.$type.value,
        $kind: t.shape.$kind.value,
      }),
    ] as [string, FactoryFn<z.infer<T[number]>>]
  );

  return Object.fromEntries(entries) as unknown as Factory<
    z.infer<T[number]>
  >;
}
