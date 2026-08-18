import deepEqual from "deep-equal";

import { NodeMap } from "../../lib/map.ts";
import { getNodePath, PATH_COUNTER } from "../../lib/nodepath.ts";
import {
  add,
  arrayCount,
  getMultipleKeys,
  getNodeIdentifier,
  is,
  isSafeWrite,
  normalizeValue,
  resolveValue,
  unwrapChoose,
  unwrapDependency,
  wrapInMultiple,
} from "../../lib/utils.ts";
import {
  type Computed,
  EMPTY,
  type Node,
  type NodeWithKey,
  type NodeWithName,
  PROFICIENCY_NAME,
  type Store,
  type StoreKey,
  type Value,
} from "./types.ts";

export function cycle(
  tree: Node,
  store: Store,
): { nextTree: Node; nextState: Store } {
  const nextTree = resolve(tree, {
    store,
    path: "ROOT",
    scope: new NodeMap(),
  });

  const character: Store["character"] = store.character.keep("info");
  store.character.lock();

  apply(nextTree, { path: "ROOT", next: character });

  if (!deepEqual(tree, nextTree) && !store.character.isSameAs(character)) {
    return cycle(nextTree, { ...store, character });
  }

  return { nextTree, nextState: { ...store, character } };
}

type ResolveContext = {
  store: Store;
  path: string;
  classLevel?: number;
  className?: string;
  featName?: string;
  subclassName?: string;
  scope: NodeMap;
};
function resolve<N extends Node>(node: N, ctxInput: ResolveContext): N {
  const ctx: ResolveContext = {
    ...ctxInput,
    path: getNodePath(node, ctxInput.path),
    scope: createScope(node, ctxInput),
  };

  switch (node.type) {
    case "MULTIPLE": {
      return {
        ...node,
        values: node.values.map((v) => resolve(v, ctx)),
      };
    }
    case "DEPENDENCY": {
      const key = node.key ?? node.query;
      const result = resolve(lookup(node.query, ctx) ?? EMPTY, ctx);

      return {
        ...node,
        result,
        key,
      };
    }

    case "ROLL": {
      const diceType = resolve(node.diceType, ctx);
      const diceCount = resolve(node.diceCount, ctx);
      const minimum = resolve(node.minimum, ctx);
      const modifier = resolve(node.modifier, ctx);

      return { ...node, diceType, diceCount, minimum, modifier };
    }

    case "CHOOSE": {
      const from = resolve(node.from, ctx);
      const unwrappedFrom = unwrapDependency(from);

      const count = resolve(node.count, ctx);
      const unwrappedCount = unwrapDependency(count);

      const current = ctx.store.character
        ?.get("choose")
        ?.getNode(ctx.path, "CHOOSE");

      if (
        !current || !is(unwrappedFrom, "MULTIPLE") ||
        !is(unwrappedCount, "LITERAL", "COMPUTED")
      ) {
        return { ...node, from };
      }

      const characterLevel = ctx.store.character
        ?.get("info")
        ?.getNode("characterLevel", "LITERAL")
        ?.value as number | undefined;

      const additionalAtClassLevel =
        current.chooseAdditionalAt?.classLevel && ctx.classLevel
          ? arrayCount(
            current.chooseAdditionalAt.classLevel,
            (l) => l <= (ctx.classLevel ?? 0),
          )
          : 0;

      const additionalAtLevel =
        current.chooseAdditionalAt?.level && characterLevel
          ? arrayCount(
            current.chooseAdditionalAt.level,
            (l) => l <= characterLevel,
          )
          : 0;

      const maxOptions = resolveValue(unwrappedCount) as number +
        additionalAtClassLevel + additionalAtLevel;

      const currentSelectedKeys = current.selected
        ? getMultipleKeys(current.selected)
        : undefined;

      const selected = current && currentSelectedKeys
        ? wrapInMultiple(unwrappedFrom.values
          .filter((v, i) =>
            currentSelectedKeys.has(getNodeIdentifier(v) ?? "") &&
            i < maxOptions
          ))
        : undefined;

      const open = current && currentSelectedKeys
        ? wrapInMultiple(unwrappedFrom.values
          .filter((v) => !currentSelectedKeys.has(getNodeIdentifier(v) ?? "")))
        : unwrappedFrom;

      return { ...node, selected, open, classLevel: ctx.classLevel };
    }
    case "OPTIONAL": {
      const current = ctx.store.character
        ?.get("optional")
        ?.getNode(ctx.path, "OPTIONAL");

      if (!current || !current.active) {
        return { ...node, active: false } as N;
      }

      return {
        ...node,
        value: resolve(node.value, ctx),
        active: true,
      };
    }
    case "CLASS": {
      const classLevel = ctx.store.character
        ?.get("class")
        ?.getNode(node.name, "CLASS")
        ?.level;

      const { levels, ...rest } = node;

      if (classLevel === undefined) return { ...rest, levels: {} } as N;

      return {
        ...node,
        level: classLevel,
        levels: resolveLevels(levels, classLevel, {
          ...ctx,
          classLevel,
          className: node.name,
        }),
      };
    }
    case "SUBCLASS": {
      const { levels, ...rest } = node;
      if (ctx.classLevel === undefined) return { ...rest, levels: {} } as N;
      return {
        ...node,
        levels: resolveLevels(levels, ctx.classLevel, {
          ...ctx,
          subclassName: node.name,
        }),
      };
    }
    case "FEAT": {
      const gives = node.gives ? resolve(node.gives, ctx) : undefined;

      const level = ctx.classLevel ??
        ctx.store.character
          ?.get("class")
          ?.values()
          .map((v) => is(v, "CLASS") ? v.level ?? 0 : 0)
          .reduce(add);

      const levels = node.levels && level
        ? resolveLevels(node.levels, level, { ...ctx, featName: node.name })
        : undefined;

      return { ...node, gives, levels };
    }
    case "PROFICIENCY": {
      const armor = node.armor ? resolve(node.armor, ctx) : undefined;
      const weapon = node.weapon ? resolve(node.weapon, ctx) : undefined;
      const skill = node.skill ? resolve(node.skill, ctx) : undefined;
      const save = node.save ? resolve(node.save, ctx) : undefined;

      return { ...node, armor, weapon, skill, save };
    }
    case "MODIFIER": {
      const value = resolve(node.value, ctx);

      const set = node.set ? resolve(node.set, ctx) : undefined;
      const modify = node.modify ? resolve(node.modify, ctx) : undefined;

      return { ...node, value, set, modify };
    }
    case "SPELL": {
      const castWithoutSpellSlot = node.castWithoutSpellSlot
        ? resolve(node.castWithoutSpellSlot, ctx)
        : undefined;

      const spellcasting = ctx.store.character.get("spellcasting");

      const selectedSpellcasting = spellcasting
        ? ctx.className
          ? spellcasting.getNode(ctx.className, "SPELLCASTING")
          : ctx.subclassName
          ? spellcasting.getNode(ctx.subclassName, "SPELLCASTING")
          : ctx.featName
          ? spellcasting.getNode(ctx.featName, "SPELLCASTING")
          : undefined
        : undefined;

      const ability = node.ability
        ? resolve(node.ability, ctx)
        : selectedSpellcasting?.ability;

      return { ...node, ability, castWithoutSpellSlot };
    }
    case "SPELLCASTING": {
      const ability = resolve(node.ability, ctx);

      return { ...node, ability };
    }
    case "RESOURCE": {
      const uses = resolve(node.uses, ctx);
      return { ...node, uses };
    }
    case "ACTION":
    case "COMPUTED":
    case "ABILITY":
    case "EMPTY":
    case "LITERAL":
    case "SKILL":
    case "TYPE":
      return node;
    case "IMPORT": {
      throw `Unexpected import at: ${ctx.path}`;
    }
    default: {
      const unhandled = node as Node;
      console.log(unhandled.type);
      return unhandled as N;
    }
  }
}

