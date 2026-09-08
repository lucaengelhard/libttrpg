import deepEqual from "deep-equal";

import type { Tag } from "./tag.ts";

export type Vertex<
  Input extends Tag = Tag,
  Output extends Tag = Tag,
> = {
  expects: Input["$tag"] | Input["$tag"][];
  value?: Input;
  reduce: (values: Input["$value"][]) => Output;
  overrideSelector?: (
    overrideValues: Input["$value"][],
    parentValues: Input["$value"][],
  ) => Output;
};

export function Vertex<Input extends Tag, Output extends Tag>(
  value: Input | Input["$tag"] | Input["$tag"][],
  reduce: (values: Input["$value"][]) => Output,
  overrideSelector?: (
    overrideValues: Input["$value"][],
    parentValues: Input["$value"][],
  ) => Output,
): Vertex<Input, Output> {
  return {
    value: typeof value === "object" && !Array.isArray(value)
      ? value
      : undefined,
    reduce,
    expects: typeof value === "string" || Array.isArray(value)
      ? value
      : (value as Input).$tag,
    overrideSelector,
  };
}

export type Edge<Value extends Tag = Tag> = {
  from: Vertex<Tag, Value>;
  to: Vertex<Value, Tag>;
  override?: boolean;
};

export function Edge<Value extends Tag = Tag>(
  from: Vertex<Tag, Value>,
  to: Vertex<Value, Tag>,
  override?: boolean,
) {
  return { from, to, override };
}

type Graph = {
  vertices: Set<Vertex>;
  edges: Set<Edge>;
};

export function GraphBuilder() {
  const graph: Graph = { vertices: new Set(), edges: new Set() };

  return {
    addVertex(vertex: Vertex) {
      graph.vertices.add(vertex);
    },
    addEdge(edge: Edge) {
      graph.edges.add(edge);
    },
    resolve() {
      return resolve(graph);
    },
    graph() {
      return graph;
    },
  };
}

function adjacency(graph: Graph, parents?: boolean) {
  const result = new Map<Vertex, Set<Edge>>();

  for (const edge of graph.edges) {
    const set = result.getOrInsert(parents ? edge.to : edge.from, new Set());
    set.add(edge);
  }

  return (vertex: Vertex) => result.get(vertex) ?? new Set();
}

function componentAdjacency(
  adj: ReturnType<typeof adjacency>,
  components: Set<Set<Vertex>>,
) {
  const result = new Map<Set<Vertex>, Set<Set<Vertex>>>();

  for (const component of components) {
    for (const vertex of component) {
      for (const edge of adj(vertex)) {
        if (component.has(edge.to)) continue;
        const toComp = components.values().find((c) => c.has(edge.to));
        if (!toComp) continue;
        const set = result.getOrInsert(component, new Set());
        set.add(toComp);
      }
    }
  }

  return (component: Set<Vertex>) => result.get(component) ?? new Set();
}

function scc(graph: Graph) {
  const adj = adjacency(graph);

  const components = new Set<Set<Vertex>>();

  let index = 0;
  const stack: Vertex[] = [];

  const indexMap = new Map<Vertex, number>();
  const lowlinkMap = new Map<Vertex, number>();
  const onStackMap = new Map<Vertex, boolean>();

  for (const vertex of graph.vertices) {
    if (indexMap.has(vertex)) continue;
    strongconnect(vertex);
  }

  return components;

  function strongconnect(vertex: Vertex) {
    indexMap.set(vertex, index);
    lowlinkMap.set(vertex, index);
    index++;
    stack.push(vertex);
    onStackMap.set(vertex, true);

    for (const edge of adj(vertex)) {
      if (!indexMap.has(edge.to)) {
        strongconnect(edge.to);
        lowlinkMap.set(
          vertex,
          Math.min(
            lowlinkMap.get(vertex) ?? Number.MAX_SAFE_INTEGER,
            lowlinkMap.get(edge.to) ?? Number.MAX_SAFE_INTEGER,
          ),
        );
      } else if (onStackMap.get(edge.to)) {
        lowlinkMap.set(
          vertex,
          Math.min(
            lowlinkMap.get(vertex) ?? Number.MAX_SAFE_INTEGER,
            indexMap.get(edge.to) ?? Number.MAX_SAFE_INTEGER,
          ),
        );
      }
    }

    if (lowlinkMap.get(vertex) === indexMap.get(vertex)) {
      const component = new Set<Vertex>();

      let current: Vertex | undefined;
      do {
        current = stack.pop();
        if (current) {
          onStackMap.set(current, false);
          component.add(current);
        }
      } while (current !== vertex);

      components.add(component);
    }
  }
}

