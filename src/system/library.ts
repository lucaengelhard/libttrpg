import * as z from "zod";
import { createSchema, type Infer, type Node, type Schema } from "./schema.ts";

export type Library<N extends Node> = Record<string, N>;
export function importLibrary<Schemata extends Schema[]>(
  input: unknown,
  ...types: Schemata
): { library?: Record<string, Infer<Schemata[number]>>; error?: z.ZodError } {
  const parsed = typeof input === "string" ? JSON.parse(input) : input;

  const schema = createSchema(...types);

  // TODO: query string validation
  const { data: library, error } = z.record(z.string(), schema).safeParse(
    parsed,
  );

  return { library, error };
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
