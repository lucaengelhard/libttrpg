import type { BaseNode, Condition, NodeFactory, Resolvable } from "./node.ts";

export type Extend<Base, Extension, Value> =
  | Extension
  | (Value extends unknown ? {
      [K in keyof Value]: Value[K] extends Base
        ? Extend<Base, Extension, Value[K]>
        : Value[K] extends Base[] ? Extend<Base, Extension, Value[K][number]>[]
        : Value[K];
    }
    : never);

export type DesugarFunc<TInput, TTarget> = (
  node: TInput,
  topLevelDesugar?: DesugarFunc<TInput, TTarget>,
) => TTarget;

export type DesugarHandlers<
  THandled extends { type: string },
  TInput,
  TTarget,
> = {
  [T in THandled["type"]]?: (
    node: Extract<TInput, { type: T }>,
    desugar: (node: TInput) => TTarget,
  ) => TTarget;
};

export function createDesugarer<
  THandled extends { type: string },
  TInput extends { type: string },
  TTarget,
>(
  handlers: DesugarHandlers<THandled, TInput, TTarget>,
  fallback?: DesugarFunc<any, any>,
): DesugarFunc<TInput, TTarget> {
  return function desugar(
    node: TInput,
    recursiveFn?: DesugarFunc<TInput, TTarget>,
  ): TTarget {
    const topLevelDesugar = recursiveFn ?? desugar;

    const handler = handlers[node.type as keyof typeof handlers];

    if (handler) {
      // deno-lint-ignore ban-types
      return (handler as Function)(node, topLevelDesugar);
    }

    if (fallback) {
      return fallback(node, topLevelDesugar);
    }

    throw new Error(`No desugaring handler for ${node.type}`);
  };
}

export type InputNode = Extend<BaseNode, Sugar, BaseNode>;

type Switch = NodeFactory<
  "Switch",
  { name?: string; effect: InputNode; active: boolean }
>;

type Level = NodeFactory<
  "Level",
  {
    reference: Resolvable;
    levels: Record<number, InputNode>;
  }
>;

type Choice = NodeFactory<
  "Choice",
  {
    // Count is not dynamic for now, as this is probably really weird to build ui for?
    count: number;
    options: Record<string, InputNode>;
    active: string[];
    name: string;
  }
>;

type Section = NodeFactory<
  "Section",
  { name: string; value: InputNode }
>;

export type Sugar = Switch | Choice | Level | Section;

const BASE_HANDLERS: DesugarHandlers<BaseNode, InputNode, BaseNode> = {
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

  MULTIPLE: (node, desugar) => {
    return ({ ...node, values: node.values.map((v) => desugar(v)) });
  },
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
    reference: desugar(node.reference) as Resolvable,
    value: desugar(node.value) as Resolvable,
    effect: desugar(node.effect),
  }),

  AGGREGATOR: (node) => node,
  QUERY: (node) => node,
};

const baseDesugarer = createDesugarer<BaseNode, InputNode, BaseNode>(
  BASE_HANDLERS,
  (node) => node as BaseNode,
);

export const desugar = createDesugarer<Sugar, InputNode, BaseNode>(
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
            kind: "GREATEREQUAL",
            reference: node.reference,
            value: { type: "VALUE", value: parseInt(levelStr) },
            effect: desugar(effect as BaseNode | Sugar),
          };
        },
      );

      return { type: "MULTIPLE", values };
    },
    CHOICE: (node, desugar) => {
      const values: BaseNode[] = [];

      for (const key of node.active) {
        const value = node.options[key] as BaseNode | undefined;
        if (!value) continue;

        if (values.length < node.count) {
          values.push(value);
        } else {
          break;
        }
      }

      return desugar({ type: "MULTIPLE", values });
    },
    SECTION: (node, desugar) => desugar(node.value),
  },
  baseDesugarer,
);
