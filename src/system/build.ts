import { createSchema, type Infer, type Node, type Schema } from "./schema.ts";

export type Factory<N extends Node> = {
  [Type in N as Type["$type"]]: (value: Omit<Type, "$type">) => Type;
};

export function createFactory<
  S extends Schema[],
>(...schemata: S): Factory<Infer<S[number]>> {
  const targetObj = {} as Factory<Infer<S[number]>>;
  const parseNode = createSchema(...schemata);

  const proxy = new Proxy(targetObj, {
    get(_, $type) {
      return (value: unknown) => {
        if (
          typeof value === "object" && parseNode.validate({ ...value, $type })
        ) {
          return { ...value, $type };
        }
        return { $type: "NULL" };
      };
    },
  });

  return proxy;
}
