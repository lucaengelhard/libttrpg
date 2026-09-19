import * as z from "zod";
import { Tag } from "../../lib/tag.ts";
import { type Choice as ChoiceTag, NOOP, type Resolver } from "../parse.ts";
import { createNode, Statement } from "../schema.ts";

export type Choice = z.infer<typeof Choice>;
export const Choice = createNode("Statement", "Choice", {
  name: z.string(),
  count: z.number(),
  active: z.array(z.string()),
  options: z.record(z.string(), Statement()),
});

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

  return NOOP;
};
