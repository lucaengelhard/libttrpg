import * as path from "@std/path";

import { CaseInsensitiveMap, NodeMap } from "../lib/map.ts";
import { readData } from "../lib/utils.ts";
import {
  EMPTY,
  Multiple,
  Node,
  NodeWithKey,
  NodeWithName,
  Resource,
  Value,
} from "./tree.ts";

export type Library = CaseInsensitiveMap<string, NodeMap>;
export async function createLibrary(entryPoint: string): Promise<Library> {
  const { data } = await readData("", entryPoint);
  const library: Library = new CaseInsensitiveMap();

  const resolved = await resolveImports(data, path.resolve(entryPoint));

  build(resolved);

  return library;

  async function resolveImports(node: Node, filePath: string): Promise<Node> {
    if (!(typeof node === "object" && "type" in node)) {
      console.log(node);
      return EMPTY;
    }

    switch (node.type) {
      case "IMPORT": {
        const { data, newPath } = await readData(filePath, node.from);
        return resolveImports(data, newPath);
      }
      case "MULTIPLE": {
        return {
          ...node,
          values: await Promise.all(
            node.values.map((v) =>
              resolveImports(v, filePath) as Promise<NodeWithKey>
            ),
          ),
        };
      }

      case "CHOOSE": {
        return {
          ...node,
          from: await resolveImports(node.from, filePath) as Multiple,
          count: await resolveImports(node.count, filePath) as Value,
        };
      }
      case "OPTIONAL": {
        return { ...node, value: await resolveImports(node.value, filePath) };
      }
      case "CLASS": {
        return { ...node, levels: await resolveLevels(node.levels, filePath) };
      }
      case "SUBCLASS": {
        return { ...node, levels: await resolveLevels(node.levels, filePath) };
      }
      case "FEAT": {
        return {
          ...node,
          levels: node.levels
            ? await resolveLevels(node.levels, filePath)
            : undefined,
          gives: node.gives
            ? await resolveImports(node.gives, filePath) as Multiple
            : undefined,
        };
      }
      case "PROFICIENCY": {
        const save = node.save
          ? await resolveImports(node.save, filePath)
          : undefined;

        const skill = node.skill
          ? await resolveImports(node.skill, filePath)
          : undefined;

        const armor = node.armor
          ? await resolveImports(node.armor, filePath)
          : undefined;

        const weapon = node.weapon
          ? await resolveImports(node.weapon, filePath)
          : undefined;

        return { ...node, save, skill, armor, weapon };
      }

      case "MODIFIER": {
        if (node.value === undefined) console.log(node);
        const value = await resolveImports(node.value, filePath);

        const modify = node.modify
          ? await resolveImports(node.modify, filePath)
          : undefined;

        const set = node.set
          ? await resolveImports(node.set, filePath)
          : undefined;

        return { ...node, value, modify, set };
      }

      case "ACTION": {
        return { ...node, effect: await resolveImports(node.effect, filePath) };
      }

      case "SPELL": {
        const castWithoutSpellSlot = node.castWithoutSpellSlot
          ? await resolveImports(
            node.castWithoutSpellSlot,
            filePath,
          ) as Resource
          : undefined;

        return { ...node, castWithoutSpellSlot };
      }

      case "ROLL": {
        return {
          ...node,
          diceType: await resolveImports(node.diceType, filePath),
          diceCount: await resolveImports(node.diceCount, filePath),
          minimum: await resolveImports(node.minimum, filePath),
          modifier: await resolveImports(node.modifier, filePath),
        };
      }

      case "SPELLCASTING": {
        return {
          ...node,
          ability: await resolveImports(node.ability, filePath),
        };
      }

      case "RESOURCE": {
        return {
          ...node,
          uses: await resolveImports(node.uses, filePath),
        };
      }
      case "LITERAL": {
        return { ...node, key: node.key ?? node.value.toString() };
      }
      case "EMPTY":
      case "DEPENDENCY":
      case "COMPUTED":
      case "SKILL":
      case "ABILITY":
      case "TYPE": {
        return node;
      }
      default: {
        console.log(node);
        return node;
      }
    }

    async function resolveLevels(
      levels: Record<string, Node>,
      filePath: string,
    ): Promise<Record<string, Node>> {
      const result = Object.entries(levels)
        .map(async (
          [level, value],
        ) => [level, await resolveImports(value, filePath)]);

      return Object.fromEntries(
        await Promise.all(result),
      );
    }
  }

  function build(node: Node) {
    if (!node) return;
    if ("key" in node || "name" in node) {
      const anyNode = node as NodeWithName;
      appendToLib(
        anyNode.key ?? anyNode.name,
        node as NodeWithKey | NodeWithName,
      );
      return;
    }
    if ("name" in node || node.type === "IMPORT") return;

    switch (node.type) {
      case "MULTIPLE": {
        for (const value of node.values) {
          build(value);
        }
        break;
      }
      case "PROFICIENCY":
      case "MODIFIER":
      case "ACTION":
      case "SPELLCASTING":
      case "ROLL":
      case "EMPTY":
      case "CHOOSE":
      case "OPTIONAL":
      case "LITERAL":
      case "COMPUTED":
      case "DEPENDENCY":
      default:
        //console.log(node.type);
    }

    function appendToLib(key: string, node: NodeWithKey | NodeWithName) {
      const category = library.getOrInsert(node.type, new NodeMap());
      if (category.has(key)) {
        throw `Duplicate Identifier in ${node.type}: ${key}`;
      }
      category.set(key, structuredClone(node));
    }
  }
}
