import deepEqual from "deep-equal";

import { CaseInsensitiveMap, NodeMap } from "../../lib/map.ts";
import { getNodePath, PATH_COUNTER } from "../../lib/nodepath.ts";
import {
  add,
  getMultipleKeys,
  getNodeIdentifier,
  is,
  isSafeWrite,
  unwrapChoose,
  unwrapDependency,
  wrapInMultiple,
} from "../../lib/utils.ts";
import {
  EMPTY,
  Node,
  NodeWithKey,
  NodeWithName,
  PROFICIENCY_NAME,
  Store,
  StoreKey,
  Value,
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

  if (deepEqual(tree, nextTree)) {
    return { nextTree, nextState: store };
  }

  const nextState: Store["character"] = new CaseInsensitiveMap(store.character);

  store.character.lock();
  apply(nextTree, {
    path: "ROOT",
    current: store,
    next: nextState,
  });

  if (!store.character.isSameAs(nextState)) {
    return cycle(nextTree, { ...store, character: nextState });
  }

  return { nextTree, nextState: { ...store, character: nextState } };
}

type ResolveContext = {
  store: Store;
  path: string;
  classLevel?: number;
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

      const currentSelectedKeys = current.selected
        ? getMultipleKeys(current.selected)
        : undefined;

      const selected = current && currentSelectedKeys
        ? wrapInMultiple(unwrappedFrom.values
          .filter((v) => currentSelectedKeys.has(getNodeIdentifier(v))))
        : undefined;

      const open = current && currentSelectedKeys
        ? wrapInMultiple(unwrappedFrom.values
          .filter((v) => !currentSelectedKeys.has(getNodeIdentifier(v))))
        : unwrappedFrom;

      return { ...node, selected, open };
    }
    case "OPTIONAL": {
      const current = ctx.store.character
        ?.get("optional")
        ?.getNode(ctx.path, "OPTIONAL");

      const { value, ...rest } = node;

      if (!current || !current.active) {
        return { ...rest } as N;
      }

      return { ...node, value: value ? resolve(value, ctx) : undefined };
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
        levels: resolveLevels(levels, classLevel, { ...ctx, classLevel }),
      };
    }
    case "SUBCLASS": {
      const { levels, ...rest } = node;
      if (ctx.classLevel === undefined) return { ...rest, levels: {} } as N;
      return { ...node, levels: resolveLevels(levels, ctx.classLevel, ctx) };
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
        ? resolveLevels(node.levels, level, ctx)
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

      const ability = node.ability ? resolve(node.ability, ctx) : undefined;

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
      if (parseInt(level) > currentLevel) return;
      return [
        level,
        resolve(node, { ...ctx, path: `${ctx.path}${PATH_COUNTER}${level}` }),
      ];
    }).filter((v) => v !== undefined);

  return Object.fromEntries(result);
}

function createScope(
  node: Node,
  ctx: ResolveContext,
): NodeMap {
  if (!("static" in node) || node.static !== undefined) return ctx.scope;

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
      ) => {
        if (
          typeof value === "string" || typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return [key.toLowerCase(), value.toString().toLowerCase()];
        }
      }).filter((v) => v !== undefined),
    );

    for (const segment of paramsSegments) {
      const [category, options] = segment.split("=");
      if (!options) return true;

      const values = options.split("|");
      const nodeValue = normalizedNode[category];

      if (nodeValue === undefined || !values.includes(nodeValue.toString())) {
        return false;
      }
    }
    return true;
  }
}

