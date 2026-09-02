import { Ruleset } from "./ruleset.ts";
import { Node } from "./tree/nodes.ts";
import { parseTree } from "./tree/parseTree.ts";
import { Root } from "./tree/sugar.ts";

function makeChoice(
  tree: Root,
  identifier: string,
  selection: string,
): Root {
  const { values, choices } = parseTree(tree);

  const newTree = structuredClone(tree);

  newTree.entry = traverse(newTree.entry);

  return newTree;

  function traverse<N extends Node>(node: N): N {
    switch (node.type) {
      case "CHOICE": {
        if (node.name !== identifier) {
          return {
            ...node,
            selected: Object.fromEntries(
              Object.entries(node.selected).map((
                [key, value],
              ) => [key, traverse(value)]),
            ),
          };
        }

        if (!(selection in node.options)) {
          return { ...node };
        }

        if (selection in node.selected) {
          return {
            ...node,
            selected: Object.fromEntries(
              Object.entries(node.selected).filter(([key]) =>
                key !== selection
              ),
            ),
          };
        }

        const count = (values as any).get("choices")?.get(identifier) as number;
        if (Object.keys(node.selected).length >= count) {
          const reduced = Object.fromEntries(
            Object.entries(node.selected).slice(0, count),
          );

          return { ...node, selected: reduced };
        }

        return {
          ...node,
          selected: { ...node.selected, [selection]: node.options[selection] },
        };
      }
      case "MULTIPLE":
        return { ...node, values: node.values.map(traverse) };
      case "VALUE":
      case "BINOP":
      case "UNARYOP":
      case "QUERY":
      case "MODIFIER":
      case "OVERRIDE":
      case "APPLY":
        return node;
    }
  }
}

const tree: Root = {
  type: "ROOT",
  definitions: [],
  entry: {
    type: "MULTIPLE",
    values: [
      { type: "VALUE", name: "abilities.wisdom", value: 3 },
      { type: "VALUE", name: "abilities.strength", value: 5 },
      {
        type: "CHOICE",
        name: "choice",
        count: { type: "VALUE", value: 1 },
        options: {
          wisdom: {
            type: "MODIFIER",
            target: "abilities.wisdom",
            value: { type: "VALUE", value: 2 },
          },
          strength: {
            type: "MODIFIER",
            target: "abilities.strength",
            value: { type: "VALUE", value: 2 },
          },
        },
        selected: {},
      },
    ],
  },
};

makeChoice(tree, "choice", "wisdom");
makeChoice(makeChoice(tree, "choice", "wisdom"), "choice", "strength");

