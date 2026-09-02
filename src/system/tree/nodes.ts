import type { Apply } from "./sugar.ts";

export type Multiple = {
  type: "MULTIPLE";
  values: Node[];
};

type Value = {
  type: "VALUE";
  name?: string;
  value: number | string | Resolvable;
};

type BinOp = {
  type: "BINOP";
  kind: BinopKind;
  left: Resolvable;
  right: Resolvable;
};
type BinopKind = "DIVIDE" | "SUBTRACT" | "ADD" | "MULTIPLY";

type BinopValue =
  | { left: VertexValue }
  | { right: VertexValue }
  | Neutral;

type UnaryOp = {
  type: "UNARYOP";
  kind: UnaryOpKind;
  value: Resolvable;
};
type UnaryOpKind = "CEIL" | "FLOOR";

type Query = {
  type: "QUERY";
  query: string;
};

export type Resolvable = Value | BinOp | UnaryOp | Query;

type Modifier = {
  type: "MODIFIER";
  target: string;
  value: Resolvable;
};

type Override = {
  type: "OVERRIDE";
  target: string;
  value: Resolvable;
  // TODO: condition
};

export type Choice = {
  type: "CHOICE";
  name: string;
  count: Resolvable;
  options: Record<string, Node>;
  selected: Record<string, Node>;
};

export type Node =
  | Multiple
  | Resolvable
  | Modifier
  | Override
  | Apply
  | Choice;

export function isBinopValue(value: unknown): value is BinopValue {
  return typeof value === "object" && value !== null &&
    ("left" in value || "right" in value);
}

export function unwrapBinopValue(value: BinopValue) {
  return typeof value === "object"
    ? "left" in value ? value.left : value.right
    : value;
}

export function getBinopValue(
  a: Exclude<BinopValue, Neutral>,
  b: Exclude<BinopValue, Neutral>,
  side: "left" | "right",
): VertexValue {
  return side in a
    ? a[side as keyof typeof a]
    : side in b
    ? b[side as keyof typeof b]
    : NEUTRAL;
}

export function binop(
  kind: BinopKind,
  a: VertexValue,
  b: VertexValue,
): VertexValue {
  if (a === NEUTRAL) return b; // TODO: This causes unexpected behaviour, maybe case-by-case handling?
  if (b === NEUTRAL) return a;
  switch (kind) {
    case "DIVIDE":
      return a / b;
    case "SUBTRACT":
      return a - b;
    case "ADD":
      return a + b;
    case "MULTIPLY":
      return a * b;
  }
}

export function unaryop(kind: UnaryOpKind, value: VertexValue): VertexValue {
  if (value === NEUTRAL) return value;

  switch (kind) {
    case "CEIL":
      return Math.ceil(value);
    case "FLOOR":
      return Math.floor(value);
  }
}

export function isResolvable(node: unknown): node is Resolvable {
  if (
    node === undefined || node === null || typeof node !== "object" ||
    !("type" in node) || typeof node.type !== "string"
  ) {
    return false;
  }

  return ["VALUE", "BINOP", "UNARYOP", "QUERY"].includes(node.type);
}

export const NEUTRAL = Symbol("Neutral");
type Neutral = typeof NEUTRAL;

export type VertexValue = number | Neutral;
