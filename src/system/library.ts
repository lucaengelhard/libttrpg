import * as z from "zod";
import {
  createSchema,
  type Infer,
  type Node,
  type Schema,
  type SchemaNode,
} from "./schema.ts";

export type Library<N extends Node> = Record<string, N>;

type LibrarySchema<S extends Schema> = z.ZodObject<{
  $schema: z.ZodOptional<z.ZodString>;
  library: z.ZodRecord<
    z.ZodString,
    SchemaNode<ReturnType<S["apply"]>>
  >;
}>;

export function createLibrarySchema<Schemata extends Schema[]>(
  ...types: Schemata
): LibrarySchema<Schemata[number]> {
  const schema = createSchema(...types);
  return z.object({
    $schema: z.string().optional(),
    library: z.record(z.string(), schema),
  });
}

export function importLibrary<Schemata extends Schema[]>(
  input: unknown,
  ...types: Schemata
): { library?: Record<string, Infer<Schemata[number]>>; error?: z.ZodError } {
  const parsed = typeof input === "string" ? JSON.parse(input) : input;
  const schema = createLibrarySchema(...types);

  // TODO: query string validation
  const { data, error } = schema.safeParse(
    parsed,
  );

  return { library: data?.library, error };
}

export function lookup<N extends Node>(
  library: Library<N>,
  query: string,
): N[] {
  const querySegments = query.split(".");

  return Object.entries(library).filter(([key]) => {
    const nameSegments = key.split(".");

    return querySegments.every((segment, index) =>
      segment === nameSegments[index]
    );
  }).map(([_, v]) => v);
}
