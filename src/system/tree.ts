import deepEqual from "deep-equal";
import { CaseInsensitiveMap, NodeMap } from "../lib/map.ts";
import {
  caseInsensitiveGet,
  getModifier,
  getProficiencyBonus,
  readData,
} from "../lib/utils.ts";
import { createLibrary } from "./library.ts";
import { Character } from "./character.ts";

// OPERATORS
export type Import = {
  type: "IMPORT";
  from: string;
};

export type Multiple = {
  type: "MULTIPLE";
  values: (NodeWithKey | NodeWithName)[];
};

export type Choose = {
  type: "CHOOSE";
  count: number | Value;
  from: Multiple;
};

export type Optional = {
  type: "OPTIONAL";
  value: Node;
};

export type Literal = {
  type: "LITERAL";
  value: string | number | boolean;
};

export type Computed = {
  type: "COMPUTED";
  base?: Value;
  overwrite?: Value;
  modifiers: Value[];
  proficiency?: ProficiencyValue;
};
export type Value = Literal | Computed;

export type Dependency = {
  type: "DEPENDENCY";
  query: string;
};

export type Empty = typeof EMPTY;
export const EMPTY = { type: "EMPTY" } as const;

// VALUES
export type Class = {
  type: "CLASS";
  name: string;
  levels: Record<string, Node>;
  level?: number;
};

export type Subclass = {
  type: "SUBCLASS";
  name: string;
  for: string;
  levels: Record<string, Node>;
};

export type Feat = {
  type: "FEAT";
  name: string;
  levels?: Record<string, Node>;
  gives?: Multiple;
};

export type Proficiency = {
  type: "PROFICIENCY";
  save?: Node;
  skill?: Node;
  armor?: Node;
  weapon?: Node;
};

export type Modifier = {
  type: "MODIFIER";
  value: Node;
  modify?: Node;
  set?: Node;
  // TODO add conditional setting and modifying
};

export type Action = {
  type: "ACTION";
  time: string;
  effect: Node;
};

export type Spell = {
  type: "SPELL";
  name: string;
  alwaysPrepared?: boolean;
  castWithoutSpellSlot?: Resource;
};

export type Spellcasting = {
  type: "SPELLCASTING";
  ability: Node;
  prepare?: boolean;
  table: {
    spells?: {
      knownCount?: Node;
      preparedCount?: Node;
    };
    cantrips?: {
      knownCount?: Node;
    };
  };
};

export type Roll = {
  type: "ROLL";
  diceType: Node;
  diceCount: Node;
  minimum: Node;
  modifier: Node;
};

export type Resource = {
  type: "RESOURCE";
  name: string;
  uses: Node;
  resetTrigger: string;
};

export type Ability = { type: "ABILITY"; name: string };
export type Skill = {
  type: "SKILL";
  name: string;
  ability: string;
  hasPassive?: boolean;
};

export type Type = {
  type: "TYPE";
  of: string;
  name: string;
};

export type Node =
  & (
    | Import
    | Multiple
    | Dependency
    | Value
    | Choose
    | Optional
    | Empty
    | Class
    | Subclass
    | Feat
    | Proficiency
    | Modifier
    | Action
    | Spell
    | Spellcasting
    | Roll
    | Resource
    | Ability
    | Skill
    | Type
  )
  & { key?: string };
export type NodeWithKey = Node & { key: string };
export type NodeWithName = Node & { name: string };
export type NodeType = Node["type"];
export type NodeWithout<T extends NodeType> = Exclude<Node, { type: T }>;
export type NodeWith<T extends NodeType> = Extract<Node, { type: T }>;
export type ProficiencyValue = 0.5 | 1 | 2;

export type Store = CaseInsensitiveMap<
  string,
  CaseInsensitiveMap<string, NodeMap>
>;

function iterate(
  tree: Node,
  config?: { maxIterations?: number; store?: Store },
) {
  const { maxIterations, store = new CaseInsensitiveMap() as Store } = config ??
    { maxIterations: undefined, store: new CaseInsensitiveMap() };

  let previous = parse(store, tree);
  let iterations = 1;
  while (true) {
    const result = parse(store, previous);

    if (deepEqual(previous, result)) return { result, iterations, store };
    previous = result;
    iterations++;
    if (maxIterations && maxIterations < iterations) {
      return { result, iterations, store };
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
      new NodeMap(),
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
