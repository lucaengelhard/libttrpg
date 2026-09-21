import * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import {
  type Bool,
  type Choice as ChoiceTag,
  isFalse,
  type Resolver,
  Undefined,
  VOID,
} from "../parse.ts";
import { type Infer, Schema, type SchemaNode } from "../schema.ts";

type ChoiceSchema = {
  name: z.ZodString;
  count: z.ZodNumber;
  active: z.ZodArray<z.ZodString>;
  options: z.ZodRecord<z.ZodString, SchemaNode>;
};

export type Choice = Infer<typeof Choice>;
export const Choice: Schema<"Choice", ChoiceSchema> = Schema(
  "Choice",
  (node) => ({
    name: z.string(),
    count: z.number(),
    active: z.array(z.string()),
    options: z.record(z.string(), node),
  }),
);

export const CHOICE: Resolver<Choice> = (node, ctx) => {
  const { active, count, $type: type, options, name } = node;

  const vertex = ctx.vertex<Bool, ChoiceTag | Undefined>(
    "boolean",
    (conditions) => {
      if (isFalse(conditions)) return Undefined;
      return Tag("choice", [name, {
        options: Object.keys(options),
        active,
        count,
        type,
      }]);
    },
  );

  ctx.edge(ctx.condition, vertex);
  ctx.edge(vertex, ctx.choices);

  new Set(active)
    .values()
    .map((key) => options[key])
    .filter((value) => value !== undefined)
    .take(count)
    .forEach((value) => ctx.edge(ctx.condition, ctx.resolve(value)));

  return VOID;
};
