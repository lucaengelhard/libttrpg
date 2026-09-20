import type { Node } from "./schema.ts";

export type Factory<N extends Node> = {
  [Type in N as Type["$type"]]: (value: Omit<Type, "$type">) => Type;
};

export function createFactory<N extends Node>(): Factory<N> {
  const targetObj = {} as Factory<N>;

  const proxy = new Proxy(targetObj, {
    get(_, $type) {
      return (value: unknown) => {
        if (typeof value !== "object") {
          return { $type: "NULL" };
        }

        return { ...value, $type };
      };
    },
  });

  return proxy;
}
