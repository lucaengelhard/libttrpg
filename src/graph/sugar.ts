import { type Define, type Node, parseTree, type Resolvable } from "./tree.ts";

// TODO: Not sure if this works correctly or if closures are relevant
function desugar(node: Node, env: Map<string, Define>): Node {
  switch (node.type) {
    case "MULTIPLE": {
      return { ...node, values: node.values.map((n) => desugar(n, env)) };
    }
    case "SCOPE": {
      const newEnv = new Map(env);

      return {
        ...node,
        definitions: node.definitions.map((d) => desugar(d, newEnv) as Define),
        entry: desugar(node.entry, newEnv),
      };
    }
    case "DEFINE": {
      const desugared = {
        ...node,
        definition: desugar(node.definition, env),
      };

      env.set(node.name, desugared);

      return desugared;
    }
    case "APPLY": {
      const definition = env.get(node.name);
      if (!definition) throw `Missing definition for: ${node.name}`;
      const bindings = new Map(definition.bindings.map(
        (identifier) => [identifier, node.bindings[identifier]] as const,
      ));

      return apply(definition.definition, bindings, env);
    }
    case "VALUE":
    case "BINOP":
    case "UNARYOP":
    case "MODIFIER":
    case "OVERRIDE":
      return node;
  }
}

function apply(
  node: Node,
  bindings: Map<string, any>,
  env: Map<string, Define>,
): Node {
  switch (node.type) {
    case "MULTIPLE": {
      return {
        ...node,
        values: node.values.map((n) => apply(n, bindings, env)),
      };
    }
    case "VALUE": {
      const value = typeof node.value === "number"
        ? node.value
        : typeof node.value === "object"
        ? apply(node.value, bindings, env)
        : get(node.value) ?? node.value;

      return { ...node, name: get(node.name) ?? node.name, value };
    }
    case "BINOP": {
      return {
        ...node,
        left: apply(node.left, bindings, env) as Resolvable,
        right: apply(node.right, bindings, env) as Resolvable,
      };
    }
    case "UNARYOP": {
      return { ...node, value: apply(node.value, bindings, env) as Resolvable };
    }
    case "OVERRIDE":
    case "MODIFIER": {
      return {
        ...node,
        value: apply(node.value, bindings, env) as Resolvable,
        target: get(node.target) ?? node.target,
      };
    }
    case "APPLY": {
      return {
        ...node,
        bindings: Object.fromEntries(
          Object.entries(node.bindings).map((
            [key, value],
          ) => [key, apply(value, bindings, env)]),
        ),
      };
    }
    case "DEFINE": {
      return node; // Shouldnt be happening right?
    }
    case "SCOPE": {
      return desugar(node, env);
    }
  }

  function get(identifier: string | undefined) {
    if (identifier === undefined || !identifier.startsWith("$")) return;
    const cleaned = identifier.replace("$", "");
    return bindings.get(cleaned);
  }
}

const tree: Node = {
  type: "SCOPE",
  definitions: [
    {
      type: "DEFINE",
      name: "modifier",
      bindings: ["name", "ability"],
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
              left: { type: "VALUE", value: "$ability" },
              right: { type: "VALUE", value: 10 },
            },
            right: { type: "VALUE", value: 2 },
          },
        },
      },
    },
    {
      type: "DEFINE",
      name: "proficiency",
      bindings: ["stat", "value"],
      definition: {
        type: "MODIFIER",
        target: "$stat",
        value: {
          type: "VALUE",
          value: {
            type: "UNARYOP",
            kind: "FLOOR",
            value: {
              type: "BINOP",
              kind: "MULTIPLY",
              left: { type: "VALUE", value: "$value" },
              right: { type: "VALUE", value: "stats.proficiencyBonus" },
            },
          },
        },
      },
    },
  ],
  entry: {
    type: "MULTIPLE",
    values: [{
      type: "VALUE",
      name: "abilities.wisdom",
      value: 14,
    }, {
      type: "APPLY",
      name: "modifier",
      bindings: { ability: "abilities.wisdom", name: "skills.perception" },
    }, {
      type: "APPLY",
      name: "proficiency",
      bindings: { stat: "skills.perception", value: 1 },
    }],
  },
};

const desugared = desugar(tree, new Map());

console.log(parseTree(desugared));
