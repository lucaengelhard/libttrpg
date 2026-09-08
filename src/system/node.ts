import { Edge, GraphBuilder, Vertex } from "../lib/graph.ts";
import { Tag } from "../lib/tag.ts";
import { nestedMap } from "../lib/utils.ts";

type Readable<R extends Record<string, unknown>> = {
  [K in keyof R]: R[K];
};

type NodeFactory<
  Type extends string,
  Values extends Omit<Record<string, unknown>, "type">,
> = Readable<
  {
    type: Uppercase<Type>;
  } & Values
>;

type Multiple = NodeFactory<"Multiple", { values: Node[] }>;

type Value = NodeFactory<
  "Value",
  { name?: string; value: number | Resolvable }
>;

type BinopKind = "DIVIDE" | "SUBTRACT" | "ADD" | "MULTIPLY";
type BinaryOperation = NodeFactory<
  "BinaryOperation",
  { kind: BinopKind; left: Resolvable; right: Resolvable }
>;

type UnaryOpKind = "CEIL" | "FLOOR";
type UnaryOperation = NodeFactory<
  "UnaryOperation",
  { kind: UnaryOpKind; value: Resolvable }
>;

type Query = NodeFactory<"Query", { query: string }>;

type Resolvable = Value | BinaryOperation | UnaryOperation | Query;

type Modifier = NodeFactory<"Modifier", { target: string; value: Resolvable }>;
type Override = NodeFactory<"Override", { target: string; value: Resolvable }>;

type ConditionKind =
  | "GREATER"
  | "GREATEREQUAL"
  | "LESS"
  | "LESSEQUAL"
  | "EQUAL";
type Condition = NodeFactory<
  "Condition",
  {
    kind: ConditionKind;
    reference: Resolvable;
    value: Resolvable;
    effect: Node;
  }
>;

export type Node = Resolvable | Multiple | Modifier | Override | Condition;

export type TaggedNode<N extends Node> = Tag<N["type"], Omit<N, "type">>;

function sum(arr: number[]) {
  return arr.reduce((prev, curr) => prev + curr, 0);
}

type Number = Tag<"number", number>;
type Boolean = Tag<"boolean", boolean>;

type Undefined = Tag<"undefined", undefined>;
const Undefined: Undefined = Tag("undefined", undefined);

type Named = Tag<"named", [string, number]>;
type Values = Tag<"values", Map<string, number>>;

type Modifiers = Tag<"modifiers", Map<string, number[]>>;

const builder = GraphBuilder();

const values = Vertex<Named, Values>(
  "named",
  (entries) => {
    return Tag("values", new Map(entries));
  },
);

const valuesLookup = new Map<string, Vertex>();

const modifiers = Vertex<Named, Modifiers>(
  "named",
  (entries) => {
    const res = new Map<string, number[]>();

    for (const [name, value] of entries) {
      res.getOrInsert(name, []).push(value);
    }

    return Tag("modifiers", res);
  },
);

const overwrites = Vertex<Named, Modifiers>(
  "named",
  (entries) => {
    const res = new Map<string, number[]>();

    for (const [name, value] of entries) {
      res.getOrInsert(name, []).push(value);
    }

    return Tag("modifiers", res);
  },
);

builder.addVertex(values);
builder.addVertex(modifiers);
builder.addVertex(overwrites);

function traverse(node: Node, condition?: Vertex<Tag, Boolean>) {
  switch (node.type) {
    case "MULTIPLE": {
      for (const value of node.values) {
        traverse(value, condition);
      }
      break;
    }
    case "QUERY":
    case "VALUE":
    case "BINARYOPERATION":
    case "UNARYOPERATION": {
      resolveValue(node, condition);
      break;
    }
    case "OVERRIDE":
    case "MODIFIER": {
      const value = resolveValue(node.value, condition);
      builder.addVertex(value);

      const query = Vertex<Number | Boolean, Named | Undefined>(
        "number",
        (values) => {
          if (values.some((v) => typeof v === "boolean" && !v)) {
            return Undefined;
          }
          const filtered = values.filter((v) => typeof v === "number");

          return Tag("named", [node.target, sum(filtered)]);
        },
      ) as Vertex<Tag, Named>;
      builder.addVertex(query);

      builder.addEdge(Edge(value, query));

      if (node.type === "MODIFIER") {
        builder.addEdge(Edge(query, modifiers));
      } else {
        builder.addEdge(Edge(query, overwrites));
      }

      break;
    }
    case "CONDITION": {
      const reference = resolveValue(node.reference, condition);
      const value = resolveValue(node.value, condition);

      const conditionSwitch = Vertex<Number | Named, Boolean>([
        "named",
        "number",
      ], (values) => {
        if (values.length < 2) return Tag("boolean", false);

        const ref = typeof values[0] === "number" ? values[0] : values[0][1];
        const val = typeof values[1] === "number" ? values[1] : values[1][1];

        return Tag("boolean", cond(node.kind, ref, val));
      });

      builder.addVertex(reference);
      builder.addVertex(value);
      builder.addVertex(conditionSwitch);

      builder.addEdge(Edge(reference, conditionSwitch));
      builder.addEdge(Edge(value, conditionSwitch));

      traverse(node.effect, conditionSwitch);

      break;
    }
  }
}

