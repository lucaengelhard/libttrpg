import { add, getModifier } from "../lib/utils.ts";

type Vertex<T> = {
  value: T;
  reduce: (a: T, b: T) => T;
};

type Edge<F, T> = {
  from: Vertex<F>;
  to: Vertex<T>;
  transform: (value: F) => T;
};

type Graph = {
  vertices: Set<Vertex<any>>;
  edges: Set<Edge<any, any>>;
};

function id<T>(a: T) {
  return a;
}

function adjacency(graph: Graph) {
  const result = new Map<
    Vertex<unknown>,
    Set<{ to: Vertex<unknown>; transform: (value: unknown) => unknown }>
  >();

  for (const edge of graph.edges) {
    const set = result.getOrInsert(edge.from, new Set());
    set.add({ to: edge.to, transform: edge.transform });
  }

  return result;
}

function sort(graph: Graph) {
  const adjacencyMatrix = adjacency(graph);
  const status = new Map<
    Vertex<unknown>,
    "NOT_VISITED" | "IN_PROGRESS" | "FINISHED"
  >(
    graph.vertices.values().map((v) => [v, "NOT_VISITED"]),
  );

  const sorted: Vertex<unknown>[] = [];

  for (const v of graph.vertices) {
    if (status.get(v) !== "NOT_VISITED") continue;
    visit(v);
  }

  return sorted.reverse();

  function visit(vertex: Vertex<unknown>) {
    if (status.get(vertex) === "FINISHED") return;
    if (status.get(vertex) === "IN_PROGRESS") throw "Cycle detected";

    status.set(vertex, "IN_PROGRESS");

    for (const v of adjacencyMatrix.get(vertex) ?? new Set()) {
      visit(v.to);
    }

    status.set(vertex, "FINISHED");
    sorted.push(vertex);
  }
}

function resolve(graph: Graph) {
  const adjacencyMatrix = adjacency(graph);
  const sorted = sort(graph);
  const resolvedValues = new Map(
    graph.vertices.values().map((v) => [v, new Set<any>()]),
  );

  const result = new Map<Vertex<unknown>, any>();

  for (const vertex of sorted) {
    const parentValue = reduceParents(
      resolvedValues.get(vertex),
      vertex.reduce,
    );
    const value = parentValue === undefined
      ? vertex.value
      : vertex.reduce(vertex.value, parentValue);

    result.set(vertex, value);

    for (const child of adjacencyMatrix.get(vertex) ?? new Set()) {
      const set = resolvedValues.getOrInsert(child.to, new Set());
      set.add(child.transform(value));
    }
  }

  return result;

  function reduceParents<T>(
    parents: Set<T> | undefined,
    reduce: (a: T, b: T) => T,
  ): T | undefined {
    if (parents === undefined || parents.size === 0) return;
    if (parents.size === 1) return parents.values().toArray()[0];

    return parents.values().reduce(reduce);
  }
}

const wisdom: Vertex<number> = { value: 12, reduce: add };
const wisdomMod: Vertex<number> = { value: 0, reduce: add };

const wisdomModBonus: Vertex<number> = { value: 3, reduce: add };

const character: Graph = {
  edges: new Set([
    {
      from: wisdom,
      to: wisdomMod,
      transform: getModifier,
    },
    { from: wisdomModBonus, to: wisdomMod, transform: id },
  ]),
  vertices: new Set([wisdom, wisdomMod, wisdomModBonus]),
};

console.log(resolve(character));
