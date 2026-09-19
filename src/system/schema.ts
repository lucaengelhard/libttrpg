import * as z from "zod";

const NodeSchema = z.looseObject({
  $kind: z.union([z.literal("STATEMENT"), z.literal("EXPRESSION")]),
  $type: z.string().uppercase(),
}).and(z.record(z.string(), z.any()));

export function isNode(input: unknown): input is z.infer<typeof NodeSchema> {
  return NodeSchema.validate(input);
}

export type ZodNode<
  K extends "Statement" | "Expression" = "Statement" | "Expression",
  T extends string = string,
  // deno-lint-ignore ban-types
  V extends Record<string, z.ZodType> = {},
> = z.ZodObject<
  V & {
    $kind: z.ZodLiteral<Uppercase<K>>;
    $type: z.ZodLiteral<Uppercase<T>>;
  }
>;

export type Node<
  K extends "Statement" | "Expression" = "Statement" | "Expression",
  T extends string = string,
  // deno-lint-ignore ban-types
  V extends Record<string, z.ZodType> = {},
> = z.infer<ZodNode<K, T, V>>;

export function createNode<
  K extends "Statement" | "Expression",
  T extends string,
  V extends Record<string, z.ZodType>,
>(
  $kind: K,
  $type: T,
  value: V,
): ZodNode<K, T, V> {
  return z.object({
    ...z.object(value).shape,
    $kind: z.literal($kind.toUpperCase() as Uppercase<K>),
    $type: z.literal($type.toUpperCase() as Uppercase<T>),
  });
}

type ZodPlaceHolder<K extends "Statement" | "Expression", T extends string> =
  z.ZodObject<{
    $kind: z.ZodLiteral<Uppercase<K>>;
    $type: z.ZodUnion<z.ZodLiteral<Uppercase<T>>[]>;
  }, z.core.$loose>;
function Placeholder<
  K extends "Statement" | "Expression",
  T extends string,
>(kind: K, types: T[]) {
  return z.looseObject({
    $kind: z.literal(kind.toUpperCase() as Uppercase<K>),
    $type: z.union(
      types.map((t) => z.literal(t.toUpperCase() as Uppercase<T>)),
    ),
  });
}

export function Statement<T extends string>(
  ...types: T[]
): ZodPlaceHolder<"Statement", T> {
  return Placeholder("Statement", types);
}

export function Expression<T extends string>(
  ...types: T[]
): ZodPlaceHolder<"Expression", T> {
  return Placeholder("Expression", types);
}

export function createRegistry(...types: ZodNode[]) {
  const registry = z.registry<{ id: string; kind: string }>();

  const STATEMENT_NAMES: string[] = [];
  const EXPRESSION_NAMES: string[] = [];

  for (const value of types) {
    const kind = value.shape.$kind.value;
    const type = value.shape.$type.value;

    registry.add(value, { id: type, kind });

    if (kind === "STATEMENT") {
      STATEMENT_NAMES.push(type);
    } else {
      EXPRESSION_NAMES.push(type);
    }
  }

  return { registry, STATEMENT_NAMES, EXPRESSION_NAMES };
}

export function toJSONSchema<
  T extends ZodNode[],
>(...types: T) {
  const { registry, STATEMENT_NAMES, EXPRESSION_NAMES } = createRegistry(
    ...types,
  );

  return z.toJSONSchema(registry, {
    override: (ctx) => {
      const { jsonSchema } = ctx;

      if (
        jsonSchema.type === "object" &&
        jsonSchema.properties !== undefined &&
        jsonSchema.properties.$kind !== undefined &&
        typeof jsonSchema.properties.$kind === "object" &&
        jsonSchema.properties.$kind.type === "string" &&
        typeof jsonSchema.properties.$kind.const === "string" &&
        jsonSchema.properties.$type !== undefined &&
        typeof jsonSchema.properties.$type === "object" &&
        jsonSchema.properties.$type.anyOf !== undefined
      ) {
        const { $kind: { const: kind }, $type: { anyOf } } =
          jsonSchema.properties;

        const names = kind === "STATEMENT" ? STATEMENT_NAMES : EXPRESSION_NAMES;

        if (anyOf.length > 0) {
          jsonSchema.properties.$type.anyOf = anyOf.map(
            (v) => {
              if (names.includes(v.const as string)) {
                return { $ref: v.const as string };
              }

              return v;
            },
          );
        } else {
          jsonSchema.properties.$type.anyOf = names
            .map((n) => ({ $ref: n }));
        }
      }
    },
  });
}