function resolveValue(
  node: Resolvable,
  condition?: Vertex<Tag, Boolean>,
): Vertex {
  switch (node.type) {
    case "VALUE": {
      const existingVertex = node.name !== undefined
        ? valuesLookup.get(node.name)
        : undefined;

      let valueTag: Number | undefined;
      let parent: Vertex<Tag, Number> | undefined;

      if (typeof node.value === "number") {
        valueTag = Tag("number", node.value);
      }

      if (typeof node.value === "object") {
        parent = resolveValue(node.value, condition);
      }

      const newVertex = Vertex<Number | Boolean, Number | Named | Undefined>(
        ["number", "boolean"],
        (values) => {
          if (values.some((v) => typeof v === "boolean" && !v)) {
            return Undefined;
          }

          const filtered = values.filter((v) => typeof v === "number");
          if (node.name === undefined) {
            return Tag("number", sum(filtered));
          }

          return Tag("named", [node.name, sum(filtered)] as [string, number]);
        },
      );

      const vertex = existingVertex || newVertex;
      vertex.reduce = newVertex.reduce;
      vertex.value = valueTag;

      builder.addVertex(vertex);

      if (parent) {
        builder.addEdge(Edge(parent, vertex));
      }

      if (condition) {
        builder.addEdge(Edge(condition, vertex));
      }

      if (node.name !== undefined) {
        builder.addEdge(Edge(vertex, values));
        valuesLookup.set(node.name, vertex);

        const modifierVertex = Vertex<Modifiers, Number | Undefined>(
          "modifiers",
          (modifiersArr) => {
            const modifiers = modifiersArr[0];
            if (modifiers === undefined) return Undefined;

            const toAdd: number[] = [];

            for (const [query, values] of modifiers.entries()) {
              const querySegments = query.split(".");
              const nameSegments = node.name!.split(".");
              if (querySegments.length > nameSegments.length) continue;

              const isMatching = querySegments.every((segment, index) =>
                segment === nameSegments[index]
              );

              if (isMatching) {
                toAdd.push(...values);
              }
            }

            return Tag("number", sum(toAdd));
          },
        );
        builder.addVertex(modifierVertex);
        builder.addEdge(Edge(modifiers, modifierVertex));
        builder.addEdge(Edge(modifierVertex, vertex));

        const overwriteVertex = Vertex<Modifiers, Number | Undefined>(
          "modifiers",
          (overwritesArr) => {
            const overwrites = overwritesArr[0];
            if (overwrites === undefined) return Undefined;

            const toAdd: number[] = [];

            for (const [query, values] of overwrites.entries()) {
              const querySegments = query.split(".");
              const nameSegments = node.name!.split(".");
              if (querySegments.length > nameSegments.length) continue;

              const isMatching = querySegments.every((segment, index) =>
                segment === nameSegments[index]
              );

              if (isMatching) {
                toAdd.push(...values);
              }
            }

            if (toAdd.length === 0) return Undefined;

            return Tag("number", Math.max(...toAdd));
          },
        );
        builder.addVertex(overwriteVertex);

        builder.addEdge(Edge(overwrites, overwriteVertex));
        builder.addEdge(Edge(overwriteVertex, vertex, true));

        vertex.overrideSelector = (
          overrideValues: (number | boolean)[],
          parentValues: (number | boolean)[],
        ) => {
          if (parentValues.some((v) => typeof v === "boolean" && !v)) {
            return Undefined;
          }
          const filtered = overrideValues.filter((v) => typeof v === "number");
          return Tag("named", [node.name, Math.max(...filtered)]);
        };
      }

      return vertex;
    }
    case "BINARYOPERATION": {
      const left = resolveValue(node.left, condition);
      const right = resolveValue(node.right, condition);

      const result = Vertex<Number, Number | Undefined>("number", (values) => {
        if (values.length === 0) {
          return Undefined;
        }

        if (values.length === 1) return Tag("number", values[0]);

        return binop(node.kind, values[0], values[1]);
      });

      builder.addVertex(result);
      builder.addEdge(Edge(left, result));
      builder.addEdge(Edge(right, result));

      return result;
    }
    case "UNARYOPERATION": {
      const value = resolveValue(node.value, condition);

      const result = Vertex<Number, Number | Undefined>("number", (values) => {
        if (values.length === 0) {
          return Undefined;
        }

        return unaryop(node.kind, values[0]);
      });

      builder.addVertex(value);
      builder.addEdge(Edge(value, result));

      return result;
    }
    case "QUERY": {
      const result = Vertex<Values, Number | Undefined>("values", (values) => {
        const valueMap = values[0];
        if (valueMap === undefined) return Undefined;

        const res = valueMap.get(node.query);

        return res !== undefined ? Tag("number", res) : Undefined;
      });

      builder.addVertex(result);
      builder.addEdge(Edge(values, result));

      return result;
    }
  }
}

