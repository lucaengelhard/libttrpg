import type { BaseNode, Condition, NodeFactory, Resolvable } from "./node.ts";
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

export type InputNode = Extend<BaseNode, Sugar, BaseNode>;

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

const baseDesugarer = createTraversal<
  BaseNode,
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
    reference: desugar(node.reference) as Resolvable,
    value: desugar(node.value) as Resolvable,
    effect: desugar(node.effect),
  }),

  AGGREGATOR: (node) => node,
  QUERY: (node) => node,
  META: (node, desugar) => ({
    ...node,
    value: desugar(node.value) as Resolvable,
  }),
});

function passOr<N extends Sugar, T>(
  fn: (
    node: N,
    traverse: (node: AnyNode) => T,
    ctx: { passthrough?: boolean },
  ) => T,
) {
  return (
    node: N,
    traverse: (node: AnyNode) => T,
    ctx: { passthrough?: boolean },
  ) => {
    if (ctx.passthrough) {
      switch (node.type) {
        case "SWITCH":
          return { ...node, effect: traverse(node.effect) };
        case "CHOICE":
          return {
            ...node,
            options: Object.fromEntries(
              Object.entries(node.options).map((
                [key, value],
              ) => [key, traverse(value)]),
            ),
          };
        case "LEVEL":
          return {
            ...node,
            options: Object.fromEntries(
              Object.entries(node.levels).map((
                [key, value],
              ) => [key, traverse(value)]),
            ),
          };
        case "SECTION":
          return { ...node, value: traverse(node.value) };
      }
    }

    return fn(node, traverse, ctx);
  };
}
export const desugar = createTraversal<
  Sugar,
  AnyNode,
  { passthrough?: boolean }
>(
  {
    SWITCH: passOr((node, desugar) => ({
      type: "CONDITION",
      kind: "EQUAL",
      reference: { type: "VALUE", value: 1 },
      value: { type: "VALUE", value: node.active ? 1 : 0 },
      effect: desugar(node.effect),
    })),
    LEVEL: passOr((node, desugar) => {
      const values: Condition[] = Object.entries(node.levels).map(
        ([levelStr, effect]) => {
          return {
            type: "CONDITION",
            kind: "GREATEREQUAL",
            reference: node.reference,
            value: { type: "VALUE", value: parseInt(levelStr) },
            effect: desugar(effect) as BaseNode,
          };
        },
      );

      return { type: "MULTIPLE", values };
    }),
    CHOICE: passOr((node, desugar) => {
      const values: BaseNode[] = [];

      for (const key of new Set(node.active)) {
        const value = node.options[key] as BaseNode | undefined;
        if (!value) continue;

        if (values.length < node.count) {
          values.push(value);
        } else {
          break;
        }
      }

      return desugar({ type: "MULTIPLE", values });
    }),
    SECTION: passOr((node, desugar) => desugar(node.value)),
  },
  baseDesugarer,
);
