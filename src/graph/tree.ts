import { add, id } from "../lib/utils.ts";
import { Edge, GraphBuilder, Vertex } from "./graph.ts";

type Value = {
  type: "VALUE";
};

const tree = {
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
    value: 12,
  }],
};

const values = new Map<string, Vertex<number>>();
const builder = GraphBuilder();

function traverse(node) {
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

function resolveValue(node): Vertex<number> {
  switch (node.type) {
    case "VALUE": {
      if (typeof node.value === "number") {
        const vertex = Vertex(node.value, add, node.name);
        builder.addVertex(vertex);
        if (node.name !== undefined) {
          const existing = values.getOrInsert(node.name, vertex);
          existing.value = node.value;
        }
        return vertex;
      }

      if (typeof node.value === "string") {
        const parent = values.getOrInsert(
          node.value,
          Vertex(0, add, node.value),
        );
        const vertex = Vertex(0, add, node.name);
        builder.addEdge(Edge(parent, vertex, id));

        return vertex;
      }

      return resolveValue(node.value);
    }

    case "BINOP": {
      const left = resolveValue(node.left);
      const right = resolveValue(node.right);

      const vertex = Vertex(0, (a, b) => binop(node.kind, a, b));

      builder.addEdge(Edge(left, vertex, id));
      builder.addEdge(Edge(right, vertex, id));

      return vertex;
    }
  }
}

function binop(kind: BinopKind, a: number, b: number): number {
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

traverse(tree);
/* console.log(values); */
/* console.log(builder.resolve()); */
//builder.log();
