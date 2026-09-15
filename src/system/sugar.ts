import type { Condition } from "./node/condition.ts";
import type {
  Node as BaseNode,
  NodeFactory,
  Resolvable as BaseResolvable,
} from "./node/index.ts";
import type { Query } from "./node/query.ts";
import { createTraversal } from "./traverse.ts";

export type ExtendAST<
  T,
  BaseNodeType,
  BaseResolvableType,
  NodeSugar,
  ResolvableSugar,
> = T extends infer Item ? Item extends BaseResolvableType ?
      | {
        [K in keyof Item]: ExtendAST<
          Item[K],
          BaseNodeType,
          BaseResolvableType,
          NodeSugar,
          ResolvableSugar
        >;
      }
      | ResolvableSugar
  : Item extends BaseNodeType ?
      | {
        [K in keyof Item]: ExtendAST<
          Item[K],
          BaseNodeType,
          BaseResolvable,
          NodeSugar,
          ResolvableSugar
        >;
      }
      | NodeSugar
  : Item extends Array<infer Element> ? Array<
      ExtendAST<
        Element,
        BaseNodeType,
        BaseResolvableType,
        NodeSugar,
        ResolvableSugar
      >
    >
  : Item extends Record<string, infer Element> ? Record<
      string,
      ExtendAST<
        Element,
        BaseNodeType,
        BaseResolvableType,
        NodeSugar,
        ResolvableSugar
      >
    >
  : Item
  : never;

type Switch = NodeFactory<
  "Switch",
  { name: string; effect: Node; active: boolean }
>;

type Level = NodeFactory<
  "Level",
  {
    reference: BaseResolvable;
    levels: Record<number, Node>;
  }
>;

type Section = NodeFactory<
  "Section",
  { name: string; value: Node }
>;

type Get = NodeFactory<"Get", { query: string }>;

export type NodeSugar = Switch | Level | Section;
export type ResolvableSugar = Get;

export type Node = ExtendAST<
  BaseNode,
  Exclude<BaseNode, BaseResolvable>,
  BaseResolvable,
  NodeSugar,
  ResolvableSugar
>;

const baseDesugarer = createTraversal<
  BaseNode,
  BaseNode,
  Record<string, never>
>({
  VALUE: (node, desugar) => ({
    ...node,
    value: typeof node.value === "number"
      ? node.value
      : desugar(node.value) as BaseResolvable,
  }),
  BINARYOPERATION: (node, desugar) => ({
    ...node,
    left: desugar(node.left) as BaseResolvable,
    right: desugar(node.right) as BaseResolvable,
  }),
  UNARYOPERATION: (node, desugar) => ({
    ...node,
    value: desugar(node.value) as BaseResolvable,
  }),
  MULTIPLE: (node, desugar) => ({
    ...node,
    values: node.values.map((v) => desugar(v)),
  }),
  MODIFIER: (node, desugar) => ({
    ...node,
    value: desugar(node.value) as BaseResolvable,
  }),
  OVERRIDE: (node, desugar) => ({
    ...node,
    value: desugar(node.value) as BaseResolvable,
  }),
  CONDITION: (node, desugar) => ({
    ...node,
    left: desugar(node.left) as BaseResolvable,
    right: desugar(node.right) as BaseResolvable,
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
  SELECTOR: (node, desugar) => ({
    ...node,
    query: desugar(node.query) as Query,
  }),
});

export const desugar = createTraversal<
  NodeSugar | ResolvableSugar,
  BaseNode,
  Record<string, never>
>(
  {
    SWITCH: (node, desugar) => ({
      type: "CONDITION",
      kind: "==",
      left: { type: "VALUE", value: 1 },
      right: { type: "VALUE", value: node.active ? 1 : 0 },
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
            effect: desugar(effect) as BaseNode,
          };
        },
      );

      return { type: "MULTIPLE", values };
    },
    SECTION: (node, desugar) => desugar(node.value),
    GET: (node) => ({
      type: "REDUCE",
      kind: "MAX",
      query: { type: "QUERY", query: node.query },
    }),
  },
  baseDesugarer,
);
