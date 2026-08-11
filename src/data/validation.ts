import * as z from "zod";
import { type Node as TNode, NodeType, NodeWith } from "../types.ts";

type Z<T extends NodeType> = z.ZodType<NodeWith<T>>;

const NodeSchema = z.lazy(() => Node);
export const Class: Z<"CLASS"> = z.object({
  type: z.literal("CLASS"),
  name: z.string(),
  hitDice: z.int().positive(),
  asi: z.array(z.number()),
  levels: z.record(z.number(), NodeSchema),
  STATIC: z.record(z.string(), NodeSchema),
});

export const ClassFeat: Z<"CLASS_FEAT"> = z.object({
  type: z.literal("CLASS_FEAT"),
  name: z.string(),
  levels: z.record(z.number(), NodeSchema),
});

export const Feat: Z<"FEAT"> = z.object({
  type: z.literal("FEAT"),
  name: z.string(),
  gives: NodeSchema,
});

export const Proficiency: Z<"PROFICIENCY"> = z.object({
  type: z.literal("PROFICIENCY"),
  expertise: z.optional(z.boolean()),
  skill: NodeSchema,
});

export const Modifier: Z<"MODIFIER"> = z.object({
  type: z.literal("MODIFIER"),
  value: z.optional(z.union([z.number(), NodeSchema])),
});

export const Node: z.ZodType<TNode> = z.discriminatedUnion("type", [
  Class,
  ClassFeat,
  Feat,
  Proficiency,
  Modifier,
]);
