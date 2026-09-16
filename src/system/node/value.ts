import { Tag } from "../../lib/tag.ts";
import type { BinopKind } from "./binop.ts";
import {
  type BaseExpression,
  type Bool,
  filterBools,
  isFalse,
  type Modifiers,
  type Named,
  type NodeFactory,
  NodeResolver,
  type Num,
  reduce,
  Undefined,
} from "./index.ts";

export type Value = NodeFactory<
  "Value",
  {
    name?: string;
    value: number | BaseExpression;
    reduceKind?: BinopKind;
    overrideReduceKind?: BinopKind;
  }
>;

export const VALUE = NodeResolver("VALUE", (node, ctx) => {
  const value = typeof node.value === "number"
    ? ctx.source(() => {
      return Tag("number", node.value as number);
    })
    : ctx.resolve(node.value);

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
      modifierReduce(values, node.name, node.overrideReduceKind ?? "ADD"),
  );

  const override = ctx.vertex<Modifiers, Num | Undefined>(
    "modifiers",
    (values) =>
      modifierReduce(values, node.name, node.overrideReduceKind ?? "MAX"),
  );

  ctx.edge(value, result);
  ctx.edge(modifier, result);
  ctx.edge(override, result, true);

  ctx.edge(result, ctx.values);

  ctx.edge(ctx.modifiers, modifier);
  ctx.edge(ctx.overrides, override);

  return result;
});

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
