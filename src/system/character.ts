import { CaseInsensitiveMap, NodeMap } from "../lib/map.ts";
import { CaseInsensitiveSet } from "../lib/set.ts";
import {
  add,
  assert,
  getModifier,
  getMultipleKeys,
  getNodeIdentifier,
  getProficiency,
  getProficiencyBonus,
  getResource,
  is,
  resolveValue,
  unwrapDependency,
  wrapInMultiple,
} from "../lib/utils.ts";
import { Library } from "./library.ts";
import { cycle } from "./tree/resolve.ts";
import { Modifier, Node, Store, Type, Value, ZERO } from "./tree/types.ts";

export class Character {
  #store: Store;
  #tree?: Node;

  #abilityBase = new CaseInsensitiveMap<string, number>();

  constructor(library: Library) {
    this.#store = {
      library,
      character: new CaseInsensitiveMap(),
    };
  }

  public addClass(className: string): this {
    const classValue = this.#store.library
      ?.get("class")
      ?.getNode(className, "CLASS");

    if (
      !classValue ||
      this.#store.character
        .getOrInsert("class", new NodeMap())
        .has(className)
    ) return this;

    const classes = this.#store.character
      .getOrInsert("class", new NodeMap());

    classes.set(
      className,
      { ...classValue, level: 1 },
    );

    this.update();
    return this;
  }

  public setClassLevel(className: string, level: number): this {
    if (level < 1 || level > 20 || !Number.isInteger(level)) return this;

    const classes = this.#store.character.get("class");

    if (!classes) return this;

    const classValue = classes.getNode(className, "CLASS");
    if (!classValue) return this;

    const levels = this.#store.library
      .getOrThrow("class")
      .getNode(className, "CLASS")!
      .levels;
    classes.set(className, {
      ...classValue,
      level,
      levels: { ...levels, ...classValue.levels },
    });

    this.update();
    return this;
  }

  public setChoice(identifier: string, key: string): this {
    const choices = this.#store.character.get("choose");

    if (!choices) return this;

    const choice = choices.getNode(identifier, "CHOOSE");
    if (!choice) return this;

    const unwrappedFrom = unwrapDependency(choice.from);

    const selectedKeys = choice.selected
      ? getMultipleKeys(choice.selected)
      : new CaseInsensitiveSet();

    const openKeys = choice.open
      ? getMultipleKeys(choice.open)
      : is(unwrappedFrom, "MULTIPLE")
      ? getMultipleKeys(unwrappedFrom)
      : new CaseInsensitiveSet();

    if (selectedKeys.has(key)) {
      selectedKeys.delete(key);
      openKeys.add(key);
    } else if (selectedKeys.size < (resolveValue(choice.count) as number)) {
      selectedKeys.add(key);
      openKeys.delete(key);
    }

    const selected = wrapInMultiple(
      is(unwrappedFrom, "MULTIPLE")
        ? unwrappedFrom.values
          .filter((v) => selectedKeys.has(getNodeIdentifier(v) ?? ""))
        : undefined,
    );

    const open = wrapInMultiple(
      is(unwrappedFrom, "MULTIPLE")
        ? unwrappedFrom.values
          .filter((v) => !selectedKeys.has(getNodeIdentifier(v) ?? ""))
        : undefined,
    );

    choices.set(identifier, {
      ...choice,
      selected,
      open,
    });

    this.update();
    return this;
  }

  public setOption(identifier: string, active: boolean): this {
    const options = this.#store.character
      .get("optional");

    if (!options) return this;
    const option = options.getNode(identifier, "OPTIONAL");

    if (!option) return this;

    options.set(identifier, { ...option, active });
    this.update();
    return this;
  }

  public setName(name: string): this {
    this.#store.character
      .getOrInsert("info", new NodeMap())
      .set("name", { type: "LITERAL", value: name });

    this.update();
    return this;
  }

  public setAbilityBase(name: string, value: number): this {
    const ability = this.#store.character
      .get("ability")
      ?.get(name);

    if (!ability) return this;

    this.#abilityBase.set(name, value);

    this.update();
    return this;
  }

  public useResource(name: string): this {
    const resources = this.#store.character.get("resource");
    if (!resources) return this;
    const resource = resources.getNode(name, "RESOURCE");

    if (!resource) return this;

    const usesNode = unwrapDependency(resource.uses);
    if (!is(usesNode, "LITERAL", "COMPUTED")) return this;

    const uses = resolveValue(usesNode) as number;
    const spent = resource.spent ? resolveValue(resource.spent) as number : 0;

    if (spent < uses) {
      resources.set(name, {
        ...resource,
        spent: { type: "LITERAL", value: spent + 1 },
      });
    }

    this.update();
    return this;
  }

  public trigger(identifier: string): this {
    const resources = this.#store.character.get("resource");
    if (!resources) return this;

    for (const [key, resource] of resources) {
      if (!is(resource, "RESOURCE")) continue;

      if (identifier.toLowerCase() === resource.resetTrigger.toLowerCase()) {
        resources.set(key, { ...resource, spent: ZERO });
      }
    }

    this.update();
    return this;
  }

  public get() {
    this.update();

    const character = this.#store.character;
    const classes = character.get("class");

    const classLevels = new CaseInsensitiveMap(
      classes
        ?.entries()
        .map((
          [name, value],
        ) => [name, (value.type === "CLASS" ? value.level : 0) ?? 0]),
    );

    const level = classLevels.size > 0 ? classLevels.values().reduce(add) : 0;

    const proficiencyBonus = character
      .getOrInsert("info", new NodeMap())
      .getNode("proficiency_bonus", "LITERAL")?.value as number ?? 0;

    const proficiencies = character.get("proficiency");

    const abilities = new CaseInsensitiveMap(
      character
        .get("ability")
        ?.entries()
        .map((
          [name, value],
        ) => [name, resolveValue(value as Value) as number | undefined ?? 0]),
    );

    const saves = new CaseInsensitiveMap(
      character
        .get("save")
        ?.entries()
        .map(([name, value]) => {
          const modifier = getModifier(abilities.getOrThrow(name));
          const bonus = resolveValue(value as Value) as number ?? 0;

          const prof = getProficiency(this.#store, "ability", name) *
            proficiencyBonus;

          if (
            "overwrite" in value && value.overwrite &&
            value.overwrite.length > 0
          ) {
            return [name, bonus];
          }

          return [name, modifier + bonus + prof];
        }),
    );

    const skills = new CaseInsensitiveMap(
      character
        .get("skill")
        ?.entries()
        .map(([name, value]) => {
          const libSkill = this.#store.library
            .getOrThrow("skill")
            .getNode(name, "SKILL")!;

          const modifier = getModifier(abilities.getOrThrow(libSkill.ability));
          const bonus = resolveValue(value as Value) as number ?? 0;
          const prof = getProficiency(this.#store, "skill", name) *
            proficiencyBonus;

          if (
            "overwrite" in value && value.overwrite &&
            value.overwrite.length > 0
          ) {
            return [name, bonus];
          }

          return [name, modifier + bonus + prof];
        }),
    );

    const passives = new CaseInsensitiveMap(
      character
        .get("passive")
        ?.entries()
        .map(([name, value]) => {
          const modifier = skills.getOrThrow(name);
          const bonus = resolveValue(value as Value) as number ?? 0;

          if (
            "overwrite" in value && value.overwrite &&
            value.overwrite.length > 0
          ) {
            return [name, bonus];
          }

          return [name, modifier + bonus];
        }),
    );

    const choices = new CaseInsensitiveMap(
      character
        .get("choose")
        ?.entries()
        .map(([path, choice]) => {
          assert(choice, "CHARACTER_GET", "CHOOSE");

          const selected = choice.selected
            ? Array.from(getMultipleKeys(choice.selected))
            : [];

          const open = choice.open
            ? Array.from(getMultipleKeys(choice.open))
            : [];

          return [path, { count: resolveValue(choice.count), selected, open }];
        }),
    );

    const options = new CaseInsensitiveMap(
      character
        .get("optional")
        ?.entries()
        .map(([path, choice]) => {
          assert(choice, "CHARACTER_GET", "OPTIONAL");

          const name = "name" in choice ? choice.name : choice.key ?? path;

          return [path, { name, active: choice.active ?? false }];
        }),
    );

    const armorProfs = proficiencies
      ? proficiencies
        .values()
        .filter((v) => v.type === "TYPE" && v.of.toLowerCase() === "armor")
        .map((v) => (v as Type).name)
        .toArray()
      : [];

    const weaponProfs = proficiencies
      ? proficiencies
        .values()
        .filter((v) => v.type === "TYPE" && v.of.toLowerCase() === "weapon")
        .map((v) => (v as Type).name)
        .toArray()
      : [];

    const languageProfs = proficiencies
      ? proficiencies
        .values()
        .filter((v) => v.type === "TYPE" && v.of.toLowerCase() === "language")
        .map((v) => (v as Type).name)
        .toArray()
      : [];

    const toolProfs = proficiencies
      ? proficiencies
        .values()
        .filter((v) => v.type === "TYPE" && v.of.toLowerCase() === "tool")
        .map((v) => (v as Type).name)
        .toArray()
      : [];

    const spellcasting = character.has("spellcasting")
      ? new CaseInsensitiveMap(
        character
          .get("spellcasting")
          ?.entries()
          .map(([className, value]) => {
            assert(value, "CHARACTER_GET", "SPELLCASTING");
            const unwrapped = unwrapDependency(value.ability);
            assert(unwrapped, "CHARACTER_GET", "ABILITY");

            return [className, {
              ability: unwrapped.name,
              table: value.table,
            }];
          }),
      )
      : undefined;

    const spells = new CaseInsensitiveMap(
      character.get("spell")?.values()
        .map((value) => {
          if (!is(value, "SPELL")) return;

          const resource = value.castWithoutSpellSlot
            ? getResource(value.castWithoutSpellSlot)
            : undefined;

          const ability = value.ability
            ? unwrapDependency(value.ability)
            : undefined;

          return [value.name, {
            ...value,
            castWithoutSpellSlot: resource ? resource[1] : undefined,
            ability: ability && is(ability, "ABILITY")
              ? ability.name
              : undefined,
          }] as const;
        }).filter((v) => v !== undefined),
    );

    const actions = character.get("action");

    const resources = new CaseInsensitiveMap(
      character.get("resource")
        ?.values()
        .map(getResource)
        .filter((v) => v !== undefined),
    );

    const stats = new CaseInsensitiveMap(
      character
        .get("stats")
        ?.entries()
        .map(([key, value]) => {
          if (!is(value, "COMPUTED", "LITERAL")) return;
          return [key, resolveValue(value) as number] as const;
        })
        .filter((v) => v !== undefined),
    );

    return {
      name: character
        .get("info")
        ?.getNode("name", "LITERAL")
        ?.value,
      level,
      classes: classLevels,
      proficiencyBonus,
      abilities,
      saves,
      skills,
      passives,
      proficiencies: {
        armor: armorProfs,
        weapon: weaponProfs,
        language: languageProfs,
        tool: toolProfs,
      },
      stats,
      spellcasting,
      spells,
      actions,
      resources,
      tree: this.#tree,
      choices,
      options,
    };
  }

  private update() {
    const { character, library } = this.#store;

    const abilities = library.get("ability");

    const skills = library.get("skill");

    const classes = character.get("class");

    const characterLevel = classes
      ? classes
        .values()
        .map((c) => c.type === "CLASS" ? c.level ?? 0 : 0)
        .reduce(add)
      : 0;

    character.getOrInsert("info", new NodeMap()).set("characterlevel", {
      type: "LITERAL",
      value: characterLevel,
    });

    character.getOrInsert("info", new NodeMap()).set("proficiency_bonus", {
      type: "LITERAL",
      value: getProficiencyBonus(characterLevel),
    });

    const abilityBases: Modifier[] = this.#abilityBase
      .entries()
      .map(([ability, value]) => ({
        type: "MODIFIER",
        value: { type: "LITERAL", value },
        modify: {
          type: "DEPENDENCY",
          query: `character.ability.${ability}`,
        },
      } as const))
      .toArray();

    const tree = {
      type: "MULTIPLE",
      values: [
        ...(abilities?.values().toArray() ?? []),
        ...abilityBases,
        ...(skills?.values().toArray() ?? []),
        ...(classes?.values().toArray() ?? []),
      ],
    } as Node;

    const { nextState, nextTree } = cycle(tree, this.#store);

    this.#store = nextState;
    this.#tree = nextTree;
  }
}
