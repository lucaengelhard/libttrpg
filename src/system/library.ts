import type { ZodError } from "zod";
import { CaseInsensitiveMap, NodeMap } from "../lib/map.ts";
import { Character } from "./character.ts";
import type { Node, NodeWithKey, NodeWithName } from "./tree/types.ts";
import { NodeSchema } from "./tree/validate.ts";

export type Library = CaseInsensitiveMap<string, NodeMap>;
export function createLibrary(
  tree: unknown,
): {
  createCharacter?: () => Character;
  library?: Library;
  error?: ZodError<Node>;
} {
  const { data, error, success } = NodeSchema.safeParse(tree);

  if (!success) return { error };

  const library: Library = new CaseInsensitiveMap();
  build(data);
  library.lock();

  return { createCharacter, library };

  function createCharacter() {
    return new Character(library);
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