/* const rules = Ruleset([{
  type: "DEFINE",
  name: "abilities",
  bindings: [
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
  ],
  definition: {
    type: "MULTIPLE",
    values: [{
      type: "VALUE",
      name: "abilities.strength",
      value: "$strength",
    }, {
      type: "VALUE",
      name: "abilities.dexterity",
      value: "$dexterity",
    }, {
      type: "VALUE",
      name: "abilities.constitution",
      value: "$constitution",
    }, {
      type: "VALUE",
      name: "abilities.intelligence",
      value: "$intelligence",
    }, {
      type: "VALUE",
      name: "abilities.wisdom",
      value: "$wisdom",
    }, {
      type: "VALUE",
      name: "abilities.charisma",
      value: "$charisma",
    }],
  },
}, {
  type: "DEFINE",
  name: "passive",
  bindings: ["from", "name"],
  definition: {
    type: "VALUE",
    name: "$name",
    value: {
      type: "BINOP",
      kind: "ADD",
      left: {
        type: "UNARYOP",
        kind: "FLOOR",
        value: {
          type: "BINOP",
          kind: "DIVIDE",
          left: {
            type: "BINOP",
            kind: "SUBTRACT",
            left: { type: "VALUE", value: "$from" },
            right: { type: "VALUE", value: 10 },
          },
          right: { type: "VALUE", value: 2 },
        },
      },
      right: { type: "VALUE", value: 10 },
    },
  },
}, {
  type: "DEFINE",
  name: "modifier",
  bindings: ["from", "name"],
  definition: {
    type: "VALUE",
    name: "$name",
    value: {
      type: "UNARYOP",
      kind: "FLOOR",
      value: {
        type: "BINOP",
        kind: "DIVIDE",
        left: {
          type: "BINOP",
          kind: "SUBTRACT",
          left: { type: "VALUE", value: "$from" },
          right: { type: "VALUE", value: 10 },
        },
        right: { type: "VALUE", value: 2 },
      },
    },
  },
}, {
  type: "DEFINE",
  name: "saves",
  bindings: [],
  definition: {
    type: "MULTIPLE",
    values: [
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.strength", name: "saves.strength" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.dexterity", name: "saves.dexterity" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: {
          from: "abilities.constitution",
          name: "saves.constitution",
        },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: {
          from: "abilities.intelligence",
          name: "saves.intelligence",
        },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.wisdom", name: "saves.wisdom" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.charisma", name: "saves.charisma" },
      },
    ],
  },
}, {
  type: "DEFINE",
  name: "skills",
  bindings: [],
  definition: {
    type: "MULTIPLE",
    values: [
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.strength", name: "skills.athletics" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.dexterity", name: "skills.acrobatics" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: {
          from: "abilities.dexterity",
          name: "skills.sleightofhand",
        },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.dexterity", name: "skills.stealth" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.intelligence", name: "skills.arcana" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.intelligence", name: "skills.history" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: {
          from: "abilities.intelligence",
          name: "skills.investigation",
        },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.intelligence", name: "skills.nature" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.intelligence", name: "skills.religion" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.wisdom", name: "skills.animalhandling" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.wisdom", name: "skills.insight" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.wisdom", name: "skills.medicine" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.wisdom", name: "skills.perception" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.wisdom", name: "skills.survival" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.charisma", name: "skills.deception" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.charisma", name: "skills.intimidation" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.charisma", name: "skills.performance" },
      },
      {
        type: "APPLY",
        name: "modifier",
        bindings: { from: "abilities.charisma", name: "skills.persuasion" },
      },
    ],
  },
}, {
  type: "DEFINE",
  name: "class",
  bindings: ["name", "level"],
  definition: {
    type: "MULTIPLE",
    values: [{ type: "VALUE", name: "$name", value: "$level" }],
  },
}, {
  type: "DEFINE",
  name: "level",
  bindings: [],
  definition: {
    type: "VALUE",
    name: "stats.level",
    value: { type: "QUERY", query: "classes" },
  },
}, {
  type: "DEFINE",
  name: "proficiencyBonus",
  bindings: [],
  definition: {
    type: "VALUE",
    name: "stats.proficiencyBonus",
    value: {
      type: "BINOP",
      kind: "ADD",
      left: { type: "VALUE", value: 1 },
      right: {
        type: "UNARYOP",
        kind: "CEIL",
        value: {
          type: "BINOP",
          kind: "DIVIDE",
          left: { type: "VALUE", value: "stats.level" },
          right: { type: "VALUE", value: 4 },
        },
      },
    },
  },
}], [
  { type: "APPLY", name: "skills", bindings: {} },
  { type: "APPLY", name: "abilities", bindings: {} },
  { type: "APPLY", name: "saves", bindings: {} },
  { type: "APPLY", name: "level", bindings: {} },
  { type: "APPLY", name: "proficiencyBonus", bindings: {} },
]);

const char = rules.create({
  "abilities.strength": 12,
  "abilities.dexterity": 16,
  "abilities.constitution": 14,
  "abilities.intelligence": 13,
  "abilities.wisdom": 14,
  "abilities.charisma": 10,
});

console.log(parseTree(char));

char.entry.values.push({
  type: "APPLY",
  name: "class",
  bindings: { name: "classes.ranger", level: 3 },
});

console.log(parseTree(char));

char.entry.values.push({
  type: "APPLY",
  name: "class",
  bindings: { name: "classes.druid", level: 4 },
});

console.log(parseTree(char)); */
