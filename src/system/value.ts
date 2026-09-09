import type { Node } from "./node.ts";
import type { Sugar, WithSugar } from "./sugar.ts";

type WithName = Extract<Node | Sugar, { name?: string }>;

export function setValue<
  N extends WithSugar<Node>,
  Possible extends WithName,
  Type extends Possible["type"],
  Selected extends Extract<Possible, { type: Type }>,
  Key extends Exclude<keyof Selected, "name" | "type">,
>(
  node: N,
  ctx: {
    nodeType: Type;
    name: string;
    key: Key;
    value: Selected[Key];
  },
): N {
  if (node.type === ctx.nodeType && node.name === ctx.name) {
    return { ...node, [ctx.key]: ctx.value };
  }

  switch (node.type) {
    case "VALUE":
      return {
        ...node,
        value: typeof node.value === "number"
          ? node.value
          : setValue(node.value, ctx),
      };
    case "SWITCH":
      return { ...node, effect: setValue(node.effect, ctx) };
    case "BINARYOPERATION":
      return {
        ...node,
        left: setValue(node.left, ctx),
        right: setValue(node.right, ctx),
      };
    case "UNARYOPERATION":
      return { ...node, value: setValue(node.value, ctx) };
    case "QUERY":
      return { ...node };
    case "MULTIPLE": {
      return { ...node, values: node.values.map((v) => setValue(v, ctx)) };
    }
    case "MODIFIER":
    case "OVERRIDE":
      return { ...node, value: setValue(node.value, ctx) };
    case "CONDITION":
      return {
        ...node,
        reference: setValue(node.reference, ctx),
        value: setValue(node.value, ctx),
        effect: setValue(node.effect, ctx),
      };
    case "LEVEL": {
      const levels = Object.entries(node.levels).map(
        ([levelStr, effect]) =>
          [parseInt(levelStr), setValue(effect, ctx)] as const,
      );
      return { ...node, reference: setValue(node.reference, ctx), levels };
    }
    case "CHOICE": {
      const options = Object.entries(node.options).map(
        ([key, effect]) => [key, setValue(effect, ctx)] as const,
      );

      return { ...node, options };
    }
    case "COLLECTION": {
      return {
        ...node,
        derives: Object.fromEntries(
          Object.entries(node.derives).map((
            [key, [value, calculation]],
          ) => [key, [value, setValue(calculation, ctx)]]),
        ),
      };
    }
    case "SECTION":
      return { ...node, value: setValue(node.value, ctx) };
  }
}

export function getValue<
  N extends WithSugar<Node>,
  Possible extends WithName,
  Type extends Possible["type"],
  Selected extends Extract<Possible, { type: Type }>,
  Key extends Exclude<keyof Selected, "name" | "type">,
>(
  node: N,
  ctx: {
    nodeType: Type;
    name: string;
    key: Key;
  },
): Selected[Key] | undefined {
  if (node.type === ctx.nodeType && node.name === ctx.name) {
    return (node as unknown as Selected)[ctx.key];
  }

  switch (node.type) {
    case "VALUE":
      return typeof node.value === "number"
        ? undefined
        : getValue(node.value, ctx);
    case "BINARYOPERATION":
      return getValue(node.left, ctx) || getValue(node.right, ctx);
    case "UNARYOPERATION":
      return getValue(node.value, ctx);
    case "QUERY":
      return undefined;
    case "MULTIPLE":
      return node.values
        .map((v) => getValue(v, ctx as any))
        .find((v) => v !== undefined) as Selected[Key] | undefined;
    case "MODIFIER":
    case "OVERRIDE":
      return getValue(node.value, ctx);
    case "CONDITION":
      return getValue(node.effect, ctx) ||
        getValue(node.reference, ctx) ||
        getValue(node.value, ctx);
    case "SWITCH":
      return getValue(node.effect, ctx);
    case "LEVEL": {
      const levelRes = Object.values(node.levels).map((v) =>
        getValue(v, ctx) as Selected[Key] | undefined
      ).find((v) => v !== undefined) as Selected[Key] | undefined;

      return levelRes || getValue(node.reference, ctx);
    }
    case "CHOICE": {
      const optionRes = Object.values(node.options).map((v) =>
        getValue(v, ctx) as Selected[Key] | undefined
      ).find((v) => v !== undefined) as Selected[Key] | undefined;

      return optionRes;
    }
    case "COLLECTION": {
      let res: Selected[Key] | undefined;

      for (const [_, calculation] of Object.values(node.derives)) {
        const value = getValue(calculation, ctx as any) as
          | Selected[Key]
          | undefined;

        if (value) res = value;
      }

      return res;
    }
    case "SECTION":
      return getValue(node.value, ctx);
  }
}
