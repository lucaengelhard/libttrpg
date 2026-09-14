import type { Condition } from "./node/condition.ts";
import type { Node, NodeFactory, Resolvable } from "./node/index.ts";
import { type AnyNode, createTraversal } from "./traverse.ts";

export type Extend<Base, Extension, Value> =
  | Extension
  | (Value extends unknown ? {
      [K in keyof Value]: Value[K] extends Base
        ? Extend<Base, Extension, Value[K]>
        : Value[K] extends Base[] ? Extend<Base, Extension, Value[K][number]>[]
        : Value[K] extends Record<string, Base>
          ? Record<string, Extend<Base, Extension, Value[K][string]>>
        : Value[K];
    }
    : never);

export type InputNode = Extend<Node, Sugar, Node>;

type Switch = NodeFactory<
  "Switch",
  { name: string; effect: InputNode; active: boolean }
>;

type Level = NodeFactory<
  "Level",
  {
    reference: Resolvable;
    levels: Record<number, InputNode>;
  }
>;

type Section = NodeFactory<
  "Section",
  { name: string; value: InputNode }
>;

export type Sugar = Switch | Level | Section;

const baseDesugarer = createTraversal<
  Node,
  AnyNode,
  { passthrough?: boolean }
>({
  VALUE: (node, desugar) => ({
    ...node,
    value: typeof node.value === "number"
      ? node.value
      : desugar(node.value) as Resolvable,
  }),
  BINARYOPERATION: (node, desugar) => ({
    ...node,
    left: desugar(node.left) as Resolvable,
    right: desugar(node.right) as Resolvable,
  }),
  UNARYOPERATION: (node, desugar) => ({
    ...node,
    value: desugar(node.value) as Resolvable,
  }),
  MULTIPLE: (node, desugar) => ({
    ...node,
    values: node.values.map((v) => desugar(v)),
  }),
  MODIFIER: (node, desugar) => ({
    ...node,
    value: desugar(node.value) as Resolvable,
  }),
  OVERRIDE: (node, desugar) => ({
    ...node,
    value: desugar(node.value) as Resolvable,
  }),
  CONDITION: (node, desugar) => ({
    ...node,
    left: desugar(node.left) as Resolvable,
    right: desugar(node.right) as Resolvable,
    effect: desugar(node.effect),
  }),

  REDUCE: (node) => node,
  QUERY: (node) => node,
  CHOICE: (node, desugar) => {
    const options = Object.fromEntries(
      Object
        .entries(node.options)
        .map(([key, value]) => [key, desugar(value)]),
    );

    return { ...node, options };
  },
  SELECTOR: (node, desugar) => ({ ...node, query: desugar(node.query) }),
});

export const desugar = createTraversal<
  Sugar,
  AnyNode,
  { passthrough?: boolean }
>(
  {
    SWITCH: (node, desugar) => ({
      type: "CONDITION",
      kind: "EQUAL",
      reference: { type: "VALUE", value: 1 },
      value: { type: "VALUE", value: node.active ? 1 : 0 },
      effect: desugar(node.effect),
    }),
    LEVEL: (node, desugar) => {
      const values: Condition[] = Object.entries(node.levels).map(
        ([levelStr, effect]) => {
          return {
            type: "CONDITION",
            left: { type: "VALUE", value: parseInt(levelStr) },
            kind: "<=",
            right: node.reference,
            effect: desugar(effect) as Node,
          };
        },
      );

      return { type: "MULTIPLE", values };
    },
    SECTION: (node, desugar) => desugar(node.value),
  },
  baseDesugarer,
);
