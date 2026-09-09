import type { Condition, Node, NodeFactory, Resolvable } from "./node.ts";

type Switch = NodeFactory<
  "Switch",
  { name?: string; effect: Node; active: boolean }
>;

type Level = NodeFactory<
  "Level",
  { reference: Resolvable; levels: Record<number, Node> }
>;

type Choice = NodeFactory<
  "Choice",
  { count: number; options: Record<string, Node>; active: string[] }
>;
// Count is not dynamic for now, as this is probably really weird to build ui for?

type Collection = NodeFactory<
  "Collection",
  {
    name?: string;
    base: Record<string, number>;
    derives: Record<string, [Record<string, string[]>, Resolvable]>;
    basePrefix: string;
  }
>;

type Section = NodeFactory<"Section", { name: string; value: WithSugar<Node> }>;

export type Sugar = Switch | Choice | Level | Collection | Section;

export type WithSugar<N extends Node> =
  | {
    [K in keyof N]: N[K] extends Node ? WithSugar<N[K]> | Sugar
      : N[K] extends Node[] ? (WithSugar<N[K][number]> | Sugar)[]
      : N[K];
  }
  | Sugar;

export function desugar(node: WithSugar<Node>): Node {
  switch (node.type) {
    case "VALUE":
      return {
        ...node,
        value: typeof node.value === "number"
          ? node.value
          : desugar(node.value) as Resolvable,
      };
    case "BINARYOPERATION":
      return {
        ...node,
        left: desugar(node.left) as Resolvable,
        right: desugar(node.right) as Resolvable,
      };
    case "UNARYOPERATION":
      return { ...node, value: desugar(node.value) as Resolvable };

    case "MULTIPLE":
      return { ...node, values: node.values.map(desugar) };

    case "MODIFIER":
    case "OVERRIDE":
      return { ...node, value: desugar(node.value) as Resolvable };

    case "CONDITION":
      return {
        ...node,
        reference: desugar(node.reference) as Resolvable,
        value: desugar(node.value) as Resolvable,
        effect: desugar(node.effect),
      };

    case "QUERY":
      return node;

    case "SWITCH":
      return {
        type: "CONDITION",
        kind: "EQUAL",
        reference: { type: "VALUE", value: 1 },
        value: { type: "VALUE", value: node.active ? 1 : 0 },
        effect: desugar(node.effect),
      };

    case "LEVEL": {
      const values: Condition[] = Object.entries(node.levels).map(
        ([levelStr, effect]) => {
          return {
            type: "CONDITION",
            kind: "GREATEREQUAL",
            reference: node.reference,
            value: { type: "VALUE", value: parseInt(levelStr) },
            effect,
          };
        },
      );

      return { type: "MULTIPLE", values };
    }
    case "CHOICE": {
      const values: Node[] = [];

      for (const key of node.active) {
        const value = node.options[key] as Node | undefined;
        if (!value) continue;

        if (values.length < node.count) {
          values.push(value);
        } else {
          break;
        }
      }

      return { type: "MULTIPLE", values };
    }
    case "COLLECTION": {
      const bases = Object.entries(node.base).map(([identifier, value]) => ({
        type: "VALUE",
        name: `${node.basePrefix}.${identifier}`,
        value,
      } as const));

      const derives = Object.entries(node.derives)
        .flatMap(([derivePrefix, [values, calculation]]) =>
          Object.entries(values)
            .flatMap(([baseName, identifiers]) =>
              identifiers.map((
                identifier,
              ) => ({
                type: "VALUE",
                name: `${derivePrefix}.${identifier}`,
                value: createCollectionItem(calculation, {
                  basePrefix: node.basePrefix,
                  derivePrefix,
                  baseName,
                }),
              } as const))
            )
        );

      return { type: "MULTIPLE", values: [...bases, ...derives] };
    }
    case "SECTION":
      return desugar(node.value);
  }
}

function createCollectionItem(
  node: Resolvable,
  ctx: { basePrefix: string; derivePrefix: string; baseName: string },
): Resolvable {
  switch (node.type) {
    case "VALUE":
      return {
        ...node,
        value: typeof node.value === "number"
          ? node.value
          : createCollectionItem(node.value, ctx),
      };
    case "BINARYOPERATION":
      return {
        ...node,
        left: createCollectionItem(node.left, ctx),
        right: createCollectionItem(node.right, ctx),
      };
    case "UNARYOPERATION":
      return { ...node, value: createCollectionItem(node.value, ctx) };
    case "QUERY": {
      if (node.query !== "$base") return { ...node };
      return { ...node, query: `${ctx.basePrefix}.${ctx.baseName}` };
    }
  }
}
