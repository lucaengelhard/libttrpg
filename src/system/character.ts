import { CaseInsensitiveMap, NodeMap } from "../lib/map.ts";
import {
  assert,
  getModifier,
  getProficiency,
  getProficiencyBonus,
  resolveValue,
} from "../lib/utils.ts";
import { Class, Computed, iterate, Node, Store, Type, Value } from "./tree.ts";
import { Library } from "./library.ts";

export class Character {
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
          ["choices", new NodeMap()],
          ["options", new NodeMap()],
          ["proficiencies", new NodeMap()],
        ]),
      ],
    ]);
  }

  public addClass(className: string): this {
    const classValue = this.#store.get("library")?.get("class")?.get(className);
    if (
      !classValue ||
      this.#store.get("character")!.getOrInsert(
        "classes",
        new NodeMap(),
      ).has(className)
    ) return this;

    const classes = this.#store
      .get("character")!
      .getOrInsert("classes", new NodeMap());

    classes.set(className, { ...classValue, level: 1 } as Class);
    this.applyTree();
    return this;
  }

  public setClassLevel(className: string, level: number): this {
    if (level < 1 || level > 20 || !Number.isInteger(level)) return this;

    const classes = this.#store
      .getOrThrow("character")
      .get("classes");

    if (!classes) return this;

    const classValue = classes
      .getNode(className, "CLASS");
    if (!classValue) return this;

    classes.set(className, { ...classValue, level });

    this.applyTree();
    return this;
  }

  public setChoice(identifier: string, key: string): this {
    const choice = this.#store
      .getOrThrow("character")
      .getOrThrow("choices")
      .getNode(identifier, "CHOOSE");

    if (!choice) return this;

    const selected = choice.slectedKeys!;
    const open = choice.openKeys!;

    if (selected.has(key)) {
      selected.delete(key);
      open.add(key);
      this.applyTree();
      return this;
    }

    if (
      !open.has(key) || selected.size >= (resolveValue(choice.count) as number)
    ) {
      return this;
    }
    selected.add(key);
    open.delete(key);
    this.applyTree();
    return this;
  }

  public setOption(identifier: string, active: boolean): this {
    const option = this.#store
      .getOrThrow("character")
      .getOrThrow("options")
      .getNode(identifier, "OPTIONAL");

    if (!option) return this;

    option.active = active;
    this.applyTree();
    return this;
  }

  public setName(name: string): this {
    this.#store
      .getOrThrow("character")
      .getOrThrow("info")
      .set("name", { type: "LITERAL", value: name });
    this.applyTree();
    return this;
  }

  public setAbilityBase(name: string, value: number): this {
    const ability = this.#store
      .getOrThrow("character")
      .getOrThrow("abilities")
      .get(name) as Computed | undefined;
    if (!ability) return this;

    ability.base = { type: "LITERAL", value };
    this.applyTree();
    return this;
  }

  public get() {
    const { result } = this.applyTree();

    const character = this.#store.getOrThrow("character");
    const classes = character
      .get("classes");

    const classLevels = new CaseInsensitiveMap(
      classes
        ?.entries()
        .map((
          [name, value],
        ) => [name, (value.type === "CLASS" ? value.level : 0) ?? 0]),
    );

    const characterLevel = classLevels.size > 0
      ? classLevels.values().reduce((acc, curr) => acc + curr)
      : 0;

    const proficiencyBonus = getProficiencyBonus(characterLevel);

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
          const prof = value.type === "COMPUTED" && value.proficiency
            ? getProficiency(value.proficiency) * proficiencyBonus
            : 0;

          return [name, modifier + bonus + prof];
        }),
    );

    const skills = new CaseInsensitiveMap(
      character
        .getOrThrow("skills")
        .entries()
        .map(([name, value]) => {
          const libSkill = this.#store
            .getOrThrow("library")
            .getOrThrow("skill")
            .getNode(name, "SKILL")!;

          const modifier = getModifier(abilities.getOrThrow(libSkill.ability));
          const bonus = resolveValue(value as Value) as number ?? 0;
          const prof = value.type === "COMPUTED" && value.proficiency
            ? getProficiency(value.proficiency) * proficiencyBonus
            : 0;

          return [name, modifier + bonus + prof];
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

    const choices = new CaseInsensitiveMap(
      character
        .getOrThrow("choices")
        .entries()
        .map(([path, choice]) => {
          assert(choice, "CHARACTER_GET", "CHOOSE");
          const selected = choice.slectedKeys
            ? Array.from(choice.slectedKeys)
            : [];

          const open = choice.openKeys ? Array.from(choice.openKeys) : [];

          return [path, { count: resolveValue(choice.count), selected, open }];
        }),
    );

    const options = new CaseInsensitiveMap(
      character
        .getOrThrow("options")
        .entries()
        .map(([path, choice]) => {
          assert(choice, "CHARACTER_GET", "OPTIONAL");

          const name = "name" in choice ? choice.name : choice.key ?? path;

          return [path, { name, active: choice.active ?? false }];
        }),
    );

    const proficiencies = character
      .getOrThrow("proficiencies");

    const armorProfs = proficiencies
      .values()
      .filter((v) => v.type === "TYPE" && v.of.toLowerCase() === "armor")
      .map((v) => (v as Type).name)
      .toArray();

    const weaponProfs = proficiencies
      .values()
      .filter((v) => v.type === "TYPE" && v.of.toLowerCase() === "weapon")
      .map((v) => (v as Type).name)
      .toArray();

    const languageProfs = proficiencies
      .values()
      .filter((v) => v.type === "TYPE" && v.of.toLowerCase() === "language")
      .map((v) => (v as Type).name)
      .toArray();

    const toolProfs = proficiencies
      .values()
      .filter((v) => v.type === "TYPE" && v.of.toLowerCase() === "tool")
      .map((v) => (v as Type).name)
      .toArray();

    const spellcasting = character.has("spellcasting")
      ? new CaseInsensitiveMap(
        character
          .getOrThrow("spellcasting")
          .entries()
          .map(([className, value]) => {
            assert(value, "CHARACTER_GET", "SPELLCASTING");
            assert(value.ability, "CHARACTER_GET", "ABILITY");

            return [className, {
              ability: value.ability.name,
              table: value.table,
            }];
          }),
      )
      : undefined;

    const spells = character.get("spells");

    return {
      name: character
        .getOrThrow("info")
        .getNode("name", "LITERAL")?.value,
      classes: classLevels,
      proficiencyBonus,
      abilities,
      saves,
      skills,
      passives,
      choices,
      options,
      proficiencies: {
        armor: armorProfs,
        weapon: weaponProfs,
        language: languageProfs,
        tool: toolProfs,
      },
      spellcasting,
      spells,
      tree: result,
    };
  }

  private applyTree() {
    const character = this.#store
      .getOrThrow("character");
    const classes = character
      .get("classes");

    character.getOrThrow("proficiencies").clear(); // TODO Does this make sense?

    const characterLevel = classes
      ? classes
        .values()
        .map((c) => c.type === "CLASS" ? c.level ?? 0 : 0)
        .reduce((acc, curr) => acc + curr)
      : 0;

    character.getOrThrow("info").set("characterlevel", {
      type: "LITERAL",
      value: characterLevel,
    });

    const tree = {
      type: "MULTIPLE",
      values: [
        ...(classes?.values().toArray() ?? []),
      ],
    } as Node;

    return iterate(tree, { store: this.#store, log: false });
  }
}
