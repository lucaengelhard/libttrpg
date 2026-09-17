import { Tag } from "../../lib/tag.ts";
import { type Choice as ChoiceTag, NOOP, type Resolver } from "../parse.ts";
import type { Statement } from "../node.ts";

export type Choice = Statement<
  "Choice",
  {
    name: string;
    count: number;
    active: string[];
    options: Record<string, Statement>;
  }
>;

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
