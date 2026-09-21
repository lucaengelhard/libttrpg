import * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import {
  type Bool,
  filterBools,
  isFalse,
  type Modifiers,
  type ModifierValue,
  type Named,
  type Num,
  reduce,
  type Resolver,
  type Tagged,
  Undefined,
} from "../parse.ts";
import { BinopKind } from "./binop.ts";
import { type Infer, Schema, type SchemaNode } from "../schema.ts";
import type { Modifier, Override } from "./modifier.ts";

type ValueSchema = {
  name: z.ZodOptional<z.ZodString>;
  value: SchemaNode;
  reduceKind: z.ZodOptional<typeof BinopKind>;
  overrideReduceKind: z.ZodOptional<typeof BinopKind>;
};

export type Value = Infer<typeof Value>;
export const Value: Schema<"Value", ValueSchema> = Schema("Value", (node) => ({
  name: z.string().optional(),
  value: node,
  reduceKind: BinopKind.optional(),
  overrideReduceKind: BinopKind.optional(),
}));

export const VALUE: Resolver<Value> = (
  node,
  ctx,
) => {
  const value = ctx.resolve(node.value);

  const result = ctx.vertex<
    Num | Bool | Tagged<(Modifier | Override)["$type"]>,
    Num | Named | Undefined
  >(
    ["number", "tagged", "boolean"],
    (values) => {
      if (isFalse(values)) return Undefined;

      const override = values.find((v) =>
        typeof v === "object" && v.$tag === "OVERRIDE"
      ) as Tag<string, number> | undefined;

      if (override) {
        return node.name !== undefined
          ? Tag("named", [node.name, override.$value] as [string, number])
          : Tag("number", override.$value);
      }

      const modifier = values.find((v) =>
        typeof v === "object" && v.$tag === "MODIFIER"
      ) as Tag<string, number> | undefined;

      const filtered = filterBools(values).filter((v) => typeof v !== "object");

      if (modifier) {
        filtered.push(modifier.$value);
      }

      if (filtered.length === 0) return Undefined;
      const reduced = reduce(
        node.reduceKind ?? "ADD",
        filtered as [number, ...number[]],
      );

      return node.name !== undefined
        ? Tag("named", [node.name, reduced] as [string, number])
        : Tag("number", reduced);
    },
  );

  const modifier = ctx.vertex<Modifiers, Tagged | Undefined>(
    "modifiers",
    (values) =>
      modifierReduce(
        values,
        node.name,
        node.reduceKind,
        node.overrideReduceKind,
      ),
  );

  ctx.edge(value, result);
  ctx.edge(modifier, result);

  ctx.edge(result, ctx.values);

  ctx.edge(ctx.modifiers, modifier);

  return result;
};

function modifierReduce(
  values: Map<string, ModifierValue[]>[],
  name: string | undefined,
  reduceKind: BinopKind = "ADD",
  overrideReduceKind: BinopKind = "MAX",
): Tagged<(Modifier | Override)["$type"]> | Undefined {
  const modifiers = values[0];
  if (modifiers === undefined || name === undefined) return Undefined;

  const toAdd = modifiers.get(name) ?? [];

  if (toAdd.length === 0) return Undefined;

  const overrides = toAdd
    .filter((m) => m.kind === "OVERRIDE").map((o) => o.value);

  if (overrides.length > 0) {
    return Tag(
      "tagged",
      Tag(
        "OVERRIDE",
        reduce(overrideReduceKind, overrides as [number, ...number[]]),
      ),
    );
  }

  const mods = toAdd
    .filter((m) => m.kind === "MODIFIER").map((o) => o.value);

  return Tag(
    "tagged",
    Tag("MODIFIER", reduce(reduceKind, mods as [number, ...number[]])),
  );
}
