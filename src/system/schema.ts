import * as z from "@zod/zod";

export type Node<
  T extends string = string,
  // deno-lint-ignore ban-types
  V extends Record<string, z.ZodType> = {},
> = Infer<Schema<T, V>>;

export type ZodNode<
  T extends string = string,
  // deno-lint-ignore ban-types
  V extends Record<string, z.ZodType> = {},
> = z.ZodObject<
  V & {
    $type: z.ZodLiteral<Uppercase<T>>;
    $meta: z.ZodOptional<z.ZodJSONSchema>;
  }
>;

export type SchemaNode<N extends ZodNode = ZodNode> = z.ZodLazy<
  z.ZodDiscriminatedUnion<N[], "$type">
>;

export type Schema<
  T extends string = string,
  // deno-lint-ignore ban-types
  V extends Record<string, z.ZodType> = {},
> = ReturnType<typeof Schema<T, V>>;
export function Schema<
  T extends string,
  V extends Record<string, z.ZodType>,
>(
  type: T,
  factory: (node: SchemaNode) => V,
) {
  return {
    type: type.toUpperCase() as Uppercase<T>,
    apply: (node?: SchemaNode) =>
      z.looseObject({
        ...(node ? factory(node) : {} as V),
        $type: z.literal(type.toUpperCase() as Uppercase<T>),
        $meta: z.json().optional(),
      }),
  };
}

export type Infer<S extends Schema> = z.infer<ReturnType<S["apply"]>>;

export function isNode(
  input: unknown,
  schema?: SchemaNode,
): input is Node {
  if (schema === undefined) {
    return z.looseObject({
      $type: z.string().uppercase(),
    }).validate(input);
  }

  return schema.validate(input);
}

export function createSchema<Schemata extends Schema[]>(
  ...schemata: Schemata
) {
  const Node: SchemaNode<ReturnType<Schemata[number]["apply"]>> = z.lazy(() =>
    z.discriminatedUnion(
      "$type",
      schemata.map((s) => s.apply(Node)) as unknown as [
        ReturnType<Schemata[number]["apply"]>,
        ...ReturnType<Schemata[number]["apply"]>[],
      ],
      // deno-lint-ignore no-explicit-any
    ).catch({ $type: "NULL" } as any) as any
  );
  return Node;
}

export type SchemaMap<S extends Schema> = {
  [V in S as V["type"]]: V["apply"];
};
export function SchemaMap<S extends Schema[]>(
  ...schemata: S
) {
  return Object.fromEntries(
    schemata.map((s) => [s.type, s.apply]),
  ) as SchemaMap<S[number]>;
}
