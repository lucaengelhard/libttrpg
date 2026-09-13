// deno-lint-ignore no-explicit-any
export type AnyNode = { type: string; [key: string]: any };

type TraverseFunc<
  From extends { type: string },
  To,
  CTX extends Record<string, unknown>,
> = (
  node: From,
  topLevelTraverse: TraverseFunc<AnyNode, To, CTX> | undefined,
  ctx: CTX,
) => To;

type TraverseHandlers<
  Types extends AnyNode,
  To,
  CTX extends Record<string, unknown>,
> = {
  [Type in Types["type"]]?: (
    node: Extract<Types, { type: Type }>,
    traverse: (node: AnyNode) => To,
    ctx: CTX,
  ) => To;
};

export function createTraversal<
  Types extends AnyNode,
  To,
  CTX extends Record<string, unknown>,
>(
  handlers: TraverseHandlers<Types, To, CTX>,
  fallback?: TraverseFunc<AnyNode, To, CTX>,
) {
  return function traverse(
    node: AnyNode,
    recursiveFn: TraverseFunc<AnyNode, To, CTX> | undefined,
    ctx: CTX,
  ): To {
    const topLevelTraverse = recursiveFn ?? traverse;

    const handler =
      handlers[node.type as keyof typeof handlers] as TraverseFunc<
        AnyNode,
        To,
        CTX
      >;

    if (handler) {
      return handler(node, (n, t, c) => topLevelTraverse(n, t, c ?? ctx), ctx);
    }

    if (fallback) {
      return fallback(node, (n, t, c) => topLevelTraverse(n, t, c ?? ctx), ctx);
    }

    throw `No traversal handler for ${node.type}`;
  };
}
