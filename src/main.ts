import { keyof } from "zod";

export async function create(input: string) {
  const data = await import(input, { with: { type: "json" } });
  // TODO: Resolve data, register named top-level data

  return {
    character() {
      return {
        name(name: string) {
        },
      };
    },
  };
}

/* const ranger =
  (await import("../examples/ranger.json", { with: { type: "json" } })).default; */

/* parse(ranger, {
  CHARACTER: { ABILITIES: { WISDOM: { base: 10 } } },
  CURRENT_PATH: "",
}); */

type Character = Partial<{
  name: string;
}>;
type CharacterWithout<T extends keyof Character> = Omit<Character, T>;

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

const c = addName({}, "hi"); */
