import * as path from "@std/path";
import { EMPTY, Node, NodeWith } from "./types.ts";
import { expect } from "./parse.ts";
import { getModifier, readData } from "./lib/utils.ts";

type Library = Awaited<ReturnType<typeof createLibrary>>;
async function createLibrary(entryPoint: string) {
  const inputPath = path.resolve(entryPoint);
  const data = await readData(inputPath);

  const library = new Map<
    string,
    Map<string, { node: Extract<Node, { name: string }>; filePath: string }>
  >();
  const visited = new Set<string>();

  await traverse(data, inputPath);

  return {
    content: library,
    acccess(category: string, identifier: string) {
      return library.get(category)?.get(identifier);
    },
    has(category: string, identifier: string) {
      return library.get(category)?.has(identifier) ?? false;
    },
  };

  async function traverse(node: Node, filePath: string) {
    if ("name" in node) {
      const category = library.getOrInsert(node.type, new Map());
      if (category.has(node.name)) {
        throw `Duplicate Identifier in ${node.type}: ${node.name}`;
      }
      category.set(node.name, { node, filePath });
      return;
    }

    switch (node.type) {
      case "IMPORT": {
        let newAbsPath = path.resolve(path.dirname(filePath), node.from);
        const info = await Deno.stat(newAbsPath);
        if (info.isDirectory) {
          newAbsPath = path.join(newAbsPath, "index.json");
        }

        if (visited.has(newAbsPath)) break;
        visited.add(newAbsPath);
        const imported = await readData(newAbsPath);
        await traverse(imported, newAbsPath);
        break;
      }
      case "MULTIPLE": {
        for (const item of node.values) {
          await traverse(item, filePath);
        }
        break;
      }
    }
  }
}

type NodePath = string;
type CTX = {
  classLevel?: number;
  filePath: string;
  apply: boolean;
  path: NodePath;
};

type CharacterAbility = NodeWith<"ABILITY"> & {
  modifiers: Map<string, number>;
  saveProficient: boolean;
  saveModifiers: Map<string, number>;
};

type CharacterSkill = NodeWith<"SKILL"> & {
  modifiers: Map<string, number>;
  proficient: boolean;
  expertise: boolean;
  passiveModifiers: Map<string, number>;
};

type CharacterChoice = {
  name: string;
  max: number;
  choicesMade: Map<string, Node>;
  options: Map<string, Node>;
};

