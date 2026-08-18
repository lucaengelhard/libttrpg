import type { Value } from "../system/tree/types.ts";

export function resolveValue(
  node: Value,
): string | number | boolean | undefined {
  switch (node.type) {
    case "LITERAL":
      return node.value;
    case "COMPUTED": {
      if (node.overwrite && node.overwrite.length > 0) {
        return resolveValue(getMaxValue(node.overwrite));
      }
      const base = node.base ? resolveValue(node.base) : undefined;
      const modifiers = node.modifiers.map(resolveValue).filter((v) =>
        v !== undefined
      );

      const values = base ? [base, ...modifiers] : modifiers;
      return values.length > 0
        ? values
          .reduce((acc, curr) => {
            const isBool = typeof acc === "boolean" ||
              typeof curr === "boolean";
            const isNumber = typeof acc === "number" ||
              typeof curr === "number";

            return isBool
              ? (Boolean(acc) && Boolean(curr))
              : isNumber
              ? Number(acc) + Number(curr)
              : acc + curr;
          })
        : undefined;
    }
  }
}

function getMaxValue(values: Value[]): Value {
  let current = values[0];
  for (const value of values) {
    if (
      typeof resolveValue(value) === "string" ||
      typeof resolveValue(value) === "number"
    ) return values[0];

    if (resolveValue(value) as number > (resolveValue(current) as number)) {
      current = value;
    }
  }
  return current;
}