function resolveLevels(
  levels: Record<string, Node>,
  currentLevel: number,
  ctx: ResolveContext,
): Record<string, Node> {
  const result = Object.entries(levels)
    .map(([level, node]) => {
      return [
        level,
        resolve(
          { ...node, disabled: parseInt(level) > currentLevel },
          { ...ctx, path: `${ctx.path}${PATH_COUNTER}${level}` },
        ),
      ];
    });

  return Object.fromEntries(result);
}

function createScope(
  node: Node,
  ctx: ResolveContext,
): NodeMap {
  if (!("static" in node) || node.static === undefined) return ctx.scope;

  const scope = new NodeMap(ctx.scope);

  for (const [key, value] of Object.entries(node.static!)) {
    scope.set(key, value);
  }
  return scope;
}

function lookup(query: string, ctx: ResolveContext): Node | undefined {
  const [accessor, params] = query.toLowerCase().split("?");
  const [section, category, selector] = accessor.split(".");

  const map = section === "static"
    ? ctx.scope
    : section === "library"
    ? ctx.store.library.get(category)
    : section === "character"
    ? ctx.store.character.get(category as StoreKey)
    : undefined;

  if (!map) return;
  if (selector) {
    return map.get(selector);
  }

  const values = map.values()
    .filter(applyParams)
    .toArray();

  return { type: "MULTIPLE", values: values as (NodeWithKey | NodeWithName)[] };

  function applyParams(node: Node): boolean {
    if (!params || params.length === 0) return true;
    const paramsSegments = params.split(";");
    const normalizedNode = Object.fromEntries(
      Object.entries(node).map((
        [key, value],
      ) => [key.toLowerCase(), normalizeValue(value)] as const)
        .filter(([_, value]) => value !== undefined),
    );

    for (const segment of paramsSegments) {
      const [category, options] = segment.split("=");
      if (!options) return true;

      const values = options.split("|");
      const nodeValue = normalizedNode[category];

      if (
        Array.isArray(nodeValue) &&
        !values.every((v) => nodeValue.includes(v))
      ) {
        return false;
      } else if (
        !Array.isArray(nodeValue) &&
        (nodeValue === undefined ||
          !values.includes(nodeValue.toString()))
      ) {
        return false;
      }
    }
    return true;
  }
}

