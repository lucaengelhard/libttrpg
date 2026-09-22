import * as z from "@zod/zod";
import { createSchema, type Infer, type Node, Schema } from "./schema.ts";
import { Ref } from "../lib/bundle.ts";

type LibraryNode<N extends Node> = Extract<N, { name?: string }> & {
  name: string;
};
export type Library<N extends Node> = Record<string, LibraryNode<N>>;

type Entry = Infer<typeof Entry>;
const Entry = Schema(
  "Entry",
  (node) => ({ name: z.string(), value: node }),
);

function getLibraryTopLevel(types: Schema[]) {
  const topLevelSchemata = [...types, Entry];
  const nodeSchema = createSchema(...types, Ref);

  const withName = z.discriminatedUnion(
    "$type",
    topLevelSchemata
      .map((t) => t.apply(nodeSchema))
      .filter((t) => "name" in t.def.shape) as [ReturnType<Schema["apply"]>],
  ).catch({ $type: "NULL" });

  return withName;
}

export function createLibrarySchema(
  types: Schema[],
) {
  return z.object({
    $schema: z.string().optional(),
    defs: z.array(getLibraryTopLevel(types)),
  });
}

export function importLibrary<Schemata extends Schema[]>(
  file: unknown,
  ...types: Schemata
): {
  library?: Library<Infer<Schemata[number]>>;
  error?: z.ZodError;
} {
  const withName = getLibraryTopLevel(types);

  const schema = z.record(z.string(), withName).and(z.object({
    $schema: z.string().optional(),
  }));

  const { error, data } = schema.safeParse(file);

  const cleaned = data
    ? Object.fromEntries(
      Object.entries(data).map(([key, value]) => {
        if (
          typeof value === "object" && value.$type === "ENTRY" &&
          "name" in value && "value" in value
        ) {
          return [value.name, value.value];
        }

        return [key, value];
      }),
    )
    : undefined;

  return { library: cleaned as Library<Infer<Schemata[number]>>, error };
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
