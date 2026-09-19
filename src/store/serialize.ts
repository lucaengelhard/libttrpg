import { Child } from "../system/schema.ts";

export function serialize(node: Node): string {
  return JSON.parse(JSON.stringify(node));
}

export function isSerializedNode(input: unknown): input is SerializedNode {
  return input !== null &&
    input !== undefined &&
    typeof input === "object" &&
    "$type" in input &&
    typeof input.$type === "string";
}

export function deserialize<N extends Node>(
  factory: Creators<N>,
  current: unknown,
  isWithinExpression?: boolean,
): N {
  if (!isSerializedNode(current)) {
    if (current === null || current === undefined) {
      return current as unknown as N;
    }

    if (Array.isArray(current)) {
      return current.map((v) =>
        deserialize(factory, v, isWithinExpression)
      ) as unknown as N;
    }

    if (typeof current === "object") {
      return Object.fromEntries(
        Object.entries(current).map((
          [k, v],
        ) => [k, deserialize(factory, v, isWithinExpression)]),
      ) as N;
    }

    return current as N;
  }

  const key = current.$type as keyof typeof factory;
  const statement_key = `${current.$type}_STATEMENT` as keyof typeof factory;
  const expression_key = `${current.$type}_EXPRESSION` as keyof typeof factory;

  const standard_handler = factory[key] as
    | CreatorFn<N>
    | undefined;

  const statement_handler = factory[statement_key] as
    | CreatorFn<N>
    | undefined;

  const expression_handler = factory[expression_key] as
    | CreatorFn<N>
    | undefined;

  const isExpression = (isWithinExpression && standard_handler !== undefined) ||
    (isWithinExpression && expression_handler !== undefined);

  const handler = standard_handler ||
    (isExpression ? expression_handler : statement_handler);

  if (handler === undefined) {
    throw `No create handler for node with type ${current.$type}`;
  }

  return handler(Object.fromEntries(
    Object.entries(current).map((
      [k, v],
    ) => [k, deserialize(factory, v, isExpression)]),
  ) as N);
}
