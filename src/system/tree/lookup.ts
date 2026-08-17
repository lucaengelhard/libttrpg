import { NodeMap } from "../../lib/map.ts";
import { caseInsensitiveGet, is } from "../../lib/utils.ts";
import { ParseCtx } from "./parse.ts";
import {
  Multiple,
  Node,
  NODE_TYPES,
  NodeType,
  NodeWithKey,
  NodeWithName,
  Store,
} from "./types.ts";

export function lookup(
  store: Store,
  query: string,
  ctx: ParseCtx,
): Node | undefined {
  const category = getCategory(store, query, ctx);
  if (!category) return;

  const [_, params] = getQueryParts(query);
  const [sectionKey, categoryKey, entryKey] = getSelectorComponents(query);

  if (sectionKey === "static") {
    const staticEntry = category.get(categoryKey);
    if (staticEntry === undefined) return;

    if (is(staticEntry, "MULTIPLE")) {
      return { ...staticEntry, values: staticEntry.values.filter(applyParams) };
    }

    const untypedStaticEntry = staticEntry as Record<string, unknown>;
    if (
      untypedStaticEntry === null ||
      typeof untypedStaticEntry !== "object" ||
      !(entryKey in untypedStaticEntry) ||
      untypedStaticEntry[entryKey] === undefined ||
      untypedStaticEntry[entryKey] === null ||
      typeof untypedStaticEntry[entryKey] !== "object" ||
      !("type" in untypedStaticEntry[entryKey]) ||
      typeof untypedStaticEntry[entryKey].type !== "string" ||
      !NODE_TYPES.includes(untypedStaticEntry[entryKey].type as NodeType)
    ) return;

    return untypedStaticEntry[entryKey] as Node;
  }

  if (entryKey) {
    const entry = category.get(entryKey);
    if (entry && applyParams(entry)) {
      return entry;
    }
  } else {
    const res: Multiple = {
      type: "MULTIPLE",
      values: category.values().filter(applyParams)
        .toArray() as (NodeWithKey | NodeWithName)[],
    };

    return res;
  }

  function applyParams(node: Node): boolean {
    if (!params) return true;
    const paramsSegments = params.split(";");

    for (const segment of paramsSegments) {
      const [category, options] = segment.split("=");
      const values = options.split("|").map((s) => s.toLowerCase());

      const nodeValue = caseInsensitiveGet(node, category)?.toString();

      if (!nodeValue || !values.includes(nodeValue.toLowerCase())) return false;
    }
    return true;
  }
}

function cleanupQuery(query: string) {
  return query.toLowerCase();
}

function getCategory(store: Store, query: string, ctx: ParseCtx) {
  const [section, category] = getSelectorComponents(query);
  if (section === "static") {
    return store.getOrThrow("character")
      .getOrThrow("classes")
      .getNode(ctx.className!, "CLASS")!
      .static! as NodeMap;
  }

  if (!category) return;
  return store.get(section)?.get(category);
}

function getSelectorComponents(query: string) {
  return getSelector(query).split(".");
}

function getSelector(query: string) {
  const [selector] = getQueryParts(query);
  return selector;
}

function getQueryParts(query: string): [string, string] | [string] {
  return cleanupQuery(query).split("?") as [string, string] | [string];
}
