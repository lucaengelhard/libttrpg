import { id } from "../lib/utils.ts";

export type Vertex<T> = {
  value: T;
  name?: string;
  reduce: (a: T, b: T) => T;
};

export function Vertex<T>(
  value: T,
  reduce: Vertex<T>["reduce"] = id,
  name?: string,
): Vertex<T> {
  return { value, reduce, name };
}

export type Edge<F, T> = {
  from: Vertex<F>;
  to: Vertex<T>;
  transform: (value: F) => T;
};

export function Edge<F, T>(
  from: Vertex<F>,
  to: Vertex<T>,
  transform: Edge<F, T>["transform"],
): Edge<F, T> {
  return { from, to, transform };
}

type Graph = {
  vertices: Set<Vertex<any>>;
  edges: Set<Edge<any, any>>;
};

export function GraphBuilder() {
  const graph: Graph = { vertices: new Set(), edges: new Set() };

  return {
    addVertex(vertex: Vertex<any>) {
      graph.vertices.add(vertex);
    },
    addEdge(edge: Edge<any, any>) {
      graph.edges.add(edge);
    },
    resolve() {
      return resolve(graph);
    },
    log() {
      console.log(graph);
    },
  };
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

/* const rangerLevel = Vertex(3);
const druidLevel = Vertex(2);

const level = Vertex(0, add);

const proficiencyBonus = Vertex(0, add);

const wisdom = Vertex(12, add);
const perception = Vertex(0, add);

const character: Graph = {
  edges: new Set([
    Edge(wisdom, perception, getModifier),
    Edge(rangerLevel, level, id),
    Edge(druidLevel, level, id),
    Edge(level, proficiencyBonus, getProficiencyBonus),
    Edge(proficiencyBonus, perception, id),
  ]),
  vertices: new Set([
    wisdom,
    perception,
    rangerLevel,
    druidLevel,
    level,
    proficiencyBonus,
  ]),
};
 */