class Character {
  #library: Library;
  #name?: string;
  #classes = new Map<string, number>();
  #abilities = new Map<string, CharacterAbility>();
  #skills = new Map<string, CharacterSkill>();
  #choices = new Map<NodePath, CharacterChoice>();
  constructor(library: Library) {
    this.#library = library;

    this.#library.content.get("ABILITY")?.forEach((a) => {
      if (!expect(a.node, "ABILITY")) return;
      this.#abilities.set(a.node.name, {
        ...a.node,
        modifiers: new Map([["__BASE_VALUE__", 0]]),
        saveModifiers: new Map(),
        saveProficient: false,
      });
    });

    this.#library.content.get("SKILL")?.forEach((s) => {
      if (!expect(s.node, "SKILL")) return;
      this.#skills.set(s.node.name, {
        ...s.node,
        modifiers: new Map(),
        passiveModifiers: new Map(),
        proficient: false,
        expertise: false,
      });
    });
  }

  public setName(name: string) {
    this.#name = name;
    return this.render();
  }

  public async addClass(className: string) {
    if (
      this.#classes.has(className) || !this.#library.has("CLASS", className)
    ) return this;
    this.#classes.set(className, 1);
    return await this.render();
  }

  private async render() {
    for (const [className] of this.#classes) {
      const classObj = this.#library.acccess("CLASS", className)!;
      await this.applyNode(classObj.node, {
        filePath: classObj.filePath,
        apply: true,
        path: "",
      });
    }
    return this;
  }

  private async applyNode(
    node: Node,
    ctxInput: CTX,
  ): Promise<Node> {
    const pathChunk = "name" in node ? `${node.type}@${node.name}` : node.type;
    const newPath = ctxInput.path.length !== 0
      ? `${ctxInput.path}_/_${pathChunk}`
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

        for (const [_, n] of filtered) {
          await this.applyNode(n, { ...ctx, classLevel: currentLevel });
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

        if (!expect(options, "MULTIPLE")) return EMPTY;

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

        //console.log(choiceObj.choicesMade);

        return {
          type: "MULTIPLE",
          values: choiceObj.choicesMade.values().toArray(),
        };
      }
      case "CLASS_FEAT": {
        if (!node.levels || !ctx.classLevel) return EMPTY;
        const filtered = Object.entries(node.levels).filter(([level]) =>
          parseInt(level) <= ctx.classLevel!
        );

        for (const [_, n] of filtered) {
          await this.applyNode(n, ctx);
        }

        return EMPTY;
      }

      case "PROFICIENCY": {
        const skill = await this.applyNode(node.skill, ctx);
        if (skill.type === "SKILL") {
          const characterSkill = this.#skills.get(skill.name)!;
          if (node.expertise) characterSkill.expertise = true;
          else characterSkill.proficient = true;
        }

        return EMPTY;
      }
      case "DERIVE": {
        return this.derive(node.from);
      }
      case "MODIFIER": {
        const modifies = node.modifies
          ? await this.applyNode(node.modifies, { ...ctx, apply: false })
          : undefined;

        if (
          !modifies || !expect(modifies, "SKILL", "MULTIPLE") || !node.value
        ) {
          return EMPTY;
        }

        const value = node.value.type === "DERIVE"
          ? this.derive(node.value.from)
          : node.value;

        if (!expect(value, "LITERAL")) {
          return EMPTY;
        }

        const modifiySkill = (skill: CharacterSkill) => {
          if (typeof value.value !== "number") return;
          skill.modifiers.set(ctx.path, value.value);
        };

        if (modifies.type === "SKILL") {
          modifiySkill(modifies as CharacterSkill);
        } else {
          modifies.values.forEach((s) => {
            if (!expect(s, "SKILL")) return;
            modifiySkill(s as CharacterSkill);
          });
        }

        return EMPTY;
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
      case "OPTIONAL":
      case "IMPORT":
      case "ACTION":
      case "SPELL":
      case "ROLL":
      default:
        console.log(node.type);
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
      case "OPTIONAL": {
        return this.getIdentifier(node.value, ctx);
      }
      case "CHOOSE": {
        return this.getIdentifier(node.from, ctx);
      }
      case "IMPORT": {
        const data = await readData(ctx.filePath);
        break;
      }
      case "DERIVE": {
        return this.getIdentifier(this.derive(node.from), ctx);
      }
      case "PROFICIENCY":
      case "MODIFIER":
      case "ACTION":
      case "SPELL":
      case "ROLL":
      case "LITERAL":
      case "EMPTY":
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
              values: this.#skills.entries().filter(applyParams).map((
                [_, n],
              ) => n).toArray(),
            };
          }
        }
        return EMPTY;
      }
      case "SKILLS": {
        if (pathSegments.length === 2) {
          return this.#skills.get(pathSegments[1]) ?? EMPTY;
        }
        return { type: "MULTIPLE", values: this.#skills.values().toArray() };
      }
    }

    function applyParams([name, node]: [name: string, node: Node]): boolean {
      if (!params) return true;
      const paramsSegments = params.split(";");
      for (const segment of paramsSegments) {
        const [category, options] = segment.split("=");
        const values = options.split("|").map((s) => s.toUpperCase());

        switch (category.toUpperCase()) {
          case "NAME": {
            if (values.includes(name.toUpperCase())) return true;
          }
        }
      }
      return false;
    }

    return EMPTY;
  }

  public async get() {
    await this.render();

    return {
      name: this.#name,
      classes: this.#classes,
      abilities: new Map(
        this.#abilities.values().map((a) => [a.name, this.calculateAbility(a)]),
      ),
      skills: new Map(
        this.#skills.values().map((s) => [s.name, this.calculateSkill(s)]),
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
    };
  }

  private calculateAbility(ability: CharacterAbility): number {
    return ability.modifiers.values().reduce((alloc, curr) => alloc + curr);
  }
  private calculateSkill(skill: CharacterSkill): number {
    const modifierValue = skill.modifiers.size > 0
      ? skill.modifiers.values().reduce((alloc, curr) => alloc + curr)
      : 0;

    const ability = this.#abilities.get(skill.ability)!;
    return getModifier(this.calculateAbility(ability)) + modifierValue;
  }

  public makeChoice(identifier: string, name: string) {
    const choiceObj = this.#choices.get(identifier);

    if (!choiceObj) return;
    if (choiceObj.choicesMade.size >= choiceObj.max) return;

    const choice = choiceObj.options.get(name);
    if (!choice) return;

    choiceObj.choicesMade.set(name, choice);

    return this.render();
  }
}

const lib = await createLibrary("./examples/index.json");

const char = new Character(lib);
await char.addClass("Test");
//console.log(await char.get());
await char.makeChoice(
  "CLASS@Test_/_MULTIPLE_/_CLASS_FEAT@Second Feat_/_MULTIPLE_/_MODIFIER_/_CHOOSE@Choice",
  "ACROBATICS",
);
console.log(await char.get());

await char.makeChoice(
  "CLASS@Test_/_MULTIPLE_/_CLASS_FEAT@Second Feat_/_MULTIPLE_/_MODIFIER_/_CHOOSE@Choice",
  "MEDICINE",
);
console.log(await char.get());
