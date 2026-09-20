import * as z from "zod";
import type { Node } from "./schema.ts";

export function hashTree(value: unknown): string {
  const safe = z.json().parse(value);

  if (safe === null) return "null";

  switch (typeof safe) {
    case "string":
      return `s:${JSON.stringify(value)}`;
    case "number":
      return `n:${value}`;
    case "boolean":
      return `b:${value}`;
    case "undefined":
      return "u";
  }

  if (Array.isArray(safe)) {
    return `a:[${safe.map(hashTree).sort().join(",")}]`;
  }

  return `o:{${
    Object.keys(safe)
      .sort()
      .map((key) => `${hashTree(key)}:${hashTree(safe[key])}`)
      .join(",")
  }}`;
}

export function memoize<N extends Node, R>(
  fn: (node: N) => R,
  cache: Map<string, R>,
): (node: N) => R {
  return (node: N) => {
    const hashstr = hashTree(node);
    const cached = cache.get(hashstr);
    if (cached !== undefined) return cached;
    const res = fn(node);
    cache.set(hashstr, res);
    return res;
  };
}