function binop(kind: BinopKind, left: number, right: number): Number {
  switch (kind) {
    case "DIVIDE":
      return Tag("number", left / right);
    case "SUBTRACT":
      return Tag("number", left - right);
    case "ADD":
      return Tag("number", left + right);
    case "MULTIPLY":
      return Tag("number", left * right);
  }
}

function unaryop(kind: UnaryOpKind, value: number): Number {
  switch (kind) {
    case "CEIL":
      return Tag("number", Math.ceil(value));
    case "FLOOR":
      return Tag("number", Math.floor(value));
  }
}

function cond(
  kind: ConditionKind,
  reference: number,
  value: number,
): boolean {
  switch (kind) {
    case "GREATER":
      return reference < value;
    case "GREATEREQUAL":
      return reference <= value;
    case "LESS":
      return reference > value;
    case "LESSEQUAL":
      return reference >= value;
    case "EQUAL":
      return reference === value;
  }
}

const tree: Node = {
  type: "MULTIPLE",
  values: [
    { type: "VALUE", value: 12, name: "abilities.wisdom" },
    { type: "VALUE", value: 8, name: "abilities.charisma" },
    {
      type: "VALUE",
      name: "skills.perception",
      value: {
        type: "UNARYOPERATION",
        kind: "FLOOR",
        value: {
          type: "BINARYOPERATION",
          kind: "DIVIDE",
          left: {
            type: "BINARYOPERATION",
            kind: "SUBTRACT",
            left: { type: "QUERY", query: "abilities.wisdom" },
            right: { type: "VALUE", value: 10 },
          },
          right: { type: "VALUE", value: 2 },
        },
      },
    },
    {
      type: "VALUE",
      name: "skills.persuasion",
      value: {
        type: "UNARYOPERATION",
        kind: "FLOOR",
        value: {
          type: "BINARYOPERATION",
          kind: "DIVIDE",
          left: {
            type: "BINARYOPERATION",
            kind: "SUBTRACT",
            left: { type: "QUERY", query: "abilities.charisma" },
            right: { type: "VALUE", value: 10 },
          },
          right: { type: "VALUE", value: 2 },
        },
      },
    },
    {
      type: "VALUE",
      name: "stats.proficiencyBonus",
      value: 2,
    },
    {
      type: "CONDITION",
      kind: "GREATER",
      reference: { type: "QUERY", query: "stats.proficiencyBonus" },
      value: { type: "VALUE", value: 3 },
      effect: {
        type: "MULTIPLE",
        values: [{
          type: "OVERRIDE",
          value: { type: "VALUE", value: 2 },
          target: "abilities",
        }, { type: "VALUE", name: "abilities.lol", value: 12 }],
      },
    },
  ],
};

traverse(tree);
const res = builder.resolve();

console.log(nestedMap(res.get(values)?.$value));
