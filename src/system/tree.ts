import deepEqual from "deep-equal";
import { CaseInsensitiveMap, NodeMap } from "../lib/map.ts";
import {
  assert,
  caseInsensitiveGet,
  expect,
  hasKeyOrValue,
  is,
  log,
  unwrapDependency,
} from "../lib/utils.ts";
import { getNodePath, PATH_COUNTER } from "../lib/nodepath.ts";

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
  count: Value;
  from: Node;
  selected?: Multiple;
  slectedKeys?: Set<string>;
  open?: Multiple;
  openKeys?: Set<string>;
};

export type Optional = {
  type: "OPTIONAL";
  value: Node;
  active?: boolean;
};

export type Literal = {
  type: "LITERAL";
  value: string | number | boolean;
};

export type Computed = {
  type: "COMPUTED";
  base?: Value;
  overwrite?: Value[];
  modifiers: Value[];
  proficiency?: { value: ProficiencyValue; source: string }[];
};
export type Value = (Literal | Computed) & { source?: string };

export type Dependency = {
  type: "DEPENDENCY";
  query: string;
  result?: Node;
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
  value?: ProficiencyValue;
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
  level: number;
  upcast?: boolean;
  ability?: Node;
};

export type Spellcasting = {
  type: "SPELLCASTING";
  ability: Node;
  table: Record<
    string,
    { spells: number; slots: number[]; prepared?: number; cantrips?: number }
  >;
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
  source?: Set<string>;
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
  & { key?: string; description?: string };
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

export function iterate(
  tree: Node,
  config?: {
    maxIterations?: number;
    store?: Store;
    log?: boolean;
  },
) {
  const {
    maxIterations,
    store = new CaseInsensitiveMap() as Store,
  } = config ??
    {
      maxIterations: undefined,
      store: new CaseInsensitiveMap(),
      log: false,
    };

  log(`ITERATION #0`, config?.log ?? false);
  let previous = parse(tree, {
    nodePath: "ROOT",
    store,
    apply: true,
    choiceDelete: true,
    log: config?.log ?? false,
  });

  let iterations = 1;
  while (true) {
    log(`ITERATION #${iterations}`, config?.log ?? false);
    const result = parse(previous, {
      nodePath: "ROOT",
      store,
      apply: true,
      choiceDelete: true,
      log: config?.log ?? false,
    });

    if (deepEqual(previous, result)) return { result, iterations, store };
    previous = result;
    iterations++;
    if (maxIterations && maxIterations < iterations) {
      return { result, iterations, store };
    }
  }
}

type ParseCtx = {
  nodePath: string;
  store: Store;
  classLevel?: number;
  className?: string;
  apply: boolean;
  choiceDelete: boolean;
  log: boolean;
};

function parse(
  node: Node,
  ctxInput: ParseCtx,
): Node {
  const ctx: ParseCtx = {
    ...ctxInput,
    nodePath: getNodePath(node, ctxInput.nodePath),
  };

  try {
    switch (node.type) {
      case "MODIFIER": {
        const value = unwrapDependency(parse(node.value, ctx));
        assert(value, ctx.nodePath, "COMPUTED", "LITERAL");

        const set = node.set ? parse(node.set, ctx) : undefined;
        const modify = node.modify ? parse(node.modify, ctx) : undefined;

        if (
          node.set && is(node.set, "DEPENDENCY") &&
          !node.set.query.toLowerCase().startsWith("character")
        ) {
          throw "Forbidden set access outside of character";
        }

        if (
          node.modify && is(node.modify, "DEPENDENCY") &&
          !node.modify.query.toLowerCase().startsWith("character")
        ) {
          throw "Forbidden set access outside of character";
        }

        const valueObject = {
          ...value,
          source: ctx.nodePath,
        };

        const applyComputed = (
          computed: Computed,
          key: "modifiers" | "overwrite",
        ) => {
          if (computed[key] === undefined) computed[key] = [];

          if (!ctx.apply) {
            computed[key] = computed[key].filter((element) =>
              element.source !== ctx.nodePath
            );
            return;
          }

          const existingIndex = computed[key].findIndex((element) =>
            element.source === ctx.nodePath
          );

          if (existingIndex !== -1) {
            computed[key][existingIndex] = valueObject;
          } else computed[key].push(valueObject);
        };

        if (set) {
          const unwrapped = unwrapDependency(set);

          assert(unwrapped, ctx.nodePath, "COMPUTED", "MULTIPLE");

          if (is(unwrapped, "COMPUTED")) applyComputed(unwrapped, "overwrite");
          else {
            unwrapped.values
              .filter((v) => is(v, "COMPUTED"))
              .forEach((v) => applyComputed(v, "overwrite"));
          }
        }

        if (modify) {
          const unwrapped = unwrapDependency(modify);
          assert(unwrapped, ctx.nodePath, "COMPUTED", "MULTIPLE");

          if (is(unwrapped, "COMPUTED")) applyComputed(unwrapped, "modifiers");
          else {
            unwrapped.values
              .filter((v) => is(v, "COMPUTED"))
              .forEach((v) => applyComputed(v, "modifiers"));
          }
        }

        return { ...node, value, set, modify };
      }
      case "MULTIPLE": {
        return {
          ...node,
          values: node.values
            .map((v) => parse(v, ctx))
            .filter((v) => hasKeyOrValue(v, ctx.log)),
        };
      }
      case "DEPENDENCY": {
        const result = lookup(ctx.store, node.query) ?? EMPTY;
        const key = node.key ?? node.query;
        return { ...node, result, key };
      }
      case "CLASS": {
        const level = ctx.store
          .getOrThrow("character")
          .getOrThrow("classes")
          .getNode(node.name, "CLASS")!
          .level!;

        return {
          ...node,
          levels: parseLevels(node.levels, level, {
            ...ctx,
            className: node.name,
          }),
        };
      }
      case "CHOOSE": {
        const from = parse(node.from, {
          ...ctx,
          apply: false,
          choiceDelete: false,
        });

        const unwrapped = unwrapDependency(from);

        assert(unwrapped, ctx.nodePath, "MULTIPLE");

        const choices = ctx.store
          .getOrThrow("character")
          .getOrThrow("choices");

        if (!ctx.apply && ctx.choiceDelete && choices.has(ctx.nodePath)) {
          choices.delete(ctx.nodePath);
          return node;
        }

        if (!ctx.apply) return node;

        const optionKeys = new Set(
          unwrapped.values
            .map((v) => "name" in v ? v.name : v.key)
            .filter((s) => s !== undefined),
        );
        const choice = ctx.store
          .getOrThrow("character")
          .getOrThrow("choices")
          .getOrInsert(ctx.nodePath, {
            ...node,
            slectedKeys: new Set(),
            openKeys: optionKeys,
          }) as Choose;

        const selectedValues = unwrapped.values.filter((v) =>
          choice.slectedKeys!.has("name" in v ? v.name : v.key)
        );

        const openValues = unwrapped.values.filter((v) =>
          !choice.slectedKeys!.has("name" in v ? v.name : v.key)
        );

        choice.openKeys = optionKeys.difference(choice.slectedKeys!);

        return {
          ...node,
          selected: {
            type: "MULTIPLE",
            values: selectedValues.map((v) =>
              parse(v, ctx) as NodeWithKey | NodeWithName
            ),
          },
          open: { type: "MULTIPLE", values: openValues },
          from,
        };
      }
      case "OPTIONAL": {
        parse(node.value, {
          ...ctx,
          apply: false,
          choiceDelete: false,
        });

        const options = ctx.store
          .getOrThrow("character")
          .getOrThrow("options");

        if (!ctx.apply && ctx.choiceDelete && options.has(ctx.nodePath)) {
          options.delete(ctx.nodePath);
          return node;
        }

        if (!ctx.apply) return node;

        const option = options
          .getOrInsert(ctx.nodePath, {
            ...node,
            active: false,
          }) as Optional;

        return {
          ...node,
          value: option.active ? parse(node.value, ctx) : EMPTY,
        };
      }
      case "FEAT": {
        const gives = node.gives
          ? parse(node.gives, ctx) as Multiple
          : undefined;

        const level = ctx.classLevel ??
          ctx.store
            .getOrThrow("character")
            .getOrThrow("info")
            .getNode(
              "characterlevel",
              "LITERAL",
            )!.value as number;

        const levels = node.levels
          ? parseLevels(node.levels, level, ctx)
          : undefined;

        return { ...node, gives, levels };
      }
      case "PROFICIENCY": {
        const applyTypeProficiency = (
          node: Node | undefined,
          kind: "armor" | "weapon",
        ) => {
          if (!node) return;
          const unwrapped = unwrapDependency(node);
          assert(unwrapped, ctx.nodePath, "MULTIPLE", "CHOOSE");

          const values = unwrapped.type === "MULTIPLE"
            ? unwrapped.values
            : unwrapped.selected && unwrapped.selected.type === "MULTIPLE"
            ? unwrapped.selected.values
            : undefined;

          if (!values) return;

          values.forEach((t) => {
            if (
              !expect(t, { path: ctx.nodePath, log: ctx.log }, "TYPE") ||
              t.of.toLowerCase() !== kind
            ) return;
            const identifier = `${t.of}.${t.name}`;
            const source = `${ctx.nodePath}@${kind}`;
            const existing = ctx.store
              .getOrThrow("character")
              .getOrThrow("proficiencies")
              .getOrInsert(identifier, {
                ...t,
                source: new Set([source]),
              }) as Type;
            existing.source!.add(source);
          });
        };

        const applyComputedProficiency = (
          node: Node | undefined,
          kind: "skills" | "saves",
          proficiency: ProficiencyValue,
        ) => {
          if (!node) return;
          const unwrapped = unwrapDependency(node);
          assert(unwrapped, ctx.nodePath, "MULTIPLE", "CHOOSE");

          const category = ctx.store
            .getOrThrow("character")
            .getOrThrow(kind);

          const deleteNodes = (toDelete: Node[]) => {
            for (const element of toDelete) {
              if (!("name" in element)) continue;

              const current = category.getNode(element.name, "COMPUTED");
              if (!current || !current.proficiency) continue;

              current.proficiency = current.proficiency.filter(
                (p) => p.source !== ctx.nodePath,
              );
            }
          };

          const createNodes = (toCreate: Node[]) => {
            for (const element of toCreate) {
              if (!("name" in element)) continue;
              const newValue = { value: proficiency, source: ctx.nodePath };

              const current = category.getNode(
                element.name,
                "COMPUTED",
              );

              if (!current) continue;
              if (!current.proficiency) current.proficiency = [];
              const existingIndex = current.proficiency.findIndex((m) =>
                m.source === ctx.nodePath
              );

              if (existingIndex !== -1) {
                current.proficiency[existingIndex] = newValue;
              } else current.proficiency.push(newValue);
            }
          };

          switch (unwrapped.type) {
            case "MULTIPLE": {
              if (!ctx.apply) deleteNodes(unwrapped.values);
              else createNodes(unwrapped.values);
              break;
            }
            case "CHOOSE": {
              const openValues = unwrapped.open?.values ?? [];
              const selectedValues = unwrapped.selected?.values ?? [];
              const toDelete = ctx.apply
                ? openValues
                : [...openValues, ...selectedValues] as Node[];
              const toCreate = ctx.apply ? selectedValues : [];

              deleteNodes(toDelete);
              createNodes(toCreate);
              break;
            }
          }
        };

        const armor = node.armor ? parse(node.armor, ctx) : undefined;
        if (ctx.apply && armor) {
          applyTypeProficiency(unwrapDependency(armor), "armor");
        }

        const weapon = node.weapon ? parse(node.weapon, ctx) : undefined;
        if (ctx.apply && weapon) {
          applyTypeProficiency(unwrapDependency(weapon), "weapon");
        }

        const skill = node.skill ? parse(node.skill, ctx) : undefined;
        applyComputedProficiency(skill, "skills", node.value ?? 1);

        const save = node.save ? parse(node.save, ctx) : undefined;
        applyComputedProficiency(save, "saves", node.value ?? 1);

        return { ...node, armor, weapon, skill };
      }

      case "SPELLCASTING": {
        const ability = parse(node.ability, ctx);
        assert(unwrapDependency(ability), ctx.nodePath, "ABILITY");

        if (ctx.className) {
          const spellcasting = ctx.store
            .getOrThrow("character")
            .getOrInsert("spellcasting", new NodeMap());

          spellcasting.set(ctx.className, {
            ...node,
            ability: unwrapDependency(ability),
          });
        }

        return { ...node, ability };
      }

      case "SPELL": {
        if (!ctx.apply) return node;

        const spell = ctx.store
          .getOrThrow("character")
          .getOrInsert("spells", new NodeMap())
          .getOrInsert(node.name, node) as Spell;

        if (!spell.castWithoutSpellSlot) {
          spell.castWithoutSpellSlot = node.castWithoutSpellSlot;
        }
        if (!spell.alwaysPrepared) {
          spell.alwaysPrepared = node.alwaysPrepared;
        }
        if (!spell.upcast) {
          spell.upcast = node.upcast;
        }

        if (!ctx.className) return node;

        const ability = node.ability ? parse(node.ability, ctx) : ctx.store
          .getOrThrow("character")
          .get("spellcasting")
          ?.getNode(ctx.className, "SPELLCASTING")
          ?.ability;

        if (
          !ability ||
          !expect(unwrapDependency(ability), { path: ctx.nodePath }, "ABILITY")
        ) {
          return node;
        }

        spell.ability = unwrapDependency(ability);

        return { ...node, ability };
      }

      case "COMPUTED":
      case "SUBCLASS":
      case "ACTION":
      case "ROLL":
      case "RESOURCE": {
        log(node.type, ctx.log);
        return node;
      }
      case "ABILITY":
      case "TYPE":
      case "EMPTY":
      case "LITERAL":
      case "SKILL":
        return node;
      case "IMPORT": {
        throw `Unexpected import at: ${ctx.nodePath}`;
      }
    }
  } catch (error) {
    log(`${error} at ${ctx.nodePath}`, ctx.log);
    return EMPTY;
  }

  function parseLevels(
    levels: Record<string, Node>,
    currentLevel: number,
    ctx: ParseCtx,
  ) {
    const result = Object.entries(levels)
      .map((
        [level, value],
      ) => [
        level,
        parse(value, {
          ...ctx,
          apply: ctx.apply && parseInt(level) <= currentLevel,
          nodePath: `${ctx.nodePath}${PATH_COUNTER}${level}`,
        }),
      ])
      .filter(([level]) => parseInt(level as string) <= currentLevel);
    return Object.fromEntries(result);
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
