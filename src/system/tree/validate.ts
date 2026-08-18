import { z } from "zod";
import type { Node, Value } from "./types.ts";

// 1. Define Lazy references to break cyclic dependency loops in TypeScript/Zod
const LazyNode: z.ZodType<Node> = z.lazy(() => NodeSchema);
const LazyValue: z.ZodType<Value> = z.lazy(() => ValueSchema);

// 2. Base types (No source extensions yet)
const LiteralSchema = z.object({
  type: z.literal("LITERAL"),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const BaseComputed = z.object({
  type: z.literal("COMPUTED"),
  base: LazyValue.optional(),
  overwrite: z.array(LazyValue).optional(),
  modifiers: z.array(LazyValue),
});

const BaseRoll = z.object({
  type: z.literal("ROLL"),
  diceType: LazyNode,
  diceCount: LazyNode,
  minimum: LazyNode,
  modifier: LazyNode,
});

// `Value` explicitly adds { source?: string } to these three types
const BaseLiteralValue = LiteralSchema.extend({
  source: z.string().optional(),
});
const BaseComputedValue = BaseComputed.extend({
  source: z.string().optional(),
});
const BaseRollValue = BaseRoll.extend({ source: z.string().optional() });

const ValueSchema: z.ZodType<Value> = z.discriminatedUnion("type", [
  BaseLiteralValue,
  BaseComputedValue,
  BaseRollValue,
]);

// 3. Independent Object Schemas
const BaseImport = z.object({
  type: z.literal("IMPORT"),
  from: z.string(),
});

const BaseMultiple = z.object({
  type: z.literal("MULTIPLE"),
  values: z.array(LazyNode),
});

const BaseChoose = z.object({
  type: z.literal("CHOOSE"),
  count: LazyValue,
  from: LazyNode,
  selected: BaseMultiple.optional(),
  open: BaseMultiple.optional(),
  chooseAdditionalAt: z.object({
    level: z.array(z.number()).optional(),
    classLevel: z.array(z.number()).optional(),
  }).optional(),
  classLevel: z.number().optional(),
});

const BaseOptional = z.object({
  type: z.literal("OPTIONAL"),
  value: LazyNode,
  active: z.boolean().optional(),
});

const BaseDependency = z.object({
  type: z.literal("DEPENDENCY"),
  query: z.string(),
  result: LazyNode.optional(),
});

const BaseEmpty = z.object({
  type: z.literal("EMPTY"),
});

const BaseClass = z.object({
  type: z.literal("CLASS"),
  name: z.string(),
  levels: z.record(z.string(), LazyNode),
  level: z.number().optional(),
  hitDice: z.number(),
  asi: z.array(z.number()),
});

const BaseSubclass = z.object({
  type: z.literal("SUBCLASS"),
  name: z.string(),
  for: z.string(),
  levels: z.record(z.string(), LazyNode),
});

const BaseFeat = z.object({
  type: z.literal("FEAT"),
  name: z.string(),
  levels: z.record(z.string(), LazyNode).optional(),
  gives: LazyNode.optional(),
});

const BaseProficiency = z.object({
  type: z.literal("PROFICIENCY"),
  save: LazyNode.optional(),
  skill: LazyNode.optional(),
  armor: LazyNode.optional(),
  weapon: LazyNode.optional(),
  value: z.union([z.literal(0.5), z.literal(1), z.literal(2)]).optional(),
});

const BaseModifier = z.object({
  type: z.literal("MODIFIER"),
  value: LazyNode,
  modify: BaseDependency.optional(),
  set: BaseDependency.optional(),
});

const BaseAction = z.object({
  type: z.literal("ACTION"),
  name: z.string(),
  time: z.string(),
});

const BaseResource = z.object({
  type: z.literal("RESOURCE"),
  name: z.string(),
  uses: LazyNode,
  spent: LiteralSchema.optional(), // strictly Literal, not Value
  resetTrigger: z.string(),
});

const BaseSpell = z.object({
  type: z.literal("SPELL"),
  name: z.string(),
  alwaysPrepared: z.boolean().optional(),
  castWithoutSpellSlot: BaseResource.optional(),
  level: z.number(),
  upcast: z.boolean().optional(),
  ability: LazyNode.optional(),
  class: z.array(z.string()).optional(),
});

const BaseSpellcasting = z.object({
  type: z.literal("SPELLCASTING"),
  ability: LazyNode,
  table: z.record(
    z.string(),
    z.object({
      spells: z.number(),
      slots: z.array(z.number()),
      prepared: z.number().optional(),
      cantrips: z.number().optional(),
    }),
  ),
});

const BaseAbility = z.object({
  type: z.literal("ABILITY"),
  name: z.string(),
});

const BaseSkill = z.object({
  type: z.literal("SKILL"),
  name: z.string(),
  ability: z.string(),
  hasPassive: z.boolean().optional(),
});

const BaseType = z.object({
  type: z.literal("TYPE"),
  of: z.string(),
  name: z.string(),
  source: z.set(z.string()).optional(), // NOTE: In JSON payloads this needs to be an array, but z.set strictly validates JS Set instances.
});

// 4. Combine into an ultra-fast discriminated union
const NodeBaseSchema = z.discriminatedUnion("type", [
  BaseImport,
  BaseMultiple,
  BaseChoose,
  BaseOptional,
  BaseDependency,
  BaseEmpty,
  BaseClass,
  BaseSubclass,
  BaseFeat,
  BaseProficiency,
  BaseModifier,
  BaseAction,
  BaseResource,
  BaseSpell,
  BaseSpellcasting,
  BaseAbility,
  BaseSkill,
  BaseType,
  BaseLiteralValue,
  BaseComputedValue,
  BaseRollValue,
]);

// 5. Append shared `Node` extensions globally via intersection
const NodeExtensions = z.object({
  key: z.string().optional(),
  description: z.string().optional(),
  static: z.record(z.string(), LazyNode).optional(),
  disabled: z.boolean().optional(),
});

export const NodeSchema: z.ZodType<Node> = NodeBaseSchema.and(NodeExtensions);
