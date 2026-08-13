import { CaseInsensitiveMap } from "./lib/map.ts";
import { caseInsensitiveGet } from "./lib/utils.ts";
import deepEqual from "deep-equal";

type Modifier = {
  type: "MODIFIER";
  value: Node;
  set: string;
};

type Multiple = {
  type: "MULTIPLE";
  values: NodeWithKey[];
};

type Dependency = {
  type: "DEPENDENCY";
  query: string;
};

type Literal = {
  type: "LITERAL";
  value: string | number | boolean;
};

type Empty = typeof EMPTY;
const EMPTY = { type: "EMPTY" } as const;

type Node = Modifier | Multiple | Dependency | Literal | Empty;
type NodeWithKey = Node & { key: string };

type Store = CaseInsensitiveMap<
  string,
  CaseInsensitiveMap<string, CaseInsensitiveMap<string, Node>>
>;

function iterate(
  tree: Node,
  config?: { maxIterations?: number },
) {
  const { maxIterations } = config ?? { maxIterations: undefined };
  const store: Store = new CaseInsensitiveMap();

  let previous = parse(store, tree);
  let iterations = 1;
  while (true) {
    const result = parse(store, previous);

    if (deepEqual(previous, result)) return { result, iterations };
    previous = result;
    iterations++;
    if (maxIterations && maxIterations < iterations) {
      return { result, iterations };
    }
  }
}

function parse(
  store: Store,
  node: Node,
): Node {
  switch (node.type) {
    case "MODIFIER": {
      const result = parse(store, node.value);

      set(store, node.set, result);

      return { ...node, value: result };
    }
    case "MULTIPLE": {
      return {
        ...node,
        values: node.values.map((v) => parse(store, v)) as NodeWithKey[],
      };
    }
    case "DEPENDENCY": {
      return lookup(store, node.query) ?? node;
    }
    case "EMPTY":
    case "LITERAL": {
      return node;
    }
  }
}

function lookup(store: Store, query: string): Node | undefined {
  const category = getCategory(store, query);
  if (!category) return;

  const [_, params] = getQueryParts(query);
  const [_sectionKey, _categoryKey, entryKey] = getSelectorComponents(query);

  if (entryKey) {
    const entry = category.get(entryKey);
    if (entry && applyParams(entry)) {
      return entry;
    }
  } else {
    const res: Multiple = {
      type: "MULTIPLE",
      values: category.values().filter(applyParams).toArray() as NodeWithKey[],
    };

    return res;
  }

  function applyParams(node: Node): boolean {
    if (!params) return true;
    const paramsSegments = params.split(";");

    for (const segment of paramsSegments) {
      const [category, options] = segment.split("=");
      const values = options.split("|");
      const nodeValue = caseInsensitiveGet(node, category)?.toString();

      if (!nodeValue || !values.includes(nodeValue)) return false;
    }
    return true;
  }
}

function set(store: Store, query: string, value: Node) {
  const [sectionKey, categoryKey, entryKey] = getSelectorComponents(query);
  if (!entryKey) return;

  const category = store
    .getOrInsert(
      sectionKey,
      new CaseInsensitiveMap(),
    ).getOrInsert(
      categoryKey,
      new CaseInsensitiveMap(),
    );

  const current = category.get(entryKey);
  // TODO: How to resolve conflicting values (e.g. updates in the same cycle, what value has precedence over the other?)
  category.set(entryKey, value);
}

function cleanupQuery(query: string) {
  return query.toLowerCase();
}

function getCategory(store: Store, query: string) {
  const [section, category] = getSelectorComponents(query);
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
