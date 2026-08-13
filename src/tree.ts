import deepEqual from "deep-equal";
import * as path from "@std/path";
import { CaseInsensitiveMap, NodeMap } from "./lib/map.ts";
import { caseInsensitiveGet, getModifier, readData } from "./lib/utils.ts";

// OPERATORS
type Import = {
  type: "IMPORT";
  from: string;
};

type Multiple = {
  type: "MULTIPLE";
  values: (NodeWithKey | NodeWithName)[];
};

type Choose = {
  type: "CHOOSE";
  count: number | Value;
  from: Multiple;
};

type Optional = {
  type: "OPTIONAL";
  value: Node;
};

type Literal = {
  type: "LITERAL";
  value: string | number | boolean;
};

type Computed = {
  type: "COMPUTED";
  base?: Value;
  overwrite?: Value;
  modifiers: Value[];
};
type Value = Literal | Computed;

type Dependency = {
  type: "DEPENDENCY";
  query: string;
};

type Empty = typeof EMPTY;
const EMPTY = { type: "EMPTY" } as const;

// VALUES
type Class = {
  type: "CLASS";
  name: string;
  levels: Record<string, Node>;
};

type Subclass = {
  type: "SUBCLASS";
  name: string;
  for: string;
  levels: Record<string, Node>;
};

type Feat = {
  type: "FEAT";
  name: string;
  levels?: Record<string, Node>;
  gives?: Multiple;
};

type Ability = { type: "ABILITY"; name: string };
type Skill = {
  type: "SKILL";
  name: string;
  ability: string;
  hasPassive?: boolean;
};

type Type = {
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
    | Ability
    | Skill
    | Type
  )
  & { key?: string };
type NodeWithKey = Node & { key: string };
type NodeWithName = Node & { name: string };

type Store = CaseInsensitiveMap<
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

type Library = CaseInsensitiveMap<string, NodeMap>;
async function createLibrary(entryPoint: string): Promise<Library> {
  const { data } = await readData("", entryPoint);
  const library: Library = new CaseInsensitiveMap();

  const resolved = await resolveImports(data, path.resolve(entryPoint));
  //console.log(JSON.stringify(resolved, null, 1));

  build(resolved);

  return library;

  async function resolveImports(node: Node, filePath: string): Promise<Node> {
    switch (node.type) {
      case "IMPORT": {
        const { data, newPath } = await readData(filePath, node.from);
        return resolveImports(data, newPath);
      }
      case "MULTIPLE": {
        return {
          ...node,
          values: await Promise.all(
            node.values.map((v) =>
              resolveImports(v, filePath) as Promise<NodeWithKey>
            ),
          ),
        };
      }

      case "CHOOSE": {
        return {
          ...node,
          from: await resolveImports(node.from, filePath) as Multiple,
        };
      }

      case "CLASS": {
        return { ...node, levels: await resolveLevels(node.levels, filePath) };
      }
      case "SUBCLASS": {
        return { ...node, levels: await resolveLevels(node.levels, filePath) };
      }
      case "FEAT": {
        return {
          ...node,
          levels: node.levels
            ? await resolveLevels(node.levels, filePath)
            : undefined,
          gives: node.gives
            ? await resolveImports(node.gives, filePath) as Multiple
            : undefined,
        };
      }

      case "OPTIONAL": {
        return { ...node, value: await resolveImports(node.value, filePath) };
      }

      case "EMPTY":
      case "DEPENDENCY":
      case "LITERAL":
      case "COMPUTED":
      case "SKILL":
      case "ABILITY":
      case "TYPE": {
        return node;
      }
      default: {
        console.log(node.type);

        return node;
      }
    }

    async function resolveLevels(
      levels: Record<string, Node>,
      filePath: string,
    ): Promise<Record<string, Node>> {
      const result = Object.entries(levels)
        .map(async (
          [level, value],
        ) => [level, await resolveImports(value, filePath)]);

      return Object.fromEntries(
        await Promise.all(result),
      );
    }
  }

  function build(node: Node) {
    if (!node) return;
    if ("key" in node || "name" in node) {
      const anyNode = node as any; // TODO
      appendToLib(
        anyNode.key ?? anyNode.name,
        node as NodeWithKey | NodeWithName,
      );
      return;
    }
    if ("name" in node || node.type === "IMPORT") return;

    switch (node.type) {
      case "MULTIPLE": {
        for (const value of node.values) {
          build(value);
        }
        break;
      }
      case "EMPTY":
      case "CHOOSE":
      case "OPTIONAL":
      case "LITERAL":
      case "COMPUTED":
      case "DEPENDENCY":
      default:
        //console.log(node.type);
    }

    function appendToLib(key: string, node: NodeWithKey | NodeWithName) {
      const category = library.getOrInsert(node.type, new NodeMap());
      if (category.has(key)) {
        throw `Duplicate Identifier in ${node.type}: ${key}`;
      }
      category.set(key, structuredClone(node));
    }
  }
}