function sort(
  components: Set<Set<Vertex>>,
  componentAdj: ReturnType<typeof componentAdjacency>,
) {
  const status = new Map<
    Set<Vertex>,
    "NOT_VISITED" | "IN_PROGRESS" | "FINISHED"
  >(components.values().map((c) => [c, "NOT_VISITED"]));

  const sorted: Set<Vertex>[] = [];

  for (const component of components) {
    if (status.get(component) !== "NOT_VISITED") continue;
    visit(component);
  }

  return sorted.reverse();

  function visit(component: Set<Vertex>) {
    if (
      status.get(component) === "FINISHED" ||
      status.get(component) === "IN_PROGRESS" // Does this ever happen?
    ) return;

    status.set(component, "IN_PROGRESS");

    for (const toComp of componentAdj(component)) {
      visit(toComp);
    }

    status.set(component, "FINISHED");
    sorted.push(component);
  }
}

const DEFAULT_MAX_ITERATIONS = 999;
function resolve(graph: Graph, config?: { maxIterations?: number }) {
  const { maxIterations = DEFAULT_MAX_ITERATIONS } = config ?? {};

  const components = scc(graph);
  const parentAdj = adjacency(graph, true);
  const componentAdj = componentAdjacency(adjacency(graph), components);
  const sorted = sort(components, componentAdj);

  const vertexValues = new Map<Vertex, Tag>();

  for (const component of sorted) {
    resolveComponent(component);
  }

  return vertexValues;

  function resolveComponent(component: Set<Vertex>) {
    let iterations = 0;
    let changed = false;

    do {
      changed = false;
      const prev = new Map<Vertex, Tag | undefined>();

      for (const vertex of component) {
        prev.set(vertex, vertexValues.get(vertex));
      }

      for (const vertex of component) {
        apply(vertex);
      }

      for (const vertex of component) {
        const oldValue = prev.get(vertex)?.$value;
        const newValue = vertexValues.get(vertex)?.$value;

        if (!deepEqual(oldValue, newValue)) {
          changed = true;
          break;
        }
      }

      iterations++;
      if (changed && iterations >= maxIterations) {
        console.warn(
          `[Graph Resolve] Cycle detected: Max iterations (${maxIterations}) reached for component. Bailing out.`,
        );
        break;
      }
    } while (changed);

    function apply(vertex: Vertex) {
      const parentEdges = parentAdj(vertex);

      const parentValues = new Map(
        parentEdges.values()
          .map((e) => e.from)
          .map((p) => [p, vertexValues.get(p)] as const)
          .filter(([_, v]) => {
            if (v === undefined) return false;

            if (typeof vertex.expects === "string") {
              return v.$tag === vertex.expects;
            }

            return (vertex.expects as string[]).includes(v.$tag);
          })
          .map(([p, v]) => [p, v!.$value] as const),
      );

      const inputs = [];
      if (vertex.value) inputs.push(vertex.value.$value);
      inputs.push(...parentValues.values());

      const overrideValues = parentEdges.values()
        .filter((e) => e.override)
        .map((e) => parentValues.get(e.from))
        .filter((v) => v !== undefined && v !== null)
        .toArray();

      const override = overrideValues.length > 0 && vertex.overrideSelector
        ? vertex.overrideSelector(overrideValues, inputs)
        : undefined;

      const calculatedValue = vertex.reduce(inputs);

      const value = override !== undefined ? override : calculatedValue;

      if (value !== undefined) {
        vertexValues.set(vertex, value);
      }
    }
  }
}
