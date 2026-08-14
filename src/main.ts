import { Character } from "./system/character.ts";
import { createLibrary } from "./system/library.ts";

export async function create(libraryEntryPoint: string) {
  const library = await createLibrary(libraryEntryPoint);

  return { createCharacter };

  function createCharacter() {
    return new Character(library);
  }
}

const dnd = await create("./examples/index.json");
const char = dnd.createCharacter()
  .addClass("ranger")
  .setName("Vaas")
  .setAbilityBase("strength", 12)
  .setAbilityBase("dexterity", 15)
  .setAbilityBase("constitution", 14)
  .setAbilityBase("intelligence", 13)
  .setAbilityBase("wisdom", 13)
  .setAbilityBase("charisma", 8)
  .setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_feat@proficiencies#1_/_proficiency_/_choose",
    "PERCEPTION",
  )
  .get();

console.log(char);