type ApplyContext = {
  current: Store;
  next: Store["character"];
  path: string;
};
function apply(node: Node, ctxInput: ApplyContext): void {
  const ctx: ApplyContext = {
    ...ctxInput,
    path: getNodePath(node, ctxInput.path),
  };

  switch (node.type) {
    case "PROFICIENCY": {
      const proficiencies = ctx.next.getOrInsert(node.type, new NodeMap());

      const armor = node.armor ? unwrapDependency(node.armor) : undefined;
      const weapon = node.weapon ? unwrapDependency(node.weapon) : undefined;

      const armorValues = armor ? unwrapChoose(armor).values : [];
      const weaponValues = weapon ? unwrapChoose(weapon).values : [];

      const typeValues = armorValues.concat(weaponValues);

      for (const value of typeValues) {
        if (!is(value, "TYPE")) continue;
        const identifier = `${value.of}.${value.name}`;
        if (!proficiencies.has(identifier)) {
          proficiencies.set(identifier, value);
        }
      }

      const skill = node.skill ? unwrapDependency(node.skill) : undefined;
      const skillValues = skill ? unwrapChoose(skill).values : [];

      const save = node.save ? unwrapDependency(node.save) : undefined;
      const saveValues = save ? unwrapChoose(save).values : [];

      const numberValues = skillValues.concat(saveValues);

      for (const value of numberValues) {
        if (!("name" in value)) continue;
        const identifier = `${value.type.toLowerCase()}.${value.name}@${
          PROFICIENCY_NAME[node.value ?? 1]
        }`;

        if (!proficiencies.has(identifier)) {
          proficiencies.set(identifier, value);
        }
      }

      return;
    }
    case "MODIFIER": {
      const value = unwrapDependency(node.value);
      const modify = node.modify && isSafeWrite(node.modify)
        ? unwrapDependency(node.modify)
        : undefined;
      const set = node.set && isSafeWrite(node.set)
        ? unwrapDependency(node.set)
        : undefined;

      if (!is(value, "LITERAL", "COMPUTED")) return;

      const valueObject: Value = {
        ...value,
        source: ctx.path,
      };

      if (modify && is(modify, "COMPUTED")) {
        const existingIndex = modify.modifiers.findIndex((element) =>
          element.source === ctx.path
        );

        if (existingIndex !== -1) {
          modify.modifiers[existingIndex] = { ...valueObject };
        } else modify.modifiers.push({ ...valueObject });
      }

      if (set && is(set, "COMPUTED")) {
        if (!set.overwrite) set.overwrite = [];
        const existingIndex = set.overwrite.findIndex((element) =>
          element.source === ctx.path
        );

        if (existingIndex !== -1) {
          set.overwrite[existingIndex] = { ...valueObject };
        } else set.overwrite.push({ ...valueObject });
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
      if (node.value) apply(node.value, ctx);
      applyNode(node, ctx);
      return;
    }
    case "CLASS": {
      applyLevels(node.levels, ctx);
      // TODO apply other class properties (asi, ...)
      return;
    }
    case "SUBCLASS": {
      applyLevels(node.levels, ctx);
      return;
    }
    case "FEAT": {
      if (node.levels) applyLevels(node.levels, ctx);
      if (node.gives) apply(node.gives, ctx);
      return;
    }
    case "SPELLCASTING":
    case "RESOURCE":
    case "ACTION":
    case "SPELL": {
      applyNode(node, ctx);
      return;
    }

    case "EMPTY":
    case "LITERAL":
    case "COMPUTED":
    case "ROLL":
    case "DEPENDENCY":
    case "TYPE":
    case "SKILL":
    case "ABILITY":
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

function applyNode(node: Node, ctx: ApplyContext) {
  const current = ctx.next.get(node.type);

  if (!current) {
    ctx.next.set(node.type, new NodeMap([[ctx.path, node]]));
    return;
  }

  const currentNode = current.getNode(ctx.path, node.type);
  if (deepEqual(currentNode, node)) return;
  if (!currentNode) {
    ctx.next.getOrInsert(node.type, new NodeMap()).set(ctx.path, node);
    return;
  }

  const merged = merge(currentNode, node);
  if (deepEqual(currentNode, merged)) return;
  ctx.next.getOrInsert(node.type, new NodeMap()).set(ctx.path, merged);
}

function merge<N extends Node>(current: N, next: N): N {
  switch (current.type) {
    case "OPTIONAL": {
      return { ...current, ...next };
    }
    case "CHOOSE": {
      return { ...current, ...next };
    }

    case "EMPTY":
    case "CLASS":
    case "SUBCLASS":
    case "FEAT":
    case "ACTION":
    case "SPELL":
    case "RESOURCE":
    case "ABILITY":
    case "SKILL":
    case "TYPE":
    case "IMPORT":
    case "MULTIPLE":
    case "DEPENDENCY":
    case "ROLL":
    case "LITERAL":
    case "COMPUTED":
    case "PROFICIENCY":
    case "MODIFIER":
    case "SPELLCASTING":
      console.log(`TODO: Merge ${current.type}`);
      return { ...current, ...next };
  }
}
