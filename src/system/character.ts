import { CaseInsensitiveMap, NodeMap } from "../lib/map.ts";
import {
  assert,
  getMultipleKeys,
  getNodeIdentifier,
  getResource,
  is,
  unwrapDependency,
  wrapInMultiple,
} from "../lib/node.ts";
import { CaseInsensitiveSet } from "../lib/set.ts";
import {
  add,
  arrayCount,
  getModifier,
  getProficiency,
  getProficiencyBonus,
} from "../lib/utils.ts";
import { resolveValue } from "../lib/value.ts";
import type { Library } from "./library.ts";
import { cycle } from "./tree/resolve.ts";
import type {
  Class,
  Modifier,
  Multiple,
  Node,
  Spellcasting,
  Store,
  Type,
  Value,
} from "./tree/types.ts";
import { ZERO } from "./tree/types.ts";
import {
  type SerializedCharacter,
  SerializedCharacterSchema,
} from "./tree/validate.ts";

type Config = {
  tree?: Multiple;
  info?: Record<string, Node>;
};

export class Character {
  #store: Store;
  #tree: Multiple;

  #abilityBase = new CaseInsensitiveMap<string, number>();

  constructor(library: Library, { tree, info }: Config = {}) {
    this.#store = {
      library,
      character: new CaseInsensitiveMap(),
    };

    this.#tree = tree ?? { type: "MULTIPLE", values: [] };

    if (info) {
      this.#store.character.set("info", new NodeMap(Object.entries(info)));
    }

