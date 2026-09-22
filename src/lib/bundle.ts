import * as z from "zod";
import { walk } from "@std/fs/walk";
import { dirname } from "@std/path/dirname";
import { resolve } from "@std/path/resolve";
import { Schema } from "../system/schema.ts";

export const Ref = Schema("REF", () => ({ path: z.string(), key: z.string() }));

const File = z.object({
  $schema: z.string().optional(),
  defs: z.array(z.json()),
});

type Def = z.infer<typeof Def>;
const Def = z.json().and(z.looseObject({
  name: z.string(),
}));

export async function bundleJSON(
  entrypath: string,
): Promise<z.JSONType | undefined> {
  const rootDir = dirname(resolve(Deno.cwd(), entrypath));

  const files = new Map<string, Map<string, Def>>();

  for await (const entry of walk(rootDir, { exts: [".json"] })) {
    const content = await import(entry.path, { with: { type: "json" } });

    const { data, error } = File.safeParse(content.default);
    if (error || data === undefined) continue;

    const fileResult = new Map<string, Def>();
    for (const definition of data.defs) {
      if (!Def.validate(definition)) continue;

      fileResult.set(definition.name, definition);
    }

    files.set(entry.path, fileResult);
  }

  const resolved = Object.fromEntries(
    files.entries()
      .flatMap(([path, v]) =>
        v.entries()
          .map(([key, value]) => {
            const k = "$type" in value
              ? `${(value.$type as string).toLowerCase()}.${key}`
              : key;
            return [k, replaceRefs(value, path, files)];
          })
      ),
  );

  return resolved;
}

function replaceRefs(
  current: z.JSONType,
  rootPath: string,
  defs: Map<string, Map<string, Def>>,
): z.JSONType {
  if (Ref.apply().validate(current)) {
    const value = defs.get(resolve(dirname(rootPath), current.path))?.get(
      current.key,
    );

    if (value === undefined) {
      return current;
    }

    return value;
  }

  switch (typeof current) {
    case "string":
    case "number":
    case "boolean":
      return current;
  }

  if (Array.isArray(current)) {
    return current.map((v) => replaceRefs(v, rootPath, defs));
  }

  if (typeof current !== "object" || current === null) {
    return current;
  }

  const entries = Object.entries(current).map(
    ([key, value]) => [key, replaceRefs(value, rootPath, defs)],
  );

  return Object.fromEntries(entries);
}
