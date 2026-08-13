import { EMPTY, Node, NodeWith } from "./types.ts";
import {
  caseInsensitiveGet,
  expect,
  getModifier,
  getProficiencyBonus,
  NodePath,
  PATH_COUNTER,
  PATH_IDENTIFIER,
  PATH_SEPARATOR,
  readData,
} from "./lib/utils.ts";
import { createLibrary, Library } from "./library.ts";

type CTX = {
  classLevel?: number;
  filePath: string;
  apply: boolean;
  path: NodePath;
  log?: boolean;
};

type CharacterValue = { modifiers: Map<string, number>; setValue?: number };

type CharacterConfig = { onRender?: (char: Character) => void };

type CharacterAbility = NodeWith<"ABILITY"> & CharacterValue & {
  saveProficient: boolean;
  saveModifiers: Map<string, number>;
};

type CharacterSkill = NodeWith<"SKILL"> & CharacterValue & {
  proficient: boolean;
  expertise: boolean;
  halfProficient: boolean;
  passiveModifiers: Map<string, number>;
};

type CharacterChoice = {
  name: string;
  max: number;
  choicesMade: Map<string, Node>;
  options: Map<string, Node>;
};

type CharacterOption = {
  name: string;
  checked: boolean;
};

class Character {
  #library: Library;
  #name?: string;
  #classes = new Map<string, number>();
  #abilities = new Map<string, CharacterAbility>();
  #skills = new Map<string, CharacterSkill>();
  #choices = new Map<NodePath, CharacterChoice>();
  #options = new Map<NodePath, CharacterOption>();

