import { recordMap } from "../lib/utils.ts";
import { Ruleset } from "./ruleset.ts";
import type { Node } from "./tree/nodes.ts";
import { parseTree } from "./tree/parseTree.ts";
import type { Root } from "./tree/sugar.ts";

type Vistor<N extends Node, A extends unknown[]> = (
  node: N,
  traverse: (
    node: Node,
    tree: ReturnType<typeof parseTree>,
    ...args: A
  ) => Node,
  tree: ReturnType<typeof parseTree>,
  ...args: A
) => N;

type Vistors<A extends unknown[]> = {
  [K in Node["type"]]: Vistor<Extract<Node, { type: K }>, A>;
};

function createNodeSetter<A extends unknown[]>(visitors: Partial<Vistors<A>>) {
  return (tree: Root, ...args: A): Root => {
    return { ...tree, entry: traverse(tree.entry, parseTree(tree), ...args) };
  };

  function traverse<N extends Node>(
    node: N,
    tree: ReturnType<typeof parseTree>,
    ...args: A
  ): N {
    const visitor: Vistor<N, A> = visitors[node.type] as unknown as Vistor<
      N,
      A
    >;

    if (visitor) return visitor(node, traverse, tree, ...args);

    switch (node.type) {
      case "MULTIPLE":
        return {
          ...node,
          values: node.values.map((n) => traverse(n, tree, ...args)),
        };
      case "CHOICE": {
        return {
          ...node,
          options: recordMap(node.options, (n) => traverse(n, tree, ...args)),
        };
      }
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

const choiceSetter = createNodeSetter<[string, string]>({
  CHOICE: (node, traverse, tree, identifier, selection) => {
    if (node.name !== identifier) {
      return {
        ...node,
        selected: recordMap(
          node.selected,
          (n) => traverse(n, tree, identifier, selection),
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
          Object.entries(node.selected).filter(([key]) => key !== selection),
        ),
      };
    }

    const count = (tree.values as any)
      .get("choices")
      ?.get(identifier) as number;

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
  },
});

export function makeChoice(tree: Root, identifier: string, selection: string) {
  return choiceSetter(tree, identifier, selection);
}

/* export function setLevel(tree: Root, identifier: string, level: number): Root {
} */

const rules = Ruleset({
  abilities: {
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
  },
  passive: {
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
  },
  modifier: {
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
  },
  saves: {
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
  },
  skills: {
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
  },
  class: {
    bindings: ["name", "level", "grants"],
    definition: {
      type: "MULTIPLE",
      values: [
        { type: "VALUE", name: "$name", value: "$level" },
        { type: "QUERY", query: "$grants" },
      ],
    },
  },
  level: {
    bindings: [],
    definition: {
      type: "VALUE",
      name: "stats.level",
      value: { type: "QUERY", query: "classes" },
    },
  },
  proficiencyBonus: {
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
  },
}, [
  { type: "APPLY", name: "skills", bindings: {} },
  { type: "APPLY", name: "abilities", bindings: {} },
  { type: "APPLY", name: "saves", bindings: {} },
  { type: "APPLY", name: "level", bindings: {} },
  { type: "APPLY", name: "proficiencyBonus", bindings: {} },
]);

const char = rules.create({
  "abilities.strength": 12,
  "abilities.dexterity": 15,
  "abilities.constitution": 14,
  "abilities.intelligence": 13,
  "abilities.wisdom": 13,
  "abilities.charisma": 8,
});

/* console.log(parseTree(char)); */

char.entry.values.push({
  type: "APPLY",
  name: "class",
  bindings: {
    name: "classes.ranger",
    level: 3,
    grants: { type: "VALUE", name: "aaaaaaaaa", value: 200 },
  },
});

console.log(parseTree(char));
