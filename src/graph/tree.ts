import { id } from "../lib/utils.ts";
import { Edge, GraphBuilder, Vertex } from "./graph.ts";

type Multiple = {
  type: "MULTIPLE";
  values: Node[];
};

type Value = {
  type: "VALUE";
  name?: string;
  value: number | string | BinOp;
};

type BinOp = {
  type: "BINOP";
  kind: BinopKind;
  left: Value | BinOp;
  right: Value | BinOp;
};
type BinopKind = "DIVIDE" | "SUBTRACT" | "ADD" | "MULTIPLY";

type Node = Multiple | Value | BinOp;

const NEUTRAL = Symbol("Neutral");
type Neutral = typeof NEUTRAL;
type Num = number | Neutral;

const values = new Map<string, Vertex<any, Num>>();
const builder = GraphBuilder();

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
  }
}

function resolveValue(node: Value | BinOp): Vertex<any, Num> {
  switch (node.type) {
    case "VALUE": {
      let vertex = node.name !== undefined ? values.get(node.name) : undefined;

      if (typeof node.value === "number") {
        vertex = vertex ||
          Vertex(node.value, node.name !== undefined ? add : id, node.name);
        vertex.value = node.value;
      }

      if (typeof node.value === "string") {
        const parent = values.getOrInsert(
          node.value,
          Vertex(NEUTRAL, add, node.value),
        );

        vertex = vertex || Vertex(NEUTRAL, add, node.name);
        builder.addEdge(Edge(parent, vertex));
      }

      if (typeof node.value === "object") {
        const value = resolveValue(node.value);
        vertex = vertex || Vertex(NEUTRAL, add, node.name);
        builder.addEdge(Edge(value, vertex));
      }

      if (!vertex) {
        vertex = Vertex(NEUTRAL, add, node.name);
      }

      builder.addVertex(vertex);
      if (node.name !== undefined) values.set(node.name, vertex);

      return vertex;
    }

    case "BINOP": {
      const left = resolveValue(node.left);
      const right = resolveValue(node.right);

      const vertex = Vertex<{ left: Num } | { right: Num } | Neutral, Num>(
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
      builder.addEdge(Edge(left, vertex, (value) => ({ left: value as Num })));
      builder.addEdge(
        Edge(right, vertex, (value) => ({ right: value as Num })),
      );

      return vertex as Vertex<unknown, Num>;
    }
  }
}

function add(a: Num, b: Num) {
  return binop("ADD", a, b);
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

const tree: Node = {
  type: "MULTIPLE",
  values: [{
    type: "VALUE",
    name: "skills.perception",
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
  }, {
    type: "VALUE",
    name: "abilities.wisdom",
    value: 14,
  }],
};

traverse(tree);
/* console.log(values); */
/* builder.log(); */
console.log(builder.resolve());
