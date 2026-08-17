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
  choiceDelete: boolean;
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

          assert(unwrapped, ctx.nodePath, "COMPUTED", "MULTIPLE");

          if (is(unwrapped, "COMPUTED")) applyComputed(unwrapped, "overwrite");
          else {
            unwrapped.values
              .filter((v) => is(v, "COMPUTED"))
              .forEach((v) => applyComputed(v, "overwrite"));
          }
        }

        if (modify && !is(modify, "EMPTY")) {
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
        const result = lookup(ctx.store, node.query, ctx) ?? EMPTY;
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

        const effect = parse(node.effect, { ...ctx, apply: false });

        if (ctx.apply) actions.set(ctx.nodePath, { ...node, effect });

        return {
          ...node,
          effect,
        };
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
          .getOrInsert("resources", new NodeMap());

        if (!resources.has(ctx.nodePath)) {
          resources.set(ctx.nodePath, {
            ...node,
            spent: { type: "LITERAL", value: 0 },
          });
        } else {
          const current = resources.getNode(ctx.nodePath, "RESOURCE")!;
          resources.set(ctx.nodePath, { ...node, spent: current.spent });
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
        }),
      ])
      .filter(([level]) => parseInt(level as string) <= currentLevel);
    return Object.fromEntries(result);
  }
}
