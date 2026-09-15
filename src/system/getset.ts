import type { Node } from "./sugar.ts";
import { type AnyNode, createTraversal } from "./traverse.ts";

export type SetCtx<
  AST extends Node | { type: string },
  N extends Extract<AST, { name?: string }>,
  Key extends Exclude<keyof N, "type" | "name">,
> = {
  nodeType: N["type"];
  name: string;
  key: Key;
  value: N[Key];
};
export function setOr<N extends Node>(
  fn: (node: N, traverse: <C extends Node>(node: C) => C) => N,
) {
  return (node: N, traverse: (node: Node) => Node, ctx: SetCtx) => {
    if (
      node.type === ctx.nodeType && "name" in node && node.name === ctx.name
    ) {
      return { ...node, [ctx.key]: ctx.value };
    }

    return fn(node, traverse);
  };
}

function set<
  AST extends Node | { type: string },
  N extends Extract<AST, { name?: string }>,
  Key extends Exclude<keyof N, "type" | "name">,
>(type: N["type"], name: string, key: Key, value: N[Key]): AST {
  const traverse = createTraversal<AST, AST, SetCtx<AST, N, Key>>({
    VALUE: setOr((node, traverse) => ({
      ...node,
      value: typeof node.value === "number" ? node.value : traverse(node.value),
    })),
    SWITCH: setOr((node, traverse) => ({
      ...node,
      effect: traverse(node.effect),
    })),
    BINARYOPERATION: setOr((node, traverse) => ({
      ...node,
      left: traverse(node.left),
      right: traverse(node.right),
    })),
    UNARYOPERATION: setOr((node, traverse) => ({
      ...node,
      value: traverse(node.value),
    })),
    QUERY: setOr((node) => ({ ...node })),
    MULTIPLE: setOr((node, traverse) => ({
      ...node,
      values: node.values.map((v) => traverse(v)),
    })),
    MODIFIER: setOr((node, traverse) => ({
      ...node,
      value: traverse(node.value),
    })),
    OVERRIDE: setOr((node, traverse) => ({
      ...node,
      value: traverse(node.value),
    })),
    CONDITION: setOr((node, traverse) => ({
      ...node,
      reference: traverse(node.left),
      value: traverse(node.right),
      effect: traverse(node.effect),
    })),
    LEVEL: setOr((node, traverse) => {
      const levels = Object.fromEntries(
        Object.entries(node.levels)
          .map(([levelStr, effect]) =>
            [parseInt(levelStr), traverse(effect)] as const
          ),
      );
      return {
        ...node,
        reference: traverse(node.reference),
        levels,
      };
    }),
    CHOICE: setOr((node, traverse) => {
      const options = Object.fromEntries(
        Object.entries(node.options).map(
          ([key, effect]) => [key, traverse(effect)] as const,
        ),
      );

      return { ...node, options };
    }),
    SECTION: setOr((node, traverse) => ({
      ...node,
      value: traverse(node.value),
    })),
    SELECTOR: setOr((node, traverse) => ({
      ...node,
      query: traverse(node.query),
    })),
    GET: setOr((node) => ({ ...node })),
  });
}

export const setValue = createTraversal<Node, Node, SetCtx>({
  VALUE: setOr((node, traverse) => ({
    ...node,
    value: typeof node.value === "number" ? node.value : traverse(node.value),
  })),
  SWITCH: setOr((node, traverse) => ({
    ...node,
    effect: traverse(node.effect),
  })),
  BINARYOPERATION: setOr((node, traverse) => ({
    ...node,
    left: traverse(node.left),
    right: traverse(node.right),
  })),
  UNARYOPERATION: setOr((node, traverse) => ({
    ...node,
    value: traverse(node.value),
  })),
  QUERY: setOr((node) => ({ ...node })),
  MULTIPLE: setOr((node, traverse) => ({
    ...node,
    values: node.values.map((v) => traverse(v)),
  })),
  MODIFIER: setOr((node, traverse) => ({
    ...node,
    value: traverse(node.value),
  })),
  OVERRIDE: setOr((node, traverse) => ({
    ...node,
    value: traverse(node.value),
  })),
  CONDITION: setOr((node, traverse) => ({
    ...node,
    reference: traverse(node.left),
    value: traverse(node.right),
    effect: traverse(node.effect),
  })),
  LEVEL: setOr((node, traverse) => {
    const levels = Object.fromEntries(
      Object.entries(node.levels)
        .map(([levelStr, effect]) =>
          [parseInt(levelStr), traverse(effect)] as const
        ),
    );
    return {
      ...node,
      reference: traverse(node.reference),
      levels,
    };
  }),
  CHOICE: setOr((node, traverse) => {
    const options = Object.fromEntries(
      Object.entries(node.options).map(
        ([key, effect]) => [key, traverse(effect)] as const,
      ),
    );

    return { ...node, options };
  }),
  SECTION: setOr((node, traverse) => ({
    ...node,
    value: traverse(node.value),
  })),
  SELECTOR: setOr((node, traverse) => ({
    ...node,
    query: traverse(node.query),
  })),
  GET: setOr((node) => ({ ...node })),
});

export type GetCtx = {
  nodeType: string;
  name: string;
  key: string;
};
export function getOr<N extends Node, T>(
  fn: (node: N, traverse: (node: AnyNode) => T, ctx: GetCtx) => T,
) {
  return (node: N, traverse: (node: AnyNode) => T, ctx: GetCtx) => {
    if (
      node.type === ctx.nodeType && "name" in node && node.name === ctx.name &&
      ctx.key in node && typeof ctx.key === "string"
    ) {
      return (node as any)[ctx.key];
    }

    return fn(node, traverse, ctx);
  };
}
export const getValue = createTraversal<Node, unknown, GetCtx>({
  VALUE: getOr((node, traverse) =>
    typeof node.value === "number" ? undefined : traverse(node.value)
  ),
  BINARYOPERATION: getOr((node, traverse) =>
    traverse(node.left) || traverse(node.right)
  ),
  UNARYOPERATION: getOr((node, traverse) => traverse(node.value)),
  QUERY: () => undefined,
  GET: () => undefined,
  MULTIPLE: getOr((node, traverse) =>
    node.values
      .map((v) => traverse(v))
      .find((v) => v !== undefined)
  ),
  MODIFIER: getOr((node, traverse) => traverse(node.value)),
  OVERRIDE: getOr((node, traverse) => traverse(node.value)),
  CONDITION: getOr((node, traverse) =>
    traverse(node.effect) || traverse(node.left) || traverse(node.right)
  ),
  SWITCH: getOr((node, traverse) => traverse(node.effect)),
  LEVEL: getOr((node, traverse) => {
    const levelRes = Object.values(node.levels)
      .map((v) => traverse(v))
      .find((v) => v !== undefined && v !== null);

    return levelRes || traverse(node.reference);
  }),
  CHOICE: getOr((node, traverse) => {
    const optionRes = Object.values(node.options)
      .map((v) => traverse(v))
      .find((v) => v !== undefined && v !== null);

    return optionRes;
  }),
  SECTION: getOr((node, traverse) => traverse(node.value)),
  SELECTOR: getOr((node, traverse) => traverse(node.query)),
});
