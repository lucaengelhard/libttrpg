import type * as z from "zod";
import type { Node, ZodNode } from "./schema.ts";

export type Factory<N extends Node> = {
  [Type in N as Type["$type"]]: (value: Omit<Type, "$type">) => Type;
};

export function createFactory<
  T extends ZodNode[],
>(...types: T): Factory<z.infer<T[number]>> {
  const schemaMap = new Map<string, ZodNode>(types.map((
    t,
  ) => [t.def.shape.$type.value, t]));

  const targetObj = {} as Factory<z.infer<T[number]>>;

  const proxy = new Proxy(targetObj, {
    get(_, $type) {
      return (value: Omit<T, "$type">) => {
        const result = { ...value, $type };
        const schema = schemaMap.get(($type as string).toUpperCase());
        if (schema === undefined || schema.validate(result)) {
          return { $type: "NULL" };
        }

        return result;
      };
    },
  });

  return proxy;
}
