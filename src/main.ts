import { getFromNodePath } from "./lib/nodepath.ts";
import { printNode } from "./lib/utils.ts";
import { createLibrary, load } from "./system/library.ts";

const tree = await load("./examples/index.json");
/*const { createCharacter } = createLibrary(tree);

const char = createCharacter()
  .setName("Vaas")
  .setAbilityBase("strength", 12)
  .setAbilityBase("dexterity", 15)
  .setAbilityBase("constitution", 14)
  .setAbilityBase("intelligence", 13)
  .setAbilityBase("wisdom", 13)
  .setAbilityBase("charisma", 8)
  .addClass("ranger")
  .setClassLevel("ranger", 10)
  .setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_choose@natural_deft_explorer",
    "Deft Explorer",
  )
  .setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_choose@favored_enemy",
    "Favored Enemy",
  ).setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_choose@favored_enemy_/_multiple_/_feat@favored enemy#1_/_multiple_/_choose@favored_enemy_creature",
    "humanoid",
  ).setChoice(
    "root_/_multiple_/_class@ranger#3_/_multiple_/_choose@primeval_primal_awareness",
    "Primal Awareness",
  ).setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_feat@proficiencies#1_/_proficiency_/_choose",
    "Nature",
  ).setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_feat@proficiencies#1_/_proficiency_/_choose",
    "Insight",
  ).setChoice(
    "root_/_multiple_/_class@ranger#1_/_multiple_/_feat@proficiencies#1_/_proficiency_/_choose",
    "perception",
  )
  .setOption(
    "root_/_multiple_/_class@ranger#2_/_multiple_/_optional@additional ranger spells",
    true,
  ).setOption(
    "root_/_multiple_/_class@ranger#2_/_multiple_/_optional@spellcasting focus",
    true,
  ).setOption(
    "root_/_multiple_/_class@ranger#4_/_optional@martial versatility",
    true,
  );

char.get(); */

//console.log(char.get().skills);
