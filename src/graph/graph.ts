export type Vertex<InputType, OutPutType> = {
  value: InputType;
  name?: string;
  reduce: (a: InputType, b: InputType) => OutPutType;
};

export function Vertex<InputType, OutPutType>(
  value: InputType,
  reduce: Vertex<InputType, OutPutType>["reduce"],
  name?: string,
): Vertex<InputType, OutPutType> {
  return { value, reduce, name };
}

export type Edge<F, T> = {
  from: Vertex<unknown, F>;
  to: Vertex<T, unknown>;
  transform?: (value: F) => T;
};

export function Edge<F, T>(
  from: Vertex<unknown, F>,
  to: Vertex<T, unknown>,
  transform?: Edge<F, T>["transform"],
): Edge<F, T> {
  return { from, to, transform };
}

type Graph = {
  vertices: Set<Vertex<any, any>>;
  edges: Set<Edge<any, any>>;
};

export function GraphBuilder() {
  const graph: Graph = { vertices: new Set(), edges: new Set() };

  return {
    addVertex(vertex: Vertex<any, any>) {
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
    Vertex<unknown, unknown>,
    Set<
      { to: Vertex<unknown, unknown>; transform?: (value: unknown) => unknown }
    >
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
    Vertex<unknown, unknown>,
    "NOT_VISITED" | "IN_PROGRESS" | "FINISHED"
  >(
    graph.vertices.values().map((v) => [v, "NOT_VISITED"]),
  );

  const sorted: Vertex<unknown, unknown>[] = [];

  for (const v of graph.vertices) {
    if (status.get(v) !== "NOT_VISITED") continue;
    visit(v);
  }

  return sorted.reverse();

  function visit(vertex: Vertex<unknown, unknown>) {
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
    graph.vertices.values().map((v) => [v, [] as any[]]),
  );

  const result = new Map<Vertex<unknown, unknown>, any>();

  for (const vertex of sorted) {
    const parentValue = reduceParents(
      resolvedValues.get(vertex),
      vertex.reduce,
    );
    const value = parentValue === undefined
      ? vertex.value
      : vertex.reduce(vertex.value, parentValue);

    result.set(vertex, value);

    for (const child of adjacencyMatrix.get(vertex) ?? []) {
      const arr = resolvedValues.getOrInsert(child.to, []);
      arr.push(child.transform ? child.transform(value) : value);
    }
  }

  return result;

  function reduceParents<T>(
    parents: T[] | undefined,
    reduce: (a: T, b: T) => T,
  ): T | undefined {
    if (parents === undefined || parents.length === 0) return;
    if (parents.length === 1) return parents.values().toArray()[0];

    return parents.reduce(reduce);
  }
}
