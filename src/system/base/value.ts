import * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import {
  type Bool,
  filterBools,
  isFalse,
  type Modifiers,
  type Named,
  type Num,
  reduce,
  type Resolver,
  Undefined,
} from "../parse.ts";
import { BinopKind } from "./binop.ts";
import { type Infer, Schema, type SchemaNode } from "../schema.ts";

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

  const result = ctx.vertex<Num | Bool, Num | Named | Undefined>(
    "number",
    (values) => {
      if (isFalse(values)) return Undefined;
      const filtered = filterBools(values);
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

  const modifier = ctx.vertex<Modifiers, Num | Undefined>(
    "modifiers",
    (values) =>
      modifierReduce(
        values,
        node.name,
        node.reduceKind ?? "ADD",
      ),
  );

  const override = ctx.vertex<Modifiers, Num | Undefined>(
    "modifiers",
    (values) =>
      modifierReduce(
        values,
        node.name,
        node.overrideReduceKind ?? "MAX",
      ),
  );

  ctx.edge(value, result);
  ctx.edge(modifier, result);
  ctx.edge(override, result, true); // TODO: override handling (currently causing loop)

  ctx.edge(result, ctx.values);

  ctx.edge(ctx.modifiers, modifier);
  ctx.edge(ctx.overrides, override);

  return result;
};

function modifierReduce(
  values: Map<string, number[]>[],
  name: string | undefined,
  reduceKind: BinopKind,
): Tag {
  const modifiers = values[0];
  if (modifiers === undefined || name === undefined) return Undefined;

  const toAdd = modifiers.get(name) ?? [];

  if (toAdd.length === 0) return Undefined;

  return Tag("number", reduce(reduceKind, toAdd as [number, ...number[]]));
}
