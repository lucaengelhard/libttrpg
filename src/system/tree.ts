import deepEqual from "deep-equal";
import { CaseInsensitiveMap, NodeMap } from "../lib/map.ts";
import {
  assert,
  caseInsensitiveGet,
  expect,
  hasKeyOrValue,
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
  overwrite?: Value;
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
const PROTECTED_SECTIONS = ["library"];
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

        const applyValue = (dep: Dependency, mode: "SET" | "MODIFY") => {
          updateModifier(
            ctx.store,
            dep.query,
            { ...value, source: ctx.nodePath },
            mode,
            ctx.apply,
          );
        };

        // TODO: Remove if apply is false
        if (
          node.set &&
          expect(
            node.set,
            { path: ctx.nodePath, log: ctx.log },
            "DEPENDENCY",
            "MULTIPLE",
          )
        ) {
          if (node.set.type === "DEPENDENCY") applyValue(node.set, "SET");
          else {
            node.set.values
              .forEach((v) =>
                v.type === "DEPENDENCY" ? applyValue(v, "SET") : null
              );
          }
        }

        if (
          node.modify &&
          expect(
            node.modify,
            { path: ctx.nodePath, log: ctx.log },
            "DEPENDENCY",
            "MULTIPLE",
          )
        ) {
          if (node.modify.type === "DEPENDENCY") applyValue(node.modify, "SET");
          else {
            node.modify.values
              .forEach((v) =>
                v.type === "DEPENDENCY" ? applyValue(v, "MODIFY") : null
              );
          }
        }

        return { ...node, value };
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
          if (
            !node ||
            !expect(
              node,
              { path: ctx.nodePath, log: ctx.log },
              "MULTIPLE",
              "CHOOSE",
            )
          ) {
            return;
          }

          const values = node.type === "MULTIPLE"
            ? node.values
            : node.selected && node.selected.type === "MULTIPLE"
            ? node.selected.values
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

function updateModifier(
  store: Store,
  query: string,
  value: Value,
  mode: "SET" | "MODIFY",
  apply: boolean,
) {
  const [sectionKey, categoryKey, entryKey] = getSelectorComponents(query);
  if (!entryKey || PROTECTED_SECTIONS.includes(sectionKey)) return;

  const category = store
    .getOrInsert(
      sectionKey,
      new CaseInsensitiveMap(),
    ).getOrInsert(
      categoryKey,
      new NodeMap(),
    );

  const current = category.getOrInsert(entryKey, {
    type: "COMPUTED",
    modifiers: [],
  });
  if (current.type !== "COMPUTED" || value.source === undefined) return;

  if (!apply) {
    switch (mode) {
      case "SET": {
        current.overwrite !== undefined &&
          current.overwrite.source === value.source
          ? current.overwrite = undefined
          : null;
        break;
      }
      case "MODIFY": {
        current.modifiers = current.modifiers.filter((m) =>
          m.source !== value.source
        );
      }
    }

    return;
  }

  switch (mode) {
    case "SET": {
      if (current.overwrite !== undefined) {
        // TODO
      }
      current.overwrite = value;
      break;
    }
    case "MODIFY": {
      const existingIndex = current.modifiers.findIndex((m) =>
        m.source === value.source
      );

      if (existingIndex !== -1) current.modifiers[existingIndex] = value;
      else current.modifiers.push(value);

      break;
    }
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
