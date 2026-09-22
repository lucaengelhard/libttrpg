import * as z from "@zod/zod";
import type { Node } from "../system/schema.ts";

type HashConfig = {
  preserveArrayOrder?: boolean;
};

const recordSchema = z.record(
  z.union([z.string(), z.number(), z.symbol()]),
  z.unknown(),
);

export function hashObj(value: unknown, config: HashConfig = {}): string {
  if (value === null) return "null";

  if (value instanceof Map) {
    return `m:{${
      value
        .entries()
        .map(([key, value]) =>
          `${hashObj(key, config)}:${hashObj(value, config)}`
        )
        .toArray()
        .toSorted()
        .join(",")
    }}`;
  }

  if (value instanceof Set) {
    return `S:[${
      value
        .values()
        .map((v) => hashObj(v, config))
        .toArray()
        .toSorted()
        .join(",")
    }]`;
  }

  switch (typeof value) {
    case "string":
      return `s:${JSON.stringify(value)}`;
    case "number":
      return `n:${value}`;
    case "boolean":
      return `b:${value}`;
    case "undefined":
      return "u";
    case "bigint":
      return `B:${value}`;
    case "symbol":
    case "function":
      throw `Value of type ${typeof value} not hashable`;
  }

  if (Array.isArray(value)) {
    const recursiveRes = value.map((v) => hashObj(v, config));
    const res = config.preserveArrayOrder
      ? recursiveRes
      : recursiveRes.toSorted();
    return `a:[${res.join(",")}]`;
  }

  const safe = recordSchema.parse(value);

  return `o:{${
    Object.entries(safe)
      .map(([key, value]) => `${JSON.stringify(key)}:${hashObj(value, config)}`)
      .toSorted()
      .join(",")
  }}`;
}

export function memoize<N extends Node, R>(
  fn: (node: N) => R,
  cache: Map<string, R>,
): (node: N) => R {
  return (node: N) => {
    const hashstr = hashObj(node);
    const cached = cache.get(hashstr);
    if (cached !== undefined) return cached;
    const res = fn(node);
    cache.set(hashstr, res);
    return res;
  };
}
