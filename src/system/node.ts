import { Edge, GraphBuilder, Vertex } from "../lib/graph.ts";
import { Tag } from "../lib/tag.ts";

type Readable<R extends Record<string, unknown>> = {
  [K in keyof R]: R[K]; // TODO make recursive
};

export type NodeValue = Omit<Record<string, unknown>, "type">;
export type NodeFactory<
  Type extends string,
  Values extends NodeValue,
> = Readable<
  {
    type: Uppercase<Type>;
  } & Values
>;

type Multiple = NodeFactory<"Multiple", { values: BaseNode[] }>;

type Value = NodeFactory<
  "Value",
  { name?: string; value: number | Resolvable }
>;

type Meta = NodeFactory<
  "Meta",
  { meta: Record<string, unknown>; value: Resolvable }
>;

type BinopKind = "DIVIDE" | "SUBTRACT" | "ADD" | "MULTIPLY" | "MAX" | "MIN";
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

type Aggreator = NodeFactory<"Aggregator", { name: string; kind: BinopKind }>;

export type Resolvable =
  | Value
  | Meta
  | BinaryOperation
  | UnaryOperation
  | Query
  | Aggreator;

type Modifier = NodeFactory<"Modifier", { target: string; value: Resolvable }>;
type Override = NodeFactory<"Override", { target: string; value: Resolvable }>;

type ConditionKind =
  | "GREATER"
  | "GREATEREQUAL"
  | "LESS"
  | "LESSEQUAL"
  | "EQUAL";
export type Condition = NodeFactory<
  "Condition",
  {
    kind: ConditionKind;
    reference: Resolvable;
    value: Resolvable;
    effect: BaseNode;
  }
>;

export type BaseNode =
  | Resolvable
  | Multiple
  | Modifier
  | Override
  | Condition;

function sum(arr: ValueObj[]) {
  return arr.reduce(addValueObj, { value: 0 });
}

function addValueObj(a: ValueObj, b: ValueObj): ValueObj {
  const meta = a.meta === undefined ? b.meta : { ...a.meta, ...b.meta };
  return { value: a.value + b.value, meta };
}
type ValueObj = { value: number; meta?: Record<string, unknown> };

type Number = Tag<"number", ValueObj & { meta?: { name?: string } }>;
function toEntries(numbers: Number["$value"][]) {
  return numbers.filter((n) => n.meta?.name !== undefined).map((n) =>
    [n.meta!.name!, n] as const
  );
}

type Boolean = Tag<"boolean", boolean>;

type Undefined = Tag<"undefined", undefined>;
const Undefined: Undefined = Tag("undefined", undefined);

type Values = Tag<
  "values",
  Map<string, ValueObj>
>;

type Modifiers = Tag<"modifiers", Map<string, ValueObj[]>>;

