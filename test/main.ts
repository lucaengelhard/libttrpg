import { assert, assertEquals } from "@std/assert";
import { createLibrary } from "../src/system/library.ts";
import type { Node } from "../src/system/tree/types.ts";
import { abilitySkillMock, classMock, combineMocks } from "./mocks.ts";
import { Character } from "../src/system/character.ts";

function createTestCharacter(mock: Node = { type: "MULTIPLE", values: [] }) {
  const { createCharacter } = createLibrary(mock);
  return createCharacter!();
}

/* Deno.test("Set name", () => {
  const character = createTestCharacter();
  character.setName("Vaas");
  assertEquals(character.name, "Vaas");
});

Deno.test("Set ability score", () => {
  const character = createTestCharacter(abilitySkillMock);
  character.setAbilityBase("strength", 12);

  assertEquals(character.abilities.get("strength"), 12);
  assertEquals(character.saves.get("strength"), 1);
});

Deno.test("Calculate skill value", () => {
  const character = createTestCharacter(abilitySkillMock);
  character.setAbilityBase("strength", 12);
  assertEquals(character.skills.get("athletics"), 1);

  character.setAbilityBase("strength", 8);
  assertEquals(character.skills.get("athletics"), -1);
});
 */
Deno.test("Add class", () => {
  const character = createTestCharacter(
    combineMocks(abilitySkillMock, classMock),
  );
  assertEquals(character.level, 0);

  character.addClass("mocked");
  assert(character.classes.has("mocked"));

  character.setClassLevel("mocked", 10);
  assertEquals(character.level, 10);
});

/* Deno.test("Serialize and restore", () => {
  const mock = combineMocks(abilitySkillMock, classMock);
  const { library } = createLibrary(mock);
  assert(library);
  const character = createTestCharacter(mock);
  character.setName("Vaas");
  character.addClass("mocked");
  character.setClassLevel("mocked", 10);

  const serializable = character.getSerializeable();
  console.log("RESTORE");

  const restored = Character.fromSerializable(library, serializable);
  assert(restored);
  assertEquals(restored.name, character.name);
  assertEquals(restored.abilities, character.abilities);

  console.log(restored.classes);

  //assertEquals(restored.classes, character.classes);
});
 */
