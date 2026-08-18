import { assert } from "@std/assert";
import type { Character } from "../src/system/character.ts";
import { createLibrary } from "../src/system/library.ts";

let createCharacter: () => Character;
let character: Character;

Deno.test.beforeAll(async () => {
  console.log("Importing library...");
  const tree = await import("../../data/build/library.json", {
    with: { type: "json" },
  });
  const { createCharacter: createCharacterFn } = createLibrary(tree.default);
  assert(createCharacterFn !== undefined);
  createCharacter = createCharacterFn;
});

Deno.test.beforeEach(() => {
  character = createCharacter();
});

Deno.test("Set name", () => {
  character.setName("Vaas");
  assert(character.get().name === "Vaas");
});

Deno.test("Set ability score", () => {
  character.setAbilityBase("strength", 12);
  const state = character.get();

  assert(state.abilities.get("strength") === 12);
  assert(state.saves.get("strength") === 1);
});

Deno.test("Add class", () => {
  assert(character.get().level === 0);
  character.addClass("ranger").setClassLevel("ranger", 10);
  assert(character.get().level === 10);
  assert(character.get().classes.has("ranger"));
});
