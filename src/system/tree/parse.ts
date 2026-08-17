import { NodeMap } from "../../lib/map.ts";
import { getNodePath, PATH_COUNTER } from "../../lib/nodepath.ts";
import {
  assert,
  expect,
  hasKeyOrValue,
  is,
  log,
  unwrapDependency,
} from "../../lib/utils.ts";
import { lookup } from "./lookup.ts";
import {
  Choose,
  Computed,
  EMPTY,
  Multiple,
  Node,
  NodeWithKey,
  NodeWithName,
  Optional,
  ProficiencyValue,
  Resource,
  Spell,
  Store,
  Type,
} from "./types.ts";

export type ParseCtx = {
  nodePath: string;
  store: Store;
  classLevel?: number;
  className?: string;
  apply: boolean;
  delete: boolean;
  log: boolean;
};

export function parse(
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
        assert(value, ctx.nodePath, "COMPUTED", "LITERAL", "ROLL");

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
            computed[key][existingIndex] = { ...valueObject };
          } else computed[key].push({ ...valueObject });
        };

        if (set && !is(set, "EMPTY")) {
          const unwrapped = unwrapDependency(set);

          if (is(unwrapped, "COMPUTED")) applyComputed(unwrapped, "overwrite");
          else if (is(unwrapped, "MULTIPLE")) {
            unwrapped.values
              .filter((v) => is(v, "COMPUTED"))
              .forEach((v) => applyComputed(v, "overwrite"));
          }
        }

        if (modify && !is(modify, "EMPTY")) {
          const unwrapped = unwrapDependency(modify);

          if (is(unwrapped, "COMPUTED")) applyComputed(unwrapped, "modifiers");
          else if (is(unwrapped, "MULTIPLE")) {
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
        const key = node.key ?? node.query;
        const result = lookup(ctx.store, node.query, ctx);
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
            classLevel: level,
          }),
        };
      }
      case "CHOOSE": {
        const from = parse(node.from, {
          ...ctx,
          apply: false,
          delete: false,
        });

        const unwrapped = unwrapDependency(from);

        assert(unwrapped, ctx.nodePath, "MULTIPLE");

        const choices = ctx.store
          .getOrThrow("character")
          .getOrThrow("choices");

        if (!ctx.apply && ctx.delete) {
          choices.delete(ctx.nodePath);
          parse(node.from, { ...ctx, apply: false, delete: true });
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
          delete: false,
        });

        const options = ctx.store
          .getOrThrow("character")
          .getOrThrow("options");

        if (!ctx.apply && ctx.delete && options.has(ctx.nodePath)) {
          options.delete(ctx.nodePath);
          parse(node.value, { ...ctx, apply: false, delete: true });
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

        const castWithoutSpellSlot = node.castWithoutSpellSlot
          ? parse(node.castWithoutSpellSlot, ctx) as Resource
          : undefined;

        spell.castWithoutSpellSlot = castWithoutSpellSlot ??
          spell.castWithoutSpellSlot;

        spell.alwaysPrepared = node.alwaysPrepared || spell.alwaysPrepared;

        spell.upcast = node.upcast || spell.upcast;

        const ability = node.ability
          ? parse(node.ability, ctx)
          : ctx.className
          ? ctx.store
            .getOrThrow("character")
            .get("spellcasting")
            ?.getNode(ctx.className, "SPELLCASTING")
            ?.ability
          : undefined;

        if (
          !ability ||
          !expect(unwrapDependency(ability), { path: ctx.nodePath }, "ABILITY")
        ) {
          return node;
        }

        spell.ability = unwrapDependency(ability);

        return { ...node, ability };
      }

      case "SUBCLASS": {
        if (!ctx.classLevel) return node;

        return {
          ...node,
          levels: parseLevels(node.levels, ctx.classLevel, ctx),
        };
      }

      case "ACTION": {
        const actions = ctx.store
          .getOrThrow("character")
          .getOrInsert("actions", new NodeMap());

        if (ctx.apply) actions.set(ctx.nodePath, { ...node });
        else actions.delete(ctx.nodePath);

        return { ...node };
      }

      case "ROLL": {
        const diceType = parse(node.diceType, { ...ctx, apply: false });
        const diceCount = parse(node.diceCount, { ...ctx, apply: false });
        const minimum = parse(node.minimum, { ...ctx, apply: false });
        const modifier = parse(node.modifier, { ...ctx, apply: false });

        return { ...node, diceType, diceCount, modifier, minimum };
      }
      case "RESOURCE": {
        const uses = parse(node.uses, ctx);

        const resources = ctx.store
          .getOrThrow("character")
          .getOrThrow("resources");

        if (!ctx.apply && ctx.delete) {
          resources.delete(node.name);
          return { ...node, uses };
        }

        if (!resources.has(node.name)) {
          resources.set(node.name, {
            ...node,
            spent: { type: "LITERAL", value: 0 },
          });
        } else {
          const current = resources.getNode(node.name, "RESOURCE")!;
          resources.set(node.name, { ...node, spent: current.spent });
        }

        return { ...node, uses };
      }

      case "COMPUTED":
      case "ABILITY":
      case "EMPTY":
      case "LITERAL":
      case "SKILL":
      case "TYPE":
        return node;
      case "IMPORT": {
        throw `Unexpected import at: ${ctx.nodePath}`;
      }
      default: {
        const unhandled = node as Node;
        log(unhandled.type, ctx.log);
        return unhandled;
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
          delete: parseInt(level) > currentLevel ? true : ctx.delete,
        }),
      ])
      .filter(([level]) => parseInt(level as string) <= currentLevel);
    return Object.fromEntries(result);
  }
}
