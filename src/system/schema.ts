import * as z from "zod";

export type Node<
  T extends string = string,
  // deno-lint-ignore ban-types
  V extends Record<string, z.ZodType> = {},
> = z.infer<ZodNode<T, V>>;

export type ZodNode<
  T extends string = string,
  // deno-lint-ignore ban-types
  V extends Record<string, z.ZodType> = {},
> = z.ZodObject<
  V & { $type: z.ZodLiteral<Uppercase<T>> }
>;

export function NodeSchema<
  T extends string,
  V extends Record<string, z.ZodType>,
>(
  $type: T,
  value: V,
): ZodNode<T, V> {
  return z.looseObject({
    ...z.looseObject(value).shape,
    $type: z.literal($type.toUpperCase() as Uppercase<T>),
  });
}

export function Child<T extends string>(...types: T[]): ZodNode<T> {
  return z.object({
    $type: z.union(
      types.map((t) => z.literal(t.toUpperCase() as Uppercase<T>)),
    ),
  }) as unknown as ZodNode<T>;
}

export function isNode(
  input: unknown,
  nodes?: ZodNode[],
): input is Node {
  if (nodes === undefined) {
    return z.looseObject({
      $type: z.string().uppercase(),
    }).validate(input);
  }

  return nodes.some((node) => node.validate(input));
}

export function createRegistry(
  ...types: ZodNode[]
): { registry: z.core.$ZodRegistry<{ id: string }>; names: string[] } {
  const registry = z.registry<{ id: string }>();
  const names: string[] = [];

  for (const value of types) {
    const type = value.shape.$type.value;
    registry.add(value, { id: type });
    names.push(type);
  }

  return { registry, names };
}

export function toJSONSchema<
  T extends ZodNode[],
>(...types: T): {
  schemas: Record<string, z.core.ZodStandardJSONSchemaPayload<z.core.$ZodType>>;
} {
  const { registry, names } = createRegistry(...types);

  return z.toJSONSchema(registry, {
    override: (ctx) => {
      const { jsonSchema } = ctx;

      if (
        jsonSchema.type === "object" &&
        jsonSchema.properties !== undefined &&
        jsonSchema.properties.$type !== undefined &&
        typeof jsonSchema.properties.$type === "object" &&
        jsonSchema.properties.$type.anyOf !== undefined
      ) {
        const anyOf = jsonSchema.properties.$type.anyOf;

        if (anyOf.length > 0) {
          jsonSchema.properties.$type.anyOf = anyOf.map((t) => ({
            $ref: t.const as string,
          }));
        } else {
          jsonSchema.properties.$type.anyOf = names.map((n) => ({ $ref: n }));
        }
      }
    },
  });
}
