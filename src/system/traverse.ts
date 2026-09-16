// deno-lint-ignore no-explicit-any
export type AnyNode = { type: string; [key: string]: any };

type Handler<
  Input extends AnyNode,
  ReturnType,
  Context extends Record<string, unknown> | undefined,
> = (
  node: Input,
  traverse: (node: AnyNode) => ReturnType,
  ctx: NonNullable<Context>,
) => ReturnType;

type Handlers<
  Input extends AnyNode,
  ReturnType,
  Context extends undefined | Record<string, unknown>,
> = {
  [Type in Input["type"]]: Handler<
    Extract<Input, { type: Type }>,
    ReturnType,
    Context
  >;
};

type Traverse<
  Input extends AnyNode,
  ReturnType,
  Context extends undefined | Record<string, unknown>,
> = (
  node: Input,
  higherLevelTraverse?: any,
  ctx?: Context,
) => ReturnType;

export function createTraversal<
  Input extends AnyNode,
  ReturnType,
  Context extends undefined | Record<string, unknown>,
>(
  handlers: Handlers<Input, ReturnType, Context>,
  fallback?: Traverse<any, ReturnType, Context>,
) {
  return function traverse(
    node: Input,
    higherLevelTraverse?: Traverse<AnyNode, ReturnType, Context>,
    ctx?: Context,
  ): ReturnType {
    const traverseFunction = higherLevelTraverse ??
      traverse as Traverse<AnyNode, ReturnType, Context>;

    const handler = handlers[node.type as keyof typeof handlers] as
      | Handler<Input, ReturnType, Context>
      | undefined;

    if (handler) {
      return handler(
        node,
        (node) => traverseFunction(node, traverseFunction, ctx),
        ctx ?? {} as never,
      );
    }

    if (fallback) {
      return fallback(node, traverseFunction, ctx);
    }

    throw `No traversal handler for ${node.type}`;
  };
}

// TODO do i really need this abstraction???