    this.update();
  }

  public addClass(className: string): this {
    const classValue = this.#store.library
      ?.get("class")
      ?.getNode(className, "CLASS");

    if (
      !classValue ||
      this.#tree.values.some((v) =>
        v.type === "CLASS" && v.name.toLowerCase() === className.toLowerCase()
      )
    ) return this;

    this.#tree.values.push({ ...classValue, level: 1 });

    this.update();
    return this;
  }

  public setClassLevel(className: string, level: number): this {
    if (level < 1 || level > 20 || !Number.isInteger(level)) return this;

    const classNode = this.#tree.values.find((n) =>
      n.type === "CLASS" && n.name.toLowerCase() === className.toLowerCase()
    ) as Class | undefined;

    if (!classNode) return this;

    const levels = this.#store.library
      .getOrThrow("class")
      .getNode(className, "CLASS")!
      .levels;

    classNode.level = level;
    classNode.levels = { ...levels, ...classNode.levels };

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

    const characterLevel = this.#store.character
      ?.get("info")
      ?.getNode("characterLevel", "LITERAL")
      ?.value as number | undefined;

    const additionalAtClassLevel =
      choice.chooseAdditionalAt?.classLevel && choice.classLevel
        ? arrayCount(
          choice.chooseAdditionalAt.classLevel,
          (l) => l <= (choice.classLevel ?? 0),
        )
        : 0;

    const additionalAtLevel = choice.chooseAdditionalAt?.level && characterLevel
      ? arrayCount(
        choice.chooseAdditionalAt.level,
        (l) => l <= characterLevel,
      )
      : 0;

    const maxCount = resolveValue(choice.count) as number +
      additionalAtClassLevel + additionalAtLevel;

    if (selectedKeys.has(key)) {
      selectedKeys.delete(key);
      openKeys.add(key);
    } else if (selectedKeys.size < maxCount) {
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

  private getClassLevels() {
    const character = this.#store.character;
    const classes = character.get("class");

    const classLevels = new CaseInsensitiveMap(
      classes
        ?.entries()
        .map((
          [name, value],
        ) => [name, (value.type === "CLASS" ? value.level : 0) ?? 0]),
    );

    return classLevels;
  }

  private getProficiencyBonus() {
    const character = this.#store.character;
    return character
      .getOrInsert("info", new NodeMap())
      .getNode("proficiency_bonus", "LITERAL")?.value as number ?? 0;
  }

  private getAbilities() {
    const character = this.#store.character;
    return new CaseInsensitiveMap(
      character
        .get("ability")
        ?.entries()
        .map((
          [name, value],
        ) => [name, resolveValue(value as Value) as number | undefined ?? 0]),
    );
  }

  private getSkills() {
    const character = this.#store.character;
    const abilities = this.getAbilities();
    const proficiencyBonus = this.getProficiencyBonus();

    return new CaseInsensitiveMap(
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
  }

  public get name(): string | undefined {
    return this.#store.character.get("info")?.getNode("name", "LITERAL")
      ?.value as string;
  }

  public get classes(): CaseInsensitiveMap<string, number> {
    this.update();
    return this.getClassLevels();
  }

  public get level(): number {
    this.update();
    const classLevels = this.getClassLevels();
    return classLevels.size > 0 ? classLevels.values().reduce(add) : 0;
  }

  public get abilities(): CaseInsensitiveMap<string, number> {
    this.update();
    return this.getAbilities();
  }

  public get saves(): CaseInsensitiveMap<string, number> {
    this.update();
    const character = this.#store.character;
    const abilities = this.getAbilities();
    const proficiencyBonus = this.getProficiencyBonus();

    return new CaseInsensitiveMap(
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
  }

  public get skills(): CaseInsensitiveMap<string, number> {
    this.update();
    return this.getSkills();
  }

  public get passives(): CaseInsensitiveMap<string, number> {
    this.update();
    const character = this.#store.character;
    const skills = this.getSkills();
    return new CaseInsensitiveMap(
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
  }

  public get choices(): CaseInsensitiveMap<
    string,
    { count: number; selected: string[]; open: string[] }
  > {
    this.update();
    const character = this.#store.character;
    return new CaseInsensitiveMap(
      character
        .get("choose")
        ?.entries()
        .map(([path, choice]) => {
          assert(choice, "CHOOSE");

          const selected = choice.selected
            ? Array.from(getMultipleKeys(choice.selected))
            : [];

          const open = choice.open
            ? Array.from(getMultipleKeys(choice.open))
            : [];

          return [path, {
            count: resolveValue(choice.count) as number,
            selected,
            open,
          }];
        }),
    );
  }

  public get options(): CaseInsensitiveMap<
    string,
    { name: string; active: boolean }
  > {
    this.update();
    const character = this.#store.character;
    return new CaseInsensitiveMap(
      character
        .get("optional")
        ?.entries()
        .map(([path, choice]) => {
          assert(choice, "OPTIONAL");

          const name = choice.name ? choice.name : choice.key ?? path;

          return [path, { name, active: choice.active ?? false }];
        }),
    );
  }

  public get proficiencies(): {
    armor: string[];
    weapon: string[];
    language: string[];
    tool: string[];
  } {
    this.update();
    const proficiencies = this.#store.character.get("proficiency");
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

    return {
      armor: armorProfs,
      weapon: weaponProfs,
      language: languageProfs,
      tool: toolProfs,
    };
  }

  public get spellcasting():
    | CaseInsensitiveMap<string, {
      ability: string;
      table: Spellcasting["table"];
    }>
    | undefined {
    this.update();
    const character = this.#store.character;
    return character.has("spellcasting")
      ? new CaseInsensitiveMap(
        character
          .get("spellcasting")
          ?.entries()
          .map(([className, value]) => {
            assert(value, "SPELLCASTING");
            const unwrapped = unwrapDependency(value.ability);
            assert(unwrapped, "ABILITY");

            return [className, {
              ability: unwrapped.name,
              table: value.table,
            }];
          }),
      )
      : undefined;
  }

  public get spells() {
    this.update();
    const character = this.#store.character;
    return new CaseInsensitiveMap(
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
  }

  public get actions(): NodeMap | undefined {
    this.update();
    return this.#store.character.get("action");
  }

  public get resources(): CaseInsensitiveMap<string, {
    readonly uses: number;
    readonly spent: number;
    readonly resetTrigger: string;
  }> {
    this.update();
    const character = this.#store.character;
    return new CaseInsensitiveMap(
      character.get("resource")
        ?.values()
        .map(getResource)
        .filter((v) => v !== undefined),
    );
  }

  public get stats(): CaseInsensitiveMap<string, number> {
    this.update();
    const character = this.#store.character;

    const map = new CaseInsensitiveMap(
      character
        .get("stats")
        ?.entries()
        .map(([key, value]) => {
          if (!is(value, "COMPUTED", "LITERAL")) return;
          return [key, resolveValue(value) as number] as const;
        })
        .filter((v) => v !== undefined),
    );

    map.set("proficiencyBonus", this.getProficiencyBonus());

    return map;
  }

  public get tree(): Node {
    return this.#tree;
  }

  private update() {
    //const { character, library } = this.#store;

    /* const abilities = library.get("ability");

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
      ],
    } as Multiple; */

    const { library } = this.#store;
    const abilities = library.get("ability")
      ?.values()
      .filter((a) =>
        !(a.type === "ABILITY" &&
          this.#tree.values.some((v) =>
            v.type === "ABILITY" && v.name === a.name
          ))
      );
    const skills = library.get("skill")
      ?.values()
      .filter((a) =>
        !(a.type === "SKILL" &&
          this.#tree.values.some((v) =>
            v.type === "SKILL" && v.name === a.name
          ))
      );

    const tree: Multiple = {
      type: "MULTIPLE",
      values: [
        ...this.#tree.values,
        ...(abilities?.toArray() ?? []),
        ...(skills?.toArray() ?? []),
      ],
    };

    const { nextState, nextTree } = cycle(tree, this.#store);

    this.#store = nextState;
    this.#tree = nextTree;
  }

  public getSerializeable(): SerializedCharacter {
    const tree = this.#tree;
    const info = this.#store.character.get("info")?.toRecord();
    return { tree, info };
  }

  static fromSerializable(
    library: Library,
    input: unknown,
  ): Character | undefined {
    const { data } = SerializedCharacterSchema.safeParse(input);
    if (!data) return;
    return new Character(library, { ...data });
  }
}
