import { CaseInsensitiveMap, NodeMap } from "../lib/map.ts";
import {
  assert,
  getModifier,
  getProficiency,
  getProficiencyBonus,
  is,
  resolveValue,
  unwrapDependency,
} from "../lib/utils.ts";
import { Library } from "./library.ts";
import { iterate } from "./tree/iterate.ts";
import {
  Class,
  Computed,
  Node,
  Store,
  Type,
  Value,
  ZERO,
} from "./tree/types.ts";

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
          ["resources", new NodeMap()],
          ["choices", new NodeMap()],
          ["options", new NodeMap()],
          ["proficiencies", new NodeMap()],
          [
            "stats",
            new NodeMap([
              ["walking_speed", {
                type: "COMPUTED",
                modifiers: [],
              }],
              ["swimming_speed", {
                type: "COMPUTED",
                modifiers: [],
              }],
              ["flying_speed", {
                type: "COMPUTED",
                modifiers: [],
              }],
              ["climbing_speed", {
                type: "COMPUTED",
                modifiers: [],
              }],
              ["temp_hp", {
                type: "COMPUTED",
                modifiers: [],
              }],
            ]),
          ],
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

    const staticValues = new NodeMap();
    if (is(classValue, "CLASS") && classValue.static) {
      for (const [key, value] of Object.entries(classValue.static)) {
        staticValues.set(key, value);
      }
    }

    classes.set(
      className,
      { ...classValue, level: 1, static: staticValues } as Class & {
        static: NodeMap;
      },
    );
    this.update();
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

    this.update();
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
      this.update();
      return this;
    }

    if (
      !open.has(key) || selected.size >= (resolveValue(choice.count) as number)
    ) {
      return this;
    }
    selected.add(key);
    open.delete(key);
    this.update();
    return this;
  }

  public setOption(identifier: string, active: boolean): this {
    const option = this.#store
      .getOrThrow("character")
      .getOrThrow("options")
      .getNode(identifier, "OPTIONAL");

    if (!option) return this;

    option.active = active;
    this.update();
    return this;
  }

  public setName(name: string): this {
    this.#store
      .getOrThrow("character")
      .getOrThrow("info")
      .set("name", { type: "LITERAL", value: name });
    this.update();
    return this;
  }

  public setAbilityBase(name: string, value: number): this {
    const ability = this.#store
      .getOrThrow("character")
      .getOrThrow("abilities")
      .get(name) as Computed | undefined;
    if (!ability) return this;

    ability.base = { type: "LITERAL", value };
    this.update();
    return this;
  }

  public useResource(name: string): this {
    const resources = this.#store
      .getOrThrow("character")
      .getOrThrow("resources");
    const resource = resources.getNode(name, "RESOURCE");

    if (!resource) return this;

    const usesNode = unwrapDependency(resource.uses);
    assert(usesNode, "useResources", "LITERAL", "COMPUTED");
    const uses = resolveValue(usesNode) as number;
    const spent = resolveValue(resource.spent) as number;

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
    const resources = this.#store
      .getOrThrow("character")
      .getOrThrow("resources");

    for (const [key, resource] of resources) {
      assert(resource, "TRIGGER", "RESOURCE");

      if (identifier.toLowerCase() === resource.resetTrigger.toLowerCase()) {
        resources.set(key, { ...resource, spent: ZERO });
      }
    }

    this.update();
    return this;
  }

  public get() {
    const { result } = this.update();

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

    const level = classLevels.size > 0
      ? classLevels.values().reduce((acc, curr) => acc + curr)
      : 0;

    const proficiencyBonus = character
      .getOrThrow("stats")
      .getNode("proficiency_bonus", "LITERAL")?.value as number ?? 0;

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

          if ("overwrite" in value && value.overwrite!.length > 0) {
            return [name, bonus];
          }

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

          if ("overwrite" in value && value.overwrite!.length > 0) {
            return [name, bonus];
          }

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
    const actions = character.get("actions");
    const resources = new CaseInsensitiveMap(
      character.getOrThrow("resources")
        .values()
        .map((resource) => {
          assert(resource, "CHARACTER_GET", "RESOURCE");

          const usesNode = unwrapDependency(resource.uses);
          assert(usesNode, "useResources", "LITERAL", "COMPUTED");
          const uses = resolveValue(usesNode) as number;
          const spent = resolveValue(resource.spent) as number;

          return [resource.name, {
            uses,
            spent,
            resetTrigger: resource.resetTrigger,
          }];
        }),
    );

    return {
      name: character
        .getOrThrow("info")
        .getNode("name", "LITERAL")?.value,
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
      spellcasting,
      spells,
      actions,
      resources,
      tree: result,
      choices,
      options,
    };
  }

  private update() {
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

    character.getOrThrow("stats").set("proficiency_bonus", {
      type: "LITERAL",
      value: getProficiencyBonus(characterLevel),
    });

    const tree = {
      type: "MULTIPLE",
      values: [
        ...(classes?.values().toArray() ?? []),
      ],
    } as Node;

    return iterate(tree, { store: this.#store, log: true });
  }
}
