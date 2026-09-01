export type Vertex<InputType, OutPutType> = {
  value: InputType;
  name?: string;
  reduce: (a: InputType, b: InputType) => OutPutType;
  overrideSelector?: (arr: InputType[]) => InputType;
};

export function Vertex<InputType, OutPutType>(
  name: string | undefined,
  value: InputType,
  reduce: Vertex<InputType, OutPutType>["reduce"],
  overrideSelector?: Vertex<InputType, OutPutType>["overrideSelector"],
): Vertex<InputType, OutPutType> {
  return { name, value, reduce, overrideSelector };
}

export type Edge<F, T> = {
  from: Vertex<unknown, F>;
  to: Vertex<T, unknown>;
  transform?: (value: F) => T;
  override?: boolean;
};

export function Edge<F, T>(
  from: Vertex<unknown, F>,
  to: Vertex<T, unknown>,
  transform?: Edge<F, T>["transform"],
  override?: boolean,
): Edge<F, T> {
  return { from, to, transform, override };
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
    getNamed() {
      return new Map(
        this.resolve().entries().filter(([vertex]) => vertex.name !== undefined)
          .map(([vertex, value]) => [vertex.name, value]),
      );
    },
    render() {
      render(graph);
    },
  };
}

function adjacency(graph: Graph) {
  const result = new Map<
    Vertex<unknown, unknown>,
    Set<Edge<unknown, unknown>>
  >();

  for (const edge of graph.edges) {
    const set = result.getOrInsert(edge.from, new Set());
    set.add(edge);
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

    for (const edge of adjacencyMatrix.get(vertex) ?? new Set()) {
      visit(edge.to);
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
  const overrides = new Map<Vertex<unknown, unknown>, any[]>();

  const result = new Map<Vertex<unknown, unknown>, any>();

  for (const vertex of sorted) {
    const parentValue = reduceParents(
      resolvedValues.get(vertex),
      vertex.reduce,
    );

    const override = overrides.get(vertex);
    const overrideValue = override !== undefined && override.length > 0
      ? vertex.overrideSelector
        ? vertex.overrideSelector(override)
        : override[0]
      : undefined;

    const value = overrideValue !== undefined
      ? overrideValue
      : parentValue === undefined
      ? vertex.value
      : vertex.reduce(vertex.value, parentValue);

    result.set(vertex, value);

    for (const edge of adjacencyMatrix.get(vertex) ?? []) {
      const values = resolvedValues.getOrInsert(edge.to, []);
      const transformedValue = edge.transform ? edge.transform(value) : value;
      if (edge.override) {
        const existingOverrides = overrides.getOrInsert(edge.to, []);
        existingOverrides.push(transformedValue);
      }

      values.push(transformedValue);
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

function render(graph: Graph) {
  // TODO
}
