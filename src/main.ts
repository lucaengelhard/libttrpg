import * as path from "@std/path";
import { Node } from "./types.ts";
export async function create(input: string) {
  const data = await import(input, { with: { type: "json" } });
  // TODO: Resolve data, register named top-level data

  const inputPath = path.resolve(input);

  const registry: Map<string, Node> = new Map();

  const visited: Set<string> = new Set([inputPath]);
  const cache: Map<string, any> = new Map();
  await resolve(data.default, inputPath);

  console.log(registry);

  return {};

  async function resolve(node: Node, filePath: string) {
    switch (node.type) {
      case "LIBRARY": {
        await resolve(node.content, filePath);
        break;
      }
      case "IMPORT": {
        const newAbsPath = path.resolve(path.dirname(filePath), node.from);
        const newPath = path.relative(
          Deno.cwd(),
          newAbsPath,
        );

        if (visited.has(newPath)) {
          //TODO
          return;
        }

        const imported = await import(newPath, { with: { type: "json" } });
        visited.add(newPath);
        await resolve(imported.default, newPath);
        break;
      }
      case "CLASS": {
        if (registry.has(`CLASS_${node.name}`)) throw "";
        registry.set(`CLASS_${node.name}`, node);
        break;
      }
      case "MULTIPLE": {
        for (const item of node.values) {
          await resolve(item, filePath);
        }
        break;
      }
      default:
        console.log(node);
    }
  }
}

await create("../examples/index.json");

/* const ranger =
  (await import("../examples/ranger.json", { with: { type: "json" } })).default; */

/* parse(ranger, {
  CHARACTER: { ABILITIES: { WISDOM: { base: 10 } } },
  CURRENT_PATH: "",
}); */

type BareCharacter = {
  ABILITIES: Record<string, any>;
  SKILLS: Record<string, any>;
  SPELLS: Record<string, any>;
  ACTIONS: Record<string, any>;
};
type Character =
  & BareCharacter
  & Partial<{
    name: string;
  }>;
type CharacterWithout<T extends keyof Character> = Omit<Character, T>;

function createCharacter(lib: unknown): Character {
  return { ABILITIES: {}, SKILLS: {}, SPELLS: {}, ACTIONS: {} };
}

function createCharacterMutation<
  I extends Character,
  O extends Character,
  A extends unknown,
>(
  mutation: (character: I, ...args: A[]) => O,
) {
  return (character: I, ...args: A[]) =>
    mutation(structuredClone(character), ...args);
}

const addName = createCharacterMutation((c, name: string) => ({ ...c, name }));

const c = createCharacter();
const c2 = addName(c, "Hi");

/* type Exact<T> =
  & {
    [K in keyof T]: T[K];
  }
  & { [key: string]: never };

function f<C extends Exact<CharacterWithout<"name">>, N extends string>(
  char: C,
  name: N,
) {
  return { ...char, name };
}

const addName = createCharacterMutation(f);

const s = {};
const c = addName(s, "hi");
console.log(s, c); */