function resolveValue(node: Value): string | number | boolean | undefined {
  switch (node.type) {
    case "LITERAL":
      return node.value;
    case "COMPUTED": {
      if (node.overwrite) return resolveValue(node.overwrite);
      const base = node.base ? resolveValue(node.base) : undefined;
      const modifiers = node.modifiers.map(resolveValue).filter((v) =>
        v !== undefined
      );

      const values = base ? [base, ...modifiers] : modifiers;
      return values.length > 0
        ? values
          .reduce((acc, curr) => {
            const isBool = typeof acc === "boolean" ||
              typeof curr === "boolean";
            const isNumber = typeof acc === "number" ||
              typeof curr === "number";

            return isBool
              ? (Boolean(acc) && Boolean(curr))
              : isNumber
              ? Number(acc) + Number(curr)
              : acc + curr;
          })
        : undefined;
    }
  }
}

class Character {
  #store: Store;
  constructor(library: Library) {
    const abilities = library
      .getOrThrow("ability")
      .keys()
      .map((name) => [name, { type: "COMPUTED", modifiers: [] as Value[] }]);

    const saves = library
      .getOrThrow("ability")
      .keys()
      .map((name) => [name, { type: "COMPUTED", modifiers: [] as Value[] }]);

    const skills = library
      .getOrThrow("skill")
      .keys()
      .map((name) => [name, { type: "COMPUTED", modifiers: [] as Value[] }]);

    const passives = library
      .getOrThrow("skill")
      .entries()
      .filter(([_, skill]) => "hasPassive" in skill && skill.hasPassive)
      .map(([name]) => [name, { type: "COMPUTED", modifiers: [] as Value[] }]);

    this.#store = new CaseInsensitiveMap([
      ["library", library],
      [
        "character",
        new CaseInsensitiveMap([
          ["abilities", new NodeMap(abilities as any)],
          ["saves", new NodeMap(saves as any)],
          ["skills", new NodeMap(skills as any)],
          ["passives", new NodeMap(passives as any)],
          ["info", new NodeMap()],
        ]),
      ],
    ]);
  }

  public addClass(className: string) {
    const classValue = this.#store.get("library")?.get("class")?.get(className);
    if (
      !classValue ||
      this.#store.get("character")!.getOrInsert(
        "classes",
        new NodeMap(),
      ).has(className)
    ) return;

    const classes = this.#store
      .get("character")!
      .getOrInsert("classes", new NodeMap());

    classes.set(className, classValue);
  }

  public setName(name: string) {
    this.#store
      .getOrThrow("character")
      .getOrThrow("info")
      .set("name", { type: "LITERAL", value: name });
  }

  public setAbilityBase(name: string, value: number) {
    const ability = this.#store
      .getOrThrow("character")
      .getOrThrow("abilities")
      .get(name) as Computed | undefined;
    if (!ability) return;

    ability.base = { type: "LITERAL", value };
  }

  public get() {
    const character = this.#store.getOrThrow("character");
    const abilities = new CaseInsensitiveMap(
      character
        .getOrThrow("abilities")
        .entries()
        .map((
          [name, value],
        ) => [name, resolveValue(value as Value) as number | undefined ?? 0]),
    );
    const saves = new CaseInsensitiveMap(
      character
        .getOrThrow("saves")
        .entries()
        .map(([name, value]) => {
          const modifier = getModifier(abilities.getOrThrow(name));
          const bonus = resolveValue(value as Value) as number ?? 0;

          return [name, modifier + bonus];
        }),
    );

    const skills = new CaseInsensitiveMap(
      character
        .getOrThrow("skills")
        .entries()
        .map(([name, value]) => {
          const skill = this.#store
            .getOrThrow("library")
            .getOrThrow("skill")
            .getNode(name, "SKILL")!;

          const modifier = getModifier(abilities.getOrThrow(skill.ability));
          const bonus = resolveValue(value as Value) as number ?? 0;

          return [name, modifier + bonus];
        }),
    );

    const passives = new CaseInsensitiveMap(
      character
        .getOrThrow("passives")
        .entries()
        .map(([name, value]) => {
          const modifier = skills.getOrThrow(name);
          const bonus = resolveValue(value as Value) as number ?? 0;
          return [name, modifier + bonus];
        }),
    );

    return {
      name: character
        .getOrThrow("info")
        .getNode("name", "LITERAL")?.value,
      abilities,
      saves,
      skills,
      passives,
    };
  }
}

const lib = await createLibrary("./examples/index.json");
const char = new Character(lib);
//char.addClass("ranger");

char.setName("Vaas");
char.setAbilityBase("strength", 12);
char.setAbilityBase("dexterity", 15);
char.setAbilityBase("constitution", 14);
char.setAbilityBase("intelligence", 13);
char.setAbilityBase("wisdom", 13);
char.setAbilityBase("charisma", 8);

console.log(char.get());
