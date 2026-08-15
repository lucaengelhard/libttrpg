import { getFromNodePath } from "./lib/nodepath.ts";
import { printNode } from "./lib/utils.ts";
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
  .setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_feat@proficiencies#1_/_proficiency_/_choose",
    "ATHLETICS",
  )
  .setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_feat@proficiencies#1_/_proficiency_/_choose",
    "NATURE",
  )
  .setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_feat@proficiencies#1_/_proficiency_/_choose",
    "PERCEPTION",
  )
  .setClassLevel("ranger", 10)
  .setOption(
    "root_/_multiple_/_class@ranger#2_/_multiple_/_optional@additional ranger spells",
    true,
  ).setOption(
    "root_/_multiple_/_class@ranger#2_/_multiple_/_optional@spellcasting focus",
    true,
  ).setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_choose@natural_deft_explorer",
    "Deft Explorer",
  ).setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_choose@favored_enemy",
    "Favored Enemy",
  ).setChoice(
    "root_/_multiple_/_class@ranger#3_/_multiple_/_feat@ranger archetype#3_/_choose",
    "Beast Master",
  );

char.get();
//console.log(char.get());

//console.log(printNode(char.get().tree));
