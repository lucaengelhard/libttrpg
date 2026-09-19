import * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import { type Choice as ChoiceTag, type Resolver, VOID } from "../parse.ts";
import { Child, NodeSchema, type ZodNode } from "../schema.ts";

export type Choice = z.infer<typeof Choice>;
export const Choice: ZodNode<
  "Choice",
  {
    name: z.ZodString;
    count: z.ZodNumber;
    active: z.ZodArray<z.ZodString>;
    options: z.ZodRecord<z.ZodString, ZodNode>;
  }
> = NodeSchema(
  "Choice",
  {
    name: z.string(),
    count: z.number(),
    active: z.array(z.string()),
    options: z.record(z.string(), Child()),
  },
);

export const CHOICE: Resolver<Choice> = (node, ctx) => {
  const { active, count, $type: type, options, name } = node;

  ctx.edge(
    ctx.source<ChoiceTag>(() =>
      Tag("choice", [name, {
        options: Object.keys(options),
        active,
        count,
        type,
      }])
    ),
    ctx.choices,
  );

  new Set(active)
    .values()
    .map((key) => options[key])
    .filter((value) => value !== undefined)
    .take(count)
    .forEach((value) => ctx.resolve(value));

  return VOID;
};