  #stats: {
    speed: {
      walking: CharacterValue;
      swimming: CharacterValue;
      flying: CharacterValue;
    };
    ac: CharacterValue;
  } = {
    speed: {
      walking: { modifiers: new Map() },
      swimming: { modifiers: new Map() },
      flying: { modifiers: new Map() },
    },
    ac: { modifiers: new Map() },
  };
  #config: CharacterConfig;

  constructor(
    library: Library,
    config?: CharacterConfig,
  ) {
    this.#library = library;
    this.#config = config ?? {};
    this.cleanup();
  }

  private cleanup() {
    this.#library.content.get("ABILITY")?.forEach((a) => {
      if (!expect(a.node, { path: "CLEANUP" }, "ABILITY")) return;
      this.#abilities.set(a.node.name, {
        ...a.node,
        modifiers: new Map(),
        saveModifiers: new Map(),
        saveProficient: false,
      });
    });

    this.#library.content.get("SKILL")?.forEach((s) => {
      if (!expect(s.node, { path: "CLEANUP" }, "SKILL")) return;
      this.#skills.set(s.node.name, {
        ...s.node,
        modifiers: new Map(),
        passiveModifiers: new Map(),
        proficient: false,
        expertise: false,
        halfProficient: false,
      });
    });
  }

  public get() {
    return {
      name: this.#name,
      classes: this.#classes,
      proficiencyBonus: getProficiencyBonus(this.calculateLevel()),
      abilities: new Map(
        this.#abilities.values().map((
          a,
        ) => [a.name, {
          score: this.calculateCharVal(a),
          modifier: getModifier(this.calculateCharVal(a)),
          ...this.calculateSave(a),
        }]),
      ),
      skills: new Map(
        this.#skills.values().map((
          s,
        ) => [s.name, {
          value: this.calculateSkill(s),
          proficient: s.proficient,
          expertise: s.expertise,
          halfProficient: s.halfProficient,
          ...this.calculatePassive(s),
        }]),
      ),
      choices: new Map(
        this.#choices.entries().map((
          [identifier, choice],
        ) => [identifier, {
          max: choice.max,
          choicesMade: choice.choicesMade.keys().toArray(),
          options: choice.options.keys().filter((opt) =>
            !choice.choicesMade.has(opt)
          ).toArray(),
        }]),
      ),
      options: new Map(
        this.#options.entries().map((
          [identifier, option],
        ) => [identifier, option.checked]),
      ),
    };
  }

  public setName(name: string) {
    this.#name = name;
    return this.render();
  }

  public addClass(className: string) {
    if (
      this.#classes.has(className) || !this.#library.has("CLASS", className)
    ) return this;
    this.#classes.set(className, 1);
    return this.render();
  }

  public setClassLevel(clsssName: string, level: number) {
    if (
      level < 1 || level > 20 || !Number.isInteger(level) ||
      !this.#classes.has(clsssName)
    ) {
      return;
    }

    this.#classes.set(clsssName, level);
    return this.render();
  }

  public makeChoice(identifier: NodePath, name: string) {
    const choiceObj = this.#choices.get(identifier);

    if (!choiceObj) return;
    if (choiceObj.choicesMade.size >= choiceObj.max) return;

    const choice = choiceObj.options.get(name);

    if (!choice) return;

    choiceObj.choicesMade.set(name, choice);

    return this.render();
  }

  public removeChoice(identifier: NodePath, name: string) {
    const choiceObj = this.#choices.get(identifier);
    if (!choiceObj || !choiceObj.choicesMade.has(name)) return;

    choiceObj.choicesMade.delete(name);

    return this.render();
  }

  public setOption(identifier: NodePath, value: boolean) {
    const option = this.#options.get(identifier);
    if (!option) return;
    option.checked = value;
    return this.render();
  }

  private async render() {
    this.cleanup();
    for (const [className] of this.#classes) {
      const classObj = this.#library.acccess("CLASS", className)!;
      await this.applyNode(classObj.node, {
        filePath: classObj.filePath,
        apply: true,
        path: "",
        log: true,
      });
    }
    if (this.#config.onRender) this.#config.onRender(this);
    return this;
  }

  private async applyNode(
    node: Node,
    ctxInput: CTX,
  ): Promise<Node> {
    const pathChunk = "name" in node
      ? `${node.type}${PATH_IDENTIFIER}${node.name}`
      : node.type;
    const newPath = ctxInput.path.length !== 0
      ? `${ctxInput.path}${PATH_SEPARATOR}${pathChunk}`
      : pathChunk;
    const ctx: CTX = { ...ctxInput, path: newPath };

    switch (node.type) {
      case "CLASS": {
        // TODO Apply hitDice, HP, asi ...
        const currentLevel = this.#classes.get(node.name);
        if (!currentLevel) return EMPTY;

        const filtered = Object.entries(node.levels).filter(([level]) =>
          parseInt(level) <= currentLevel
        );

        for (const [level, n] of filtered) {
          await this.applyNode(n, {
            ...ctx,
            classLevel: currentLevel,
            path: `${ctx.path}${PATH_COUNTER}${level}`,
          });
        }

        return EMPTY;
      }
      case "MULTIPLE": {
        return {
          type: "MULTIPLE",
          values: await Promise.all(
            node.values.map((n) => this.applyNode(n, ctx)),
          ),
        };
      }
      case "CHOOSE": {
        const options = node.from.type === "DERIVE"
          ? this.derive(node.from.from)
          : node.from;

        if (!expect(options, ctx, "MULTIPLE")) return EMPTY;

        const identifiers = (await Promise.all(
          options.values.map(async (
            n,
          ) => [await this.getIdentifier(n, ctx), n]),
        )).filter(([ident]) => ident !== undefined) as unknown as [[
          string,
          Node,
        ]];

        const choiceObj = this.#choices.getOrInsert(ctx.path, {
          name: node.name,
          max: node.count,
          choicesMade: new Map(),
          options: new Map(identifiers),
        });

        return {
          type: "MULTIPLE",
          values: choiceObj.choicesMade.values().toArray(),
        };
      }
      case "OPTIONAL": {
        const optionObj = this.#options.getOrInsert(ctx.path, {
          name: node.name,
          checked: false,
        });

        if (optionObj.checked) {
          return this.applyNode(node.value, ctx);
        }

        return EMPTY;
      }
      case "CLASS_FEAT": {
        if (!node.levels || !ctx.classLevel) return EMPTY;
        const filtered = Object.entries(node.levels).filter(([level]) =>
          parseInt(level) <= ctx.classLevel!
        );

        for (const [level, n] of filtered) {
          await this.applyNode(n, {
            ...ctx,
            path: `${ctx.path}${PATH_COUNTER}${level}`,
          });
        }

        return EMPTY;
      }
      case "PROFICIENCY": {
        const res = await this.applyNode(node.skill, ctx);

        const applyProficiency = (input: NodeWith<"SKILL">) => {
          const characterSkill = this.#skills.get(input.name)!;
          if (node.expertise) characterSkill.expertise = true;
          else if (node.half) characterSkill.halfProficient = true;
          else characterSkill.proficient = true;
        };

        if (res.type === "SKILL") applyProficiency(res);
        else if (res.type === "MULTIPLE") {
          res.values.forEach((n) => {
            if (!expect(n, ctx, "SKILL")) return;
            applyProficiency(n);
          });
        }

        return EMPTY;
      }
      case "DERIVE": {
        return this.derive(node.from);
      }
      case "MODIFIER": {
        const value = await this.applyNode(node.value, {
          ...ctx,
          apply: false,
        });

        if (!expect(value, ctx, "LITERAL") || typeof value.value !== "number") {
          return EMPTY;
        }

        const modify = node.modify
          ? await this.applyNode(node.modify, { ...ctx, apply: false })
          : undefined;

        const set = node.set
          ? await this.applyNode(node.set, { ...ctx, apply: false })
          : undefined;

        if (modify && expect(modify, ctx, "MULTIPLE")) {
          modify.values.forEach(
            (v) => {
              if (
                !("modifiers" in v) || !(v.modifiers instanceof Map)
              ) return;
              v.modifiers.set(ctx.path, value.value);
            },
          );
        }

        if (set && expect(set, ctx, "MULTIPLE")) {
          // deno-lint-ignore no-explicit-any
          set.values.forEach((v: any) => {
            if ("setValue" in v && v.setValue) return;
            v.setValue = value.value;
          });
        }

        return EMPTY;
      }

      case "IMPORT": {
        const { data, newPath } = await readData(ctx.filePath, node.from);
        return this.applyNode(data, { ...ctx, filePath: newPath });
      }

      case "LITERAL": {
        return node;
      }
      case "EMPTY": {
        return EMPTY;
      }
      case "FEAT":
      case "RESOURCE":
      case "SKILL":
      case "ACTION":
      case "SPELL":
      case "ROLL":
      default:
        console.log(node.type);
        return EMPTY;
    }
  }

  private async getIdentifier(
    node: Node,
    ctx: { filePath: string },
  ): Promise<string | undefined> {
    if ("name" in node) return node.name;
    switch (node.type) {
      case "MULTIPLE": {
        for (const child of node.values) {
          const res = this.getIdentifier(child, ctx);
          if (res) return res;
        }
        break;
      }
      case "IMPORT": {
        //const _data = await readData(ctx.filePath);
        // TODO
        break;
      }
      case "DERIVE":
        return this.getIdentifier(this.derive(node.from), ctx);
      case "PROFICIENCY":
        return this.getIdentifier(node.skill, ctx);

      case "MODIFIER": {
        let res: string | undefined = undefined;
        if (node.modify) res = await this.getIdentifier(node.modify, ctx);
        if (!res && node.set) res = await this.getIdentifier(node.set, ctx);
        return res;
      }
      case "ACTION":
        return this.getIdentifier(node.effect, ctx);
      case "LITERAL":
        return node.value.toString();
      case "ROLL":
        return `${node.diceCount}d${node.diceType}` +
          (node.modifier ? ` + ${node.modifier}` : "") +
          (node.minimum ? ` (min. ${node.minimum})` : "");
      case "EMPTY":
      default:
        return undefined;
    }
  }

  private derive(query: string): Node {
    const [path, params] = query.replace("$", "").split("?");
    const pathSegments = path.split(".");

    switch (pathSegments[0]) {
      case "CHARACTER": {
        switch (pathSegments[1]) {
          case "SKILLS": {
            return {
              type: "MULTIPLE",
              values: this.#skills.values().filter(applyParams).toArray(),
            };
          }
          case "ABILITIES": {
            return {
              type: "MULTIPLE",
              values: this.#abilities.values().filter(applyParams).toArray(),
            };
          }
        }
        return EMPTY;
      }
      case "LIBRARY": {
        if (pathSegments.length === 2) {
          const category = this.#library.content.get(pathSegments[1]);
          if (!category) return EMPTY;

          return {
            type: "MULTIPLE",
            values: category.values().filter((value) => applyParams(value.node))
              .map(
                (v) => v.node,
              )
              .toArray(),
          };
        }
      }
    }

    return EMPTY;

    function applyParams(node: Node): boolean {
      if (!params) return true;
      const paramsSegments = params.split(";");

      for (const segment of paramsSegments) {
        const [category, options] = segment.split("=");
        const values = options.split("|").map((s) => s.toUpperCase());
        const nodeValue = caseInsensitiveGet(node, category)?.toUpperCase();
        if (!nodeValue) return false;
        return values.includes(nodeValue);
      }
      return false;
    }
  }

  private calculateSave(ability: CharacterAbility) {
    const save = ability.saveModifiers.size >
        0
      ? ability.saveModifiers.values().reduce((acc, curr) => acc + curr)
      : 0;

    const proficiencyBonus = ability.saveProficient
      ? getProficiencyBonus(this.calculateLevel())
      : 0;

    return {
      save: save + getModifier(this.calculateCharVal(ability)) +
        proficiencyBonus,
      saveProficient: ability.saveProficient,
    };
  }
  private calculateSkill(skill: CharacterSkill): number {
    if (skill.setValue) return getModifier(skill.setValue);
    const modifierValue = skill.modifiers.size > 0
      ? skill.modifiers.values().reduce((alloc, curr) => alloc + curr)
      : 0;

    const ability = this.#abilities.get(skill.ability)!;
    const proficiencyBonusValue = getProficiencyBonus(this.calculateLevel());
    const proficiencyBonus = skill.expertise
      ? proficiencyBonusValue * 2
      : skill.proficient
      ? proficiencyBonusValue
      : skill.halfProficient
      ? Math.floor(proficiencyBonusValue / 2)
      : 0;
    return getModifier(this.calculateCharVal(ability)) + modifierValue +
      proficiencyBonus;
  }
  private calculatePassive(skill: CharacterSkill): { passive?: number } {
    if (!skill.hasPassive) return {};

    const passive = skill.passiveModifiers.size > 0
      ? skill.passiveModifiers.values().reduce((acc, curr) => acc + curr)
      : 0;

    return { passive };
  }
  private calculateLevel(): number {
    return this.#classes.size > 0
      ? this.#classes.values().reduce((acc, curr) => acc + curr)
      : 0;
  }
  private calculateCharVal(value: CharacterValue): number {
    if (value.setValue) return value.setValue;
    return value.modifiers.size > 0
      ? value.modifiers.values().reduce((acc, curr) => acc + curr)
      : 0;
  }
}

const lib = await createLibrary("./examples/index.json");
const char = new Character(lib);
await char.addClass("Test");

/* await char.makeChoice(
  "CLASS@Ranger_/_MULTIPLE_/_CLASS_FEAT@Proficiencies_/_PROFICIENCY_/_CHOOSE",
  "ANIMAL HANDLING",
);

await char.setClassLevel("Ranger", 10);

await char.setOption(
  "CLASS@Ranger_/_MULTIPLE_/_OPTIONAL@Spellcasting Focus",
  true,
); */

console.log(lib);
