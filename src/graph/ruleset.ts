import type { Root } from "./sugar.ts";
import { type Node, parseTree } from "./tree.ts";

function Ruleset(
  definitions: Root["definitions"],
  init: Node[],
) {
  const base: Root = {
    type: "ROOT",
    definitions: [...definitions],
    entry: { type: "MULTIPLE", values: [...init] },
  };

  return {
    create(bindings: Record<string, any>): Root {
      const bindingMap = new Map<string, Record<string, any>>();
      for (const [name, value] of Object.entries(bindings)) {
        const [definition, identifier] = name.split(".");
        if (identifier === undefined) continue;
        const def = bindingMap.getOrInsert(definition, {});
        def[identifier] = value;
      }

      return { ...base, entry: apply(structuredClone(base.entry) as Node) };
      function apply<N extends Node>(node: N): N {
        switch (node.type) {
          case "APPLY": {
            return {
              ...node,
              bindings: {
                ...node.bindings,
                ...bindingMap.get(node.name) ?? {},
              },
            };
          }
          case "MULTIPLE":
            return { ...node, values: node.values.map(apply) };
          case "MODIFIER":
          case "OVERRIDE":
          case "BINOP":
          case "UNARYOP":
          case "VALUE":
            return node;
        }
      }
    },
  };
}

const rules = Ruleset([{
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
}], [{ type: "APPLY", name: "skills", bindings: {} }, {
  type: "APPLY",
  name: "abilities",
  bindings: {},
}]);

const char = rules.create({
  "abilities.strength": 12,
  "abilities.dexterity": 16,
  "abilities.constitution": 14,
  "abilities.intelligence": 13,
  "abilities.wisdom": 14,
  "abilities.charisma": 10,
});

console.log(parseTree(char));

/*
const ruleset: Root = {
  type: "ROOT",
  definitions: [{
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
  }],
  entry: {
    type: "MULTIPLE",
    values: [{ type: "APPLY", name: "skills", bindings: {} }, {
      type: "APPLY",
      name: "abilities",
      bindings: {
        strength: 12,
        dexterity: 16,
        constitution: 14,
        intelligence: 13,
        wisdom: 14,
        charisma: 10,
      },
    }],
  },
};

console.log(parseTree(ruleset));

const tree: Node = {
  type: "MULTIPLE",
  values: [
    {
      type: "VALUE",
      name: "skills.perception",
      value: {
        type: "UNARYOP",
        kind: "FLOOR",
        value: {
          type: "BINOP",
          kind: "DIVIDE",
          left: {
            type: "BINOP",
            kind: "SUBTRACT",
            left: { type: "VALUE", value: "abilities.wisdom" },
            right: { type: "VALUE", value: 10 },
          },
          right: { type: "VALUE", value: 2 },
        },
      },
    },
    {
      type: "VALUE",
      name: "abilities.wisdom",
      value: 14,
    },
    {
      type: "APPLY",
      name: "proficiency",
      bindings: { target: "skills.perception", value: 2 },
    },
    { type: "VALUE", name: "classlevels.ranger", value: 3 },
    {
      type: "VALUE",
      name: "classlevels.druid",
      value: 2,
    },
    {
      type: "VALUE",
      name: "stats.level",
      value: {
        type: "BINOP",
        kind: "ADD",
        left: { type: "VALUE", value: "classlevels.ranger" },
        right: { type: "VALUE", value: "classlevels.druid" },
      },
    },
    {
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
  ],
};
 */