type ApplyContext = {
  next: Store["character"];
  path: string;
  className?: string;
  featName?: string;
  subclassName?: string;
};
function apply(node: Node, ctxInput: ApplyContext): void {
  if (node.disabled) return;
  const ctx: ApplyContext = {
    ...ctxInput,
    path: getNodePath(node, ctxInput.path),
  };

  const { next } = ctx;

  switch (node.type) {
    case "PROFICIENCY": {
      const nextProficiencies = next.getOrInsert(node.type, new NodeMap());

      const armor = node.armor ? unwrapDependency(node.armor) : undefined;
      if (armor) apply(armor, ctx);
      const weapon = node.weapon ? unwrapDependency(node.weapon) : undefined;
      if (weapon) apply(weapon, ctx);

      const armorValues = armor ? unwrapChoose(armor).values : [];
      const weaponValues = weapon ? unwrapChoose(weapon).values : [];

      const typeValues = armorValues.concat(weaponValues);

      for (const value of typeValues) {
        if (!is(value, "TYPE")) continue;
        const identifier = `${value.of}.${value.name}`;
        if (!nextProficiencies.has(identifier)) {
          nextProficiencies.set(identifier, value);
        }
      }

      const skill = node.skill ? unwrapDependency(node.skill) : undefined;
      if (skill) apply(skill, ctx);
      const skillValues = skill ? unwrapChoose(skill).values : [];

      const save = node.save ? unwrapDependency(node.save) : undefined;
      if (save) apply(save, ctx);
      const saveValues = save ? unwrapChoose(save).values : [];

      const numberValues = skillValues.concat(saveValues);

      for (const value of numberValues) {
        if (!("name" in value)) continue;
        const identifier = `${value.type.toLowerCase()}.${value.name}@${
          PROFICIENCY_NAME[node.value ?? 1]
        }`;

        if (!nextProficiencies.has(identifier)) {
          nextProficiencies.set(identifier, value);
        }
      }

      return;
    }
    case "MODIFIER": {
      // TODO don't modify node, but push new value to next
      const value = unwrapDependency(node.value);
      const modify = node.modify && isSafeWrite(node.modify)
        ? node.modify
        : undefined;
      const unwrappedModify = modify ? unwrapDependency(modify) : undefined;

      const set = node.set && isSafeWrite(node.set) ? node.set : undefined;
      const unwrappedSet = set ? unwrapDependency(set) : undefined;

      if (!is(value, "LITERAL", "COMPUTED")) return;

      const valueObject: Value = {
        ...value,
        source: ctx.path,
      };

      if (modify && unwrappedModify) {
        const computed: Computed = is(unwrappedModify, "COMPUTED")
          ? unwrappedModify
          : { type: "COMPUTED", modifiers: [] };

        const modifiers = [...computed.modifiers];

        const existingIndex = modifiers.findIndex((element) =>
          element.source === ctx.path
        );

        if (existingIndex !== -1) {
          modifiers[existingIndex] = { ...valueObject };
        } else modifiers.push({ ...valueObject });

        setValue(modify.query, ctx, { ...computed, modifiers });
      }

      if (set && unwrappedSet) {
        const computed: Computed = is(unwrappedSet, "COMPUTED")
          ? unwrappedSet
          : { type: "COMPUTED", modifiers: [] };

        const overwrite = [...computed.overwrite ?? []];

        const existingIndex = overwrite.findIndex((element) =>
          element.source === ctx.path
        );

        if (existingIndex !== -1) {
          overwrite[existingIndex] = { ...valueObject };
        } else overwrite.push({ ...valueObject });

        setValue(set.query, ctx, { ...computed, overwrite });
      }

      return;
    }
    case "MULTIPLE": {
      for (const value of node.values) {
        apply(value, ctx);
      }
      return;
    }
    case "CHOOSE": {
      if (node.selected) apply(node.selected, ctx);
      applyNode(node, ctx);
      return;
    }
    case "OPTIONAL": {
      if (node.active) apply(node.value, ctx);
      applyNode(node, ctx);
      return;
    }
    case "CLASS": {
      applyNode(node, ctx, node.name);
      applyLevels(node.levels, { ...ctx, className: node.name });
      // TODO apply other class properties (asi, ...)
      return;
    }
    case "SUBCLASS": {
      applyLevels(node.levels, { ...ctx, subclassName: node.name });
      return;
    }
    case "FEAT": {
      if (node.levels) {
        applyLevels(node.levels, { ...ctx, featName: node.name });
      }
      if (node.gives) apply(node.gives, { ...ctx, featName: node.name });
      return;
    }
    case "SPELL": {
      if (node.castWithoutSpellSlot) apply(node.castWithoutSpellSlot, ctx);
      applyNode(node, ctx);
      return;
    }
    case "SPELLCASTING": {
      applyNode(node, ctx, ctx.className ?? ctx.featName);
      return;
    }
    case "RESOURCE":
    case "ACTION": {
      applyNode(node, ctx);
      return;
    }
    case "ABILITY": {
      ctx.next.getOrInsert(node.type, new NodeMap()).set(node.name, {
        type: "COMPUTED",
        modifiers: [],
      });
      ctx.next.getOrInsert("save", new NodeMap()).set(node.name, {
        type: "COMPUTED",
        modifiers: [],
      });

      return;
    }
    case "SKILL": {
      ctx.next.getOrInsert(node.type, new NodeMap()).set(node.name, {
        type: "COMPUTED",
        modifiers: [],
      });
      if (node.hasPassive) {
        ctx.next.getOrInsert("passive", new NodeMap()).set(node.name, {
          type: "COMPUTED",
          modifiers: [],
        });
      }
      return;
    }

    case "EMPTY":
    case "LITERAL":
    case "COMPUTED":
    case "ROLL":
    case "DEPENDENCY":
    case "TYPE":
      return;
    case "IMPORT": {
      throw `Unexpected import at: ${ctx.path}`;
    }
  }
}

function applyLevels(levels: Record<string, Node>, ctx: ApplyContext): void {
  for (const [level, value] of Object.entries(levels)) {
    apply(value, { ...ctx, path: `${ctx.path}${PATH_COUNTER}${level}` });
  }
}

function applyNode(node: Node, ctx: ApplyContext, identifer?: string) {
  ctx.next
    .getOrInsert(node.type, new NodeMap())
    .set(identifer ?? ctx.path, node);
}

function setValue(query: string, ctx: ApplyContext, value: Node) {
  const [accessor] = query.toLowerCase().split("?");
  const [section, category, selector] = accessor.split(".");

  if (
    section !== "character" || category === "info" || selector === undefined
  ) return;
  const map = ctx.next
    .getOrInsert(category as StoreKey, new NodeMap());

  // TODO what happens when value already has been changed in
  // this cycle: const existing = map.get(selector);

  map.set(selector, value);
}
