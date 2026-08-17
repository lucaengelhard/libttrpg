import { getFromNodePath } from "./lib/nodepath.ts";
import { printNode } from "./lib/utils.ts";
import { createLibrary, load } from "./system/library.ts";

const tree = await load("./examples/index.json");
const { createCharacter } = createLibrary(tree);

const char = createCharacter()
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
  ).setChoice(
    "root_/_multiple_/_class@ranger#3_/_multiple_/_choose@primeval_primal_awareness",
    "Primal Awareness",
  );

console.log(char.get().resources);

char.setClassLevel("ranger", 3);
console.log(char.get().resources);

char.setClassLevel("ranger", 2);
console.log(char.get().resources);

//console.log(printNode(char.get().tree));
