import { CaseInsensitiveMap, NodeMap } from "../lib/map.ts";
import {
  getModifier,
  getProficiencyBonus,
  resolveValue,
} from "../lib/utils.ts";
import { Class, Computed, Store, Value } from "./tree.ts";
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

    classes.set(className, { ...classValue, level: 1 } as Class);
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
            ? value.proficiency * proficiencyBonus
            : 0;

          return [name, modifier + bonus + prof];
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
          const prof = value.type === "COMPUTED" && value.proficiency
            ? value.proficiency * proficiencyBonus
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
    };
  }
}
