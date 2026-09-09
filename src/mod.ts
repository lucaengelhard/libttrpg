import { Node, parse } from "./system/node.ts";
import { desugar, WithSugar } from "./system/sugar.ts";

const tree: WithSugar<Node> = {
  type: "MULTIPLE",
  values: [
    {
      type: "SECTION",
      name: "Base Stats",
      value: {
        type: "COLLECTION",
        base: {
          strength: 12,
          dexterity: 15,
          constitution: 14,
          intelligence: 13,
          wisdom: 13,
          charisma: 8,
        },
        derives: {
          skills: [
            {
              strength: ["athletics"],
              dexterity: ["acrobatics", "sleightOfHand", "stealth"],
              intelligence: [
                "arcana",
                "history",
                "investigation",
                "nature",
                "religion",
              ],
              wisdom: [
                "animalHandling",
                "insight",
                "medicine",
                "perception",
                "survival",
              ],
              charisma: [
                "deception",
                "intimidation",
                "performance",
                "persuasion",
              ],
            },
            {
              type: "UNARYOPERATION",
              kind: "FLOOR",
              value: {
                type: "BINARYOPERATION",
                kind: "DIVIDE",
                left: {
                  type: "BINARYOPERATION",
                  kind: "SUBTRACT",
                  left: { type: "QUERY", query: "$base" },
                  right: { type: "VALUE", value: 10 },
                },
                right: { type: "VALUE", value: 2 },
              },
            },
          ],
          saves: [
            {
              strength: ["strength"],
              dexterity: ["dexterity"],
              constitution: ["constitution"],
              intelligence: ["intelligence"],
              wisdom: ["wisdom"],
              charisma: ["charisma"],
            },
            {
              type: "UNARYOPERATION",
              kind: "FLOOR",
              value: {
                type: "BINARYOPERATION",
                kind: "DIVIDE",
                left: {
                  type: "BINARYOPERATION",
                  kind: "SUBTRACT",
                  left: { type: "QUERY", query: "$base" },
                  right: { type: "VALUE", value: 10 },
                },
                right: { type: "VALUE", value: 2 },
              },
            },
          ],
        },
        basePrefix: "abilities",
      },
    },
  ],
};

console.log(parse(desugar(tree)));