export function parse(tree: BaseNode) {
  const builder = GraphBuilder();

  const values = Vertex<Number, Values>(
    "number",
    (entries) => {
      return Tag("values", new Map(toEntries(entries)));
    },
  );

  const modifiers = Vertex<Number, Modifiers>(
    "number",
    (entries) => {
      const res = new Map<string, ValueObj[]>();

      for (const [name, value] of toEntries(entries)) {
        res.getOrInsert(name, []).push(value);
      }

      return Tag("modifiers", res);
    },
  );

  const overwrites = Vertex<Number, Modifiers>(
    "number",
    (entries) => {
      const res = new Map<string, ValueObj[]>();

      for (const [name, value] of toEntries(entries)) {
        res.getOrInsert(name, []).push(value);
      }

      return Tag("modifiers", res);
    },
  );

  builder.addVertex(values);
  builder.addVertex(modifiers);
  builder.addVertex(overwrites);

  traverse(tree);

  const resolvedTree = builder.resolve();

  return { result: resolvedTree, values: resolvedTree.get(values)?.$value };

  function traverse(node: BaseNode, condition?: Vertex<Tag, Boolean>) {
    switch (node.type) {
      case "MULTIPLE": {
        for (const value of node.values) {
          traverse(value, condition);
        }
        break;
      }
      case "META":
      case "AGGREGATOR":
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

        const query = Vertex<Number | Boolean, Number | Undefined>(
          "number",
          (values) => {
            if (values.some((v) => typeof v === "boolean" && !v)) {
              return Undefined;
            }
            const filtered = values.filter((v) => typeof v !== "boolean");

            const calculated = sum(filtered);

            return Tag("number", {
              value: calculated.value,
              meta: { ...calculated.meta, name: node.target },
            });
          },
        ) as Vertex<Tag, Number>;

        builder.addVertex(query);
        builder.addEdge(Edge(value, query));

        if (condition) {
          builder.addEdge(Edge(condition, query));
        }

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

        const conditionSwitch = Vertex<Number | Boolean, Boolean>(
          "number",
          (values) => {
            if (values.some((v) => typeof v === "boolean" && !v)) {
              return Tag("boolean", false);
            }

            const filtered = values.filter((v) => typeof v !== "boolean");
            if (filtered.length < 2) return Tag("boolean", false);

            const ref = Array.isArray(filtered[0])
              ? filtered[0][1].value
              : filtered[0].value;

            const val = Array.isArray(filtered[1])
              ? filtered[1][1].value
              : filtered[1].value;

            return Tag("boolean", cond(node.kind, ref, val));
          },
        );

        builder.addVertex(reference);
        builder.addVertex(value);
        builder.addVertex(conditionSwitch);

        builder.addEdge(Edge(reference, conditionSwitch));
        builder.addEdge(Edge(value, conditionSwitch));

        if (condition) {
          builder.addEdge(Edge(condition, conditionSwitch));
        }

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
        let valueTag: Number | undefined;
        let parent: Vertex<Tag, Number> | undefined;

        if (typeof node.value === "number") {
          valueTag = Tag("number", { value: node.value });
        }

        if (typeof node.value === "object") {
          parent = resolveValue(node.value, condition);
        }

        const vertex = Vertex<Number | Boolean, Number | Undefined>(
          ["number", "boolean"],
          (values) => {
            if (values.some((v) => typeof v === "boolean" && !v)) {
              return Undefined;
            }

            const filtered = values.filter((v) => typeof v !== "boolean");
            const calculated = sum(filtered);

            const meta = { ...calculated.meta, name: node.name };
            return Tag("number", { value: calculated.value, meta });
          },
        ) as Vertex;
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

          const modifierVertex = Vertex<Modifiers, Number | Undefined>(
            "modifiers",
            (modifiersArr) => {
              const modifiers = modifiersArr[0];
              if (modifiers === undefined) return Undefined;

              const toAdd: ValueObj[] = [];

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

              if (
                node.name === "stats.proficiencyBonus" && toAdd[0] &&
                toAdd[0].value < 10
              ) {
                console.log(toAdd);
              }

              const res = sum(toAdd);
              res.meta = res.meta ?? {};
              res.meta.name = node.name;

              return Tag("number", res);
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

              const toAdd: ValueObj[] = [];

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

              const res = sum(toAdd);
              res.meta = res.meta ?? {};
              res.meta.name = node.name;

              return Tag("number", res);
            },
          );
          builder.addVertex(overwriteVertex);

          builder.addEdge(Edge(overwrites, overwriteVertex));
          builder.addEdge(Edge(overwriteVertex, vertex, true));

          vertex.overrideSelector = (
            overrideValues: (ValueObj | boolean)[],
            parentValues: (ValueObj | boolean)[],
          ) => {
            if (parentValues.some((v) => typeof v === "boolean" && !v)) {
              return Undefined;
            }
            const filtered = overrideValues.filter((v) =>
              typeof v !== "boolean"
            );

            return Tag(
              "number",
              filtered.reduce((prev, curr) =>
                prev.value >= curr.value ? prev : curr
              ),
            );
          };
        }

        const result = Vertex<Number, Number | Undefined>(
          "number",
          (valueArr) => {
            const value = valueArr[0];
            if (value === undefined) return Undefined;
            return Tag("number", value);
          },
        );

        builder.addVertex(result);
        builder.addEdge(Edge(vertex, result));

        return result;
      }
      case "BINARYOPERATION": {
        const left = resolveValue(node.left, condition);
        const right = resolveValue(node.right, condition);

        const result = Vertex<Number, Number | Undefined>(
          "number",
          (values) => {
            if (values.length === 0) {
              return Undefined;
            }

            if (values.length === 1) return Tag("number", values[0]);

            return Tag("number", {
              value: binop(node.kind, values[0].value, values[1].value),
              meta: { ...values[0].meta, ...values[1].meta },
            });
          },
        );

        builder.addVertex(result);
        builder.addEdge(Edge(left, result));
        builder.addEdge(Edge(right, result));

        return result;
      }
      case "UNARYOPERATION": {
        const value = resolveValue(node.value, condition);

        const result = Vertex<Number, Number | Undefined>(
          "number",
          (values) => {
            if (values.length === 0) {
              return Undefined;
            }

            return Tag("number", {
              value: unaryop(node.kind, values[0].value),
              meta: values[0].meta,
            });
          },
        );

        builder.addVertex(value);
        builder.addEdge(Edge(value, result));

        return result;
      }
      case "QUERY": {
        const result = Vertex<Values, Number | Undefined>(
          "values",
          (values) => {
            const valueMap = values[0];
            if (valueMap === undefined) return Undefined;

            const res = valueMap.get(node.query);

            return res !== undefined ? Tag("number", res) : Undefined;
          },
        );

        builder.addVertex(result);
        builder.addEdge(Edge(values, result));

        return result;
      }
      case "AGGREGATOR": {
        const result = Vertex<
          Tag<"ValueArray", ValueObj[]> | Undefined,
          Number | Undefined
        >(
          "ValueArray",
          (valuesArr) => {
            const values = valuesArr[0];
            if (values === undefined) return Undefined;
            if (values.length === 0) return Undefined;
            if (values.length === 1) {
              return Tag("number", values[0]);
            }

            return Tag(
              "number",
              values.reduce((prev, curr) => ({
                value: binop(node.kind, prev.value, curr.value),
                meta: { ...prev.meta, ...curr.meta },
              })),
            );
          },
        );

        const modifierVertex = Vertex<
          Modifiers,
          Tag<"ValueArray", ValueObj[]> | Undefined
        >(
          "modifiers",
          (modifiersArr) => {
            const modifiers = modifiersArr[0];
            if (modifiers === undefined) return Undefined;

            const toAdd: ValueObj[] = [];

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

            return Tag("ValueArray", toAdd);
          },
        );
        builder.addVertex(modifierVertex);
        builder.addEdge(Edge(modifiers, modifierVertex));
        builder.addEdge(Edge(modifierVertex, result));

        return result;
      }
      case "META": {
        const value = resolveValue(node.value);

        const result = Vertex<Number, Number | Undefined>(
          "number",
          (values) => {
            if (values.length === 0) return Undefined;
            return Tag("number", { ...values[0], meta: { ...node.meta } });
          },
        );

        builder.addVertex(result);
        builder.addEdge(Edge(value, result));

        return result;
      }
    }
  }
}
function binop(kind: BinopKind, left: number, right: number): number {
  switch (kind) {
    case "DIVIDE":
      return left / right;
    case "SUBTRACT":
      return left - right;
    case "ADD":
      return left + right;
    case "MULTIPLY":
      return left * right;
    case "MAX":
      return Math.max(left, right);
    case "MIN":
      return Math.min(left, right);
  }
}

function unaryop(kind: UnaryOpKind, value: number): number {
  switch (kind) {
    case "CEIL":
      return Math.ceil(value);
    case "FLOOR":
      return Math.floor(value);
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
