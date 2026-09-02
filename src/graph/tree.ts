import { Edge, GraphBuilder, Vertex } from "./graph.ts";
import { type Apply, desugar, type Root } from "./sugar.ts";

export type Multiple = {
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

type BinopValue =
  | { left: VertexValue }
  | { right: VertexValue }
  | Neutral;

function isBinopValue(value: unknown): value is BinopValue {
  return typeof value === "object" && value !== null &&
    ("left" in value || "right" in value);
}

function unwrapBinopValue(value: BinopValue) {
  return typeof value === "object"
    ? "left" in value ? value.left : value.right
    : value;
}

function getBinopValue(
  a: Exclude<BinopValue, Neutral>,
  b: Exclude<BinopValue, Neutral>,
  side: "left" | "right",
): VertexValue {
  return side in a
    ? a[side as keyof typeof a]
    : side in b
    ? b[side as keyof typeof b]
    : NEUTRAL;
}

function binop(kind: BinopKind, a: VertexValue, b: VertexValue): VertexValue {
  if (a === NEUTRAL) return b; // TODO: This causes unexpected behaviour, maybe case-by-case handling?
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

type UnaryOp = {
  type: "UNARYOP";
  kind: UnaryOpKind;
  value: Resolvable;
};
type UnaryOpKind = "CEIL" | "FLOOR";

function unaryop(kind: UnaryOpKind, value: VertexValue): VertexValue {
  if (value === NEUTRAL) return value;

  switch (kind) {
    case "CEIL":
      return Math.ceil(value);
    case "FLOOR":
      return Math.floor(value);
  }
}

type Query = {
  type: "QUERY";
  query: string;
};

export type Resolvable = Value | BinOp | UnaryOp | Query;
export function isResolvable(node: unknown): node is Resolvable {
  if (
    node === undefined || node === null || typeof node !== "object" ||
    !("type" in node) || typeof node.type !== "string"
  ) {
    return false;
  }

  return ["VALUE", "BINOP", "UNARYOP", "QUERY"].includes(node.type);
}

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

export type Node =
  | Multiple
  | Resolvable
  | Modifier
  | Override
  | Apply;

const NEUTRAL = Symbol("Neutral");
type Neutral = typeof NEUTRAL;

type VertexValue = number | Neutral;

export function parseTree(tree: Root) {
  const values = new Map<string, Vertex<VertexValue, VertexValue>>();
  const queries = new Map<string, Vertex<VertexValue, VertexValue>[]>();

  const builder = GraphBuilder<VertexValue>();

  traverse(desugar(tree));

  for (const [query, vertices] of queries.entries()) {
    values
      .entries()
      .filter(([name]) => name.startsWith(`${query}.`))
      .forEach(([_, vertex]) =>
        vertices.forEach((resultVertex) => {
          builder.addEdge(Edge(vertex, resultVertex));
        })
      );
  }

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
      case "APPLY":
      case "BINOP":
      case "UNARYOP": {
        throw `Unexpected node in traverse: ${node.type}`;
      }
    }
  }

  function resolveValue(node: Resolvable): Vertex<VertexValue, VertexValue> {
    switch (node.type) {
      case "VALUE": {
        let vertex = node.name !== undefined
          ? values.get(node.name)
          : undefined;

        if (typeof node.value === "number") {
          vertex = vertex || ValueVertex(node.name, node.value);
          vertex.value = node.value;
        }

        if (typeof node.value === "string") {
          const parent = values.getOrInsert(
            node.value,
            ValueVertex(node.value),
          );

          vertex = vertex || ValueVertex(node.name);
          builder.addEdge(Edge(parent, vertex));
        }

        if (typeof node.value === "object") {
          const value = resolveValue(node.value);
          vertex = vertex || ValueVertex(node.name);
          builder.addEdge(Edge(value, vertex));
        }

        if (!vertex) {
          vertex = ValueVertex(node.name);
        }

        builder.addVertex(vertex);
        if (node.name !== undefined) values.set(node.name, vertex);

        return vertex;
      }

      case "BINOP": {
        const left = resolveValue(node.left);
        const right = resolveValue(node.right);

        const result = Vertex<VertexValue, VertexValue>(
          undefined,
          NEUTRAL,
          (a, b) => {
            if (a === NEUTRAL || !isBinopValue(a)) {
              return isBinopValue(b) ? unwrapBinopValue(b) : b;
            }
            if (b === NEUTRAL || !isBinopValue(b)) {
              return unwrapBinopValue(a);
            }

            const left = getBinopValue(a, b, "left");
            const right = getBinopValue(a, b, "right");

            return binop(node.kind, left, right);
          },
        );

        builder.addVertex(result);

        builder.addEdge(Edge(left, result, (value) => ({ left: value })));
        builder.addEdge(Edge(right, result, (value) => ({ right: value })));

        return result;
      }
      case "UNARYOP": {
        const value = resolveValue(node.value);
        const vertex = Vertex<VertexValue, VertexValue>(
          undefined,
          NEUTRAL,
          (_, b) => unaryop(node.kind, b),
        );
        builder.addVertex(value);
        builder.addEdge(Edge(value, vertex));
        return vertex;
      }
      case "QUERY": {
        const resultVertex = ValueVertex(undefined);
        builder.addVertex(resultVertex);

        const vertices = queries.getOrInsert(node.query, []);
        vertices.push(resultVertex);

        return resultVertex;
      }
    }
  }

  function add(a: VertexValue, b: VertexValue) {
    return binop("ADD", a, b);
  }

  function overrideSelector(a: VertexValue[]): VertexValue {
    return Math.max(...a.filter((o) => typeof o === "number")) ?? NEUTRAL;
  }

  function ValueVertex(name: string | undefined, value: VertexValue = NEUTRAL) {
    return Vertex<VertexValue, VertexValue>(name, value, add, overrideSelector);
  }
}

/* const tree: Node = {
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

console.log(parseTree({ type: "ROOT", entry: tree, definitions: [] })); */
