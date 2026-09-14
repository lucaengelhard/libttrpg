import { Tag } from "../../lib/tag.ts";
import type { Node, NodeFactory } from "./index.ts";
import { type Choice as ChoiceTag, NodeResolver, NOOP } from "./index.ts";

export type Choice = NodeFactory<
  "Choice",
  {
    name: string;
    count: number;
    active: string[];
    options: Record<string, Node>;
  }
>;

export const CHOICE = NodeResolver("CHOICE", (node, ctx) => {
  ctx.edge(
    ctx.source<ChoiceTag>(() =>
      Tag("choice", [node.name, {
        options: Object.keys(node.options),
        active: node.active,
        count: node.count,
        type: node.type,
      }])
    ),
    ctx.choices,
  );

  new Set(node.active)
    .values()
    .map((key) => node.options[key])
    .filter((value) => value !== undefined)
    .take(node.count)
    .forEach((value) => ctx.resolve(value));

  return NOOP;
});
