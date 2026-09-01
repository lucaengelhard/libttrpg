import { id } from "../lib/utils.ts";
import { Edge, GraphBuilder, Vertex } from "./graph.ts";

type Multiple = {
  type: "MULTIPLE";
  values: Node[];
};

type Value = {
  type: "VALUE";
  name?: string;
  value: number | string | Resolvable;
};

type BinOp = {
  type: "BINOP";
  kind: BinopKind;
  left: Resolvable;
  right: Resolvable;
};
type BinopKind = "DIVIDE" | "SUBTRACT" | "ADD" | "MULTIPLY";

type UnaryOp = {
  type: "UNARYOP";
  kind: UnaryOpKind;
  value: Resolvable;
};
type UnaryOpKind = "CEIL" | "FLOOR";
type Resolvable = Value | BinOp | UnaryOp;

type Modifier = {
  type: "MODIFIER";
  target: string;
  value: Resolvable;
};

type Override = {
  type: "OVERRIDE";
  target: string;
  value: Resolvable;
  // TODO: condition
};

type Node = Multiple | Resolvable | Modifier | Override;

const NEUTRAL = Symbol("Neutral");
type Neutral = typeof NEUTRAL;
type Num = number | Neutral;

function parseTree(tree: Node) {
  const values = new Map<string, Vertex<any, Num>>();
  const builder = GraphBuilder();

  traverse(tree);

  return builder.getNamed();

  function traverse(node: Node) {
    switch (node.type) {
      case "MULTIPLE": {
        for (const value of node.values) {
          traverse(value);
        }
        break;
      }
      case "VALUE": {
        resolveValue(node);
        break;
      }
      case "MODIFIER": {
        const target = values.get(node.target); // TODO protect library  gets
        if (target === undefined) break;
        const value = resolveValue(node.value);

        builder.addEdge(Edge(value, target));

        break;
      }
      case "OVERRIDE": {
        const target = values.get(node.target); // TODO protect library  gets
        if (target === undefined) break;
        const value = resolveValue(node.value);

        builder.addEdge(Edge(value, target, undefined, true));

        break;
      }
      case "BINOP":
      case "UNARYOP": {
        throw `Unexpected node in traverse: ${node.type}`;
      }
    }
  }

  function resolveValue(node: Resolvable): Vertex<any, Num> {
    switch (node.type) {
      case "VALUE": {
        let vertex = node.name !== undefined
          ? values.get(node.name)
          : undefined;

        if (typeof node.value === "number") {
          vertex = vertex || NumVertex(node.name, node.value);
          vertex.value = node.value;
        }

        if (typeof node.value === "string") {
          const parent = values.getOrInsert(
            node.value,
            NumVertex(node.value),
          );

          vertex = vertex || NumVertex(node.name);
          builder.addEdge(Edge(parent, vertex));
        }

        if (typeof node.value === "object") {
          const value = resolveValue(node.value);
          vertex = vertex || NumVertex(node.name);
          builder.addEdge(Edge(value, vertex));
        }

        if (!vertex) {
          vertex = NumVertex(node.name);
        }

        builder.addVertex(vertex);
        if (node.name !== undefined) values.set(node.name, vertex);

        return vertex;
      }

      case "BINOP": {
        const left = resolveValue(node.left);
        const right = resolveValue(node.right);

        const vertex = Vertex<{ left: Num } | { right: Num } | Neutral, Num>(
          undefined,
          NEUTRAL,
          (a, b) => {
            if (a === NEUTRAL) {
              return typeof b === "object" ? "left" in b ? b.left : b.right : b;
            }

            if (b === NEUTRAL) return "left" in a ? a.left : a.right;

            const left = "left" in a ? a.left : "left" in b ? b.left : NEUTRAL;
            const right = "right" in a
              ? a.right
              : "right" in b
              ? b.right
              : NEUTRAL;

            return binop(node.kind, left, right);
          },
        );

        builder.addVertex(vertex);
        builder.addEdge(
          Edge(left, vertex, (value) => ({ left: value as Num })),
        );
        builder.addEdge(
          Edge(right, vertex, (value) => ({ right: value as Num })),
        );

        return vertex;
      }
      case "UNARYOP": {
        const value = resolveValue(node.value);
        const vertex = Vertex<Num, Num>(
          undefined,
          NEUTRAL,
          (_, b) => unaryop(node.kind, b),
        );
        builder.addVertex(value);
        builder.addEdge(Edge(value, vertex));
        return vertex;
      }
    }
  }

  function binop(kind: BinopKind, a: Num, b: Num): Num {
    if (a === NEUTRAL) return b;
    if (b === NEUTRAL) return a;
    switch (kind) {
      case "DIVIDE":
        return a / b;
      case "SUBTRACT":
        return a - b;
      case "ADD":
        return a + b;
      case "MULTIPLY":
        return a * b;
    }
  }

  function unaryop(kind: UnaryOpKind, value: Num): Num {
    if (value === NEUTRAL) return value;

    switch (kind) {
      case "CEIL":
        return Math.ceil(value);
      case "FLOOR":
        return Math.floor(value);
    }
  }

  function add(a: Num, b: Num) {
    return binop("ADD", a, b);
  }

  function overrideSelector(a: Num[]): Num {
    return Math.max(...a.filter((o) => o !== NEUTRAL)) ?? NEUTRAL;
  }

  function NumVertex(name: string | undefined, value: Num = NEUTRAL) {
    return Vertex(name, value, add, overrideSelector);
  }
}

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
    { type: "VALUE", name: "classlevels.ranger", value: 3 },
    { type: "VALUE", name: "classlevels.druid", value: 2 },
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
    {
      type: "MODIFIER",
      target: "skills.perception",
      value: {
        type: "VALUE",
        value: {
          type: "UNARYOP",
          kind: "FLOOR",
          value: {
            type: "BINOP",
            kind: "MULTIPLY",
            left: { type: "VALUE", value: 0.5 },
            right: { type: "VALUE", value: "stats.proficiencyBonus" },
          },
        },
      },
    },
    {
      type: "OVERRIDE",
      target: "abilities.wisdom",
      value: { type: "VALUE", value: 20 },
    },
    {
      type: "OVERRIDE",
      target: "abilities.wisdom",
      value: { type: "VALUE", value: 12 },
    },
  ],
};

console.log(parseTree(tree));
