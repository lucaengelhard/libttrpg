import { Edge, GraphBuilder, Vertex } from "../../lib/graph.ts";
import {
  binop,
  type Choice,
  getBinopValue,
  isBinopValue,
  NEUTRAL,
  type Node,
  type Resolvable,
  unaryop,
  unwrapBinopValue,
  type VertexValue,
} from "./nodes.ts";
import { desugar, type Root } from "./sugar.ts";

export function parseTree(tree: Root) {
  const values = new Map<string, Vertex<VertexValue, VertexValue>>();
  const queries = new Map<string, Vertex<VertexValue, VertexValue>[]>();
  const choices = new Map<
    string,
    { choice: Choice; vertex: Vertex<VertexValue, VertexValue> }
  >();

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

  return { values: builder.getNamed(), choices };

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
      case "QUERY": {
        // TODO
        break;
      }
      case "CHOICE": {
        const parent = resolveValue(node.count);
        const countVertex = ValueVertex(`choices.${node.name}`);

        builder.addVertex(countVertex);
        builder.addEdge(Edge(parent, countVertex));

        choices.set(node.name, { choice: node, vertex: countVertex });

        Object.values(node.selected).forEach(traverse);

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
