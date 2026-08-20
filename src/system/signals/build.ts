import { NodeMap } from "../../lib/map.ts";
import type { Library } from "../library.ts";
import type { Node } from "../tree/types.ts";
import { applyParams } from "./applyParams.ts";

type BuildContext = {
  library: Library;
  scope: NodeMap;
  within?: Node["within"];
};
export function build<N extends Node>(node: N, ctxInput: BuildContext): N {
  const ctx: BuildContext = {
    ...ctxInput,
    scope: createScope(node, ctxInput),
  };

  const staticResult = node.static ? buildRecord(node.static, ctx) : undefined;

  switch (node.type) {
    case "LOOKUP": {
      return {
        ...node,
        static: staticResult,
        result: lookup(node.query, ctx),
      };
    }

    case "MULTIPLE": {
      return {
        ...node,
        static: staticResult,
        values: node.values.map((v) => build(v, ctx)),
      };
    }

    case "CHOOSE": {
      return { ...node, static: staticResult, from: build(node.from, ctx) };
    }

    case "OPTIONAL": {
      return { ...node, static: staticResult, value: build(node.value, ctx) };
    }

    case "CLASS":
    case "SUBCLASS": {
      const levels = node.levels ? buildRecord(node.levels, ctx) : undefined;
      return {
        ...node,
        static: staticResult,
        levels,
        within: {
          ...node.within,
          class: node.type === "CLASS" ? node.name : undefined,
          subclass: node.type === "SUBCLASS" ? node.name : undefined,
        },
      };
    }

    case "FEAT": {
      const levels = node.levels ? buildRecord(node.levels, ctx) : undefined;
      const gives = node.gives ? build(node.gives, ctx) : undefined;
      return {
        ...node,
        static: staticResult,
        levels,
        gives,
        within: { ...node.within, feat: node.name },
      };
    }

    case "PROFICIENCY": {
      return { ...node, static: staticResult };
    }

    case "IMPORT":
    case "EMPTY":
    case "MODIFIER":
    case "ROLL":
    case "RESOURCE":
    case "SPELL":
    case "SPELLCASTING":
    case "ABILITY":
    case "SKILL":
    case "ACTION":
    case "TYPE": {
      return node;
    }
  }
}

function createScope(
  node: Node,
  ctx: BuildContext,
): NodeMap {
  if (!("static" in node) || node.static === undefined) return ctx.scope;

  const scope = new NodeMap(ctx.scope);

  for (const [key, value] of Object.entries(node.static!)) {
    scope.set(key, value);
  }
  return scope;
}

function buildRecord(
  record: Record<string, Node>,
  ctx: BuildContext,
): Record<string, Node> {
  return Object.fromEntries(
    Object.entries(record).map((
      [key, value],
    ) => [key, build(value, ctx)]),
  );
}

function lookup(query: string, ctx: BuildContext): Node | undefined {
  const [accessor, params] = query.toLowerCase().split("?");
  const [section, category, selector] = accessor.split(".");

  const map = section === "static"
    ? ctx.scope
    : section === "library"
    ? ctx.library.get(category)
    : undefined;

  if (!map) return;
  if (selector) {
    return map.get(selector);
  }

  const values = map.values()
    .filter((v) => applyParams(v, params))
    .toArray();

  return { type: "MULTIPLE", values: values };
}
