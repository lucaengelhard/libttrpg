import * as z from "zod";
import {
  Ability,
  Action,
  Choose,
  Class,
  Computed,
  Dependency,
  Empty,
  Feat,
  Import,
  Literal,
  Modifier,
  Multiple,
  Node,
  NodeWithKey,
  NodeWithName,
  Optional,
  Proficiency,
  Resource,
  Roll,
  Skill,
  Spell,
  Spellcasting,
  Subclass,
  Type,
  Value,
} from "./types.ts";

const LevelSchema = z.number().int().gte(0).lte(20);
const ProficiencyValueSchema = z.union([
  z.literal(0.5),
  z.literal(1),
  z.literal(2),
]);

const ImportSchema: z.ZodType<Import> = z.object({
  type: z.literal("IMPORT"),
  from: z.string(),
});

const MultipleSchema: z.ZodType<Multiple> = z.object({
  type: z.literal("MULTIPLE"),
  values: z.lazy(() =>
    z.array(z.union([NodeWithKeySchema, NodeWithNameSchema]))
  ),
});

const ChooseSchema: z.ZodType<Choose> = z.object({
  type: z.literal("CHOOSE"),
  count: z.lazy(() => ValueSchema),
  from: z.lazy(() => NodeSchema),
  selected: z.optional(MultipleSchema),
  open: z.optional(MultipleSchema),
});

const OptionalSchema: z.ZodType<Optional> = z.object({
  type: z.literal("OPTIONAL"),
  value: z.lazy(() => NodeSchema),
  active: z.optional(z.boolean()),
});

const DependencySchema: z.ZodType<Dependency> = z.object({
  type: z.literal("DEPENDENCY"),
  query: z.string(), // TODO QuerySchema,
  result: z.optional(z.lazy(() => NodeSchema)),
});

const LiteralSchema: z.ZodType<Literal> = z.object({
  type: z.literal("LITERAL"),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const ComputedSchema: z.ZodType<Computed> = z.object({
  type: z.literal("COMPUTED"),
  base: z.lazy(() => z.optional(ValueSchema)),
  overwrite: z.lazy(() => z.optional(z.array(ValueSchema))),
  modifiers: z.lazy(() => z.array(ValueSchema)),
});

const RollSchema: z.ZodType<Roll> = z.object({
  type: z.literal("ROLL"),
  diceType: z.lazy(() => NodeSchema),
  diceCount: z.lazy(() => NodeSchema),
  minimum: z.lazy(() => NodeSchema),
  modifier: z.lazy(() => NodeSchema),
});

const ValueSchema: z.ZodType<Value> = z.union([
  LiteralSchema,
  ComputedSchema,
  RollSchema,
]).and(z.object({ source: z.optional(z.string()) }));

const EmptySchema: z.ZodType<Empty> = z.object({
  type: z.literal("EMPTY"),
});

const ClassSchema: z.ZodType<Class> = z.object({
  type: z.literal("CLASS"),
  name: z.string(),
  levels: z.record(z.string(), z.lazy(() => NodeSchema)),
  level: z.optional(LevelSchema),
  hitDice: z.number().int().gte(0),
  asi: z.array(LevelSchema),
});

const SubclassSchema: z.ZodType<Subclass> = z.object({
  type: z.literal("SUBCLASS"),
  name: z.string(),
  for: z.string(),
  levels: z.record(z.string(), z.lazy(() => NodeSchema)),
});

const FeatSchema: z.ZodType<Feat> = z.object({
  type: z.literal("FEAT"),
  name: z.string(),
  levels: z.optional(z.record(z.string(), z.lazy(() => NodeSchema))),
  gives: z.optional(MultipleSchema),
});

const ProficiencySchema: z.ZodType<Proficiency> = z.object({
  type: z.literal("PROFICIENCY"),
  save: z.optional(z.lazy(() => NodeSchema)),
  skill: z.optional(z.lazy(() => NodeSchema)),
  armor: z.optional(z.lazy(() => NodeSchema)),
  weapon: z.optional(z.lazy(() => NodeSchema)),
  value: ProficiencyValueSchema,
});

const ModifierSchema: z.ZodType<Modifier> = z.object({
  type: z.literal("MODIFIER"),
  value: z.lazy(() => NodeSchema),
  modify: z.optional(DependencySchema),
  set: z.optional(DependencySchema),
});

const ActionSchema: z.ZodType<Action> = z.object({
  type: z.literal("ACTION"),
  name: z.string(),
  time: z.string(),
});

const SpellSchema: z.ZodType<Spell> = z.object({
  type: z.literal("SPELL"),
  name: z.string(),
  alwaysPrepared: z.optional(z.boolean()),
  castWithoutSpellSlot: z.optional(z.lazy(() => ResourceSchema)),
  level: z.number().int().gte(0).lte(9),
  upcast: z.optional(z.boolean()),
  ability: z.optional(z.lazy(() => NodeSchema)),
});

const SpellCastingSchema: z.ZodType<Spellcasting> = z.object({
  type: z.literal("SPELLCASTING"),
  ability: z.lazy(() => NodeSchema),
  table: z.record(
    z.string(),
    z.object({
      spells: z.number().int().gte(0),
      slots: z.array(z.number().int().gte(0)),
      prepared: z.optional(z.number().int().gte(0)),
      cantrips: z.optional(z.number().int().gte(0)),
    }),
  ),
});

const ResourceSchema: z.ZodType<Resource> = z.object({
  type: z.literal("RESOURCE"),
  name: z.string(),
  uses: z.lazy(() => NodeSchema),
  spent: z.optional(LiteralSchema),
  resetTrigger: z.string(),
});

const AbilitySchema: z.ZodType<Ability> = z.object({
  type: z.literal("ABILITY"),
  name: z.string(),
});

const SkillSchema: z.ZodType<Skill> = z.object({
  type: z.literal("SKILL"),
  name: z.string(),
  ability: z.string(),
  hasPassive: z.optional(z.boolean()),
});

const TypeSchema: z.ZodType<Type> = z.object({
  type: z.literal("TYPE"),
  of: z.string(),
  name: z.string(),
  source: z.optional(z.set(z.string())),
});

export const NodeSchema: z.ZodType<Node> = z.union([
  ImportSchema,
  MultipleSchema,
  DependencySchema,
  ValueSchema,
  ChooseSchema,
  OptionalSchema,
  EmptySchema,
  ClassSchema,
  SubclassSchema,
  FeatSchema,
  ProficiencySchema,
  ModifierSchema,
  ActionSchema,
  SpellSchema,
  SpellCastingSchema,
  RollSchema,
  ResourceSchema,
  AbilitySchema,
  SkillSchema,
  TypeSchema,
]).and(
  z.object({
    key: z.optional(z.string()),
    description: z.optional(z.string()),
    static: z.optional(z.record(z.string(), z.lazy(() => NodeSchema))),
    disabled: z.optional(z.boolean()),
  }),
);

const NodeWithKeySchema: z.ZodType<NodeWithKey> = NodeSchema.and(
  z.object({ key: z.string() }),
);
const NodeWithNameSchema: z.ZodType<NodeWithName> = NodeSchema.and(
  z.object({ name: z.string() }),
);

/* export function getNodeSchema(node: { type: NodeType }) {
  return getSchema(node).and(z.object({
    key: z.optional(z.string()),
    description: z.optional(z.string()),
    static: z.optional(z.record(z.string(), z.lazy(() => NodeSchema))),
    disabled: z.optional(z.boolean()),
  }));
}

function getSchema(node: { type: NodeType }) {
  switch (node.type) {
    case "IMPORT":
      return ImportSchema;
    case "MULTIPLE":
      return MultipleSchema;
    case "EMPTY":
      return EmptySchema;
    case "CHOOSE":
      return ChooseSchema;
    case "OPTIONAL":
      return OptionalSchema;
    case "DEPENDENCY":
      return DependencySchema;
    case "LITERAL":
      return LiteralSchema;
    case "COMPUTED":
      return ComputedSchema;
    case "ROLL":
      return RollSchema;
    case "CLASS":
      return ClassSchema;
    case "SUBCLASS":
      return SubclassSchema;
    case "FEAT":
      return FeatSchema;
    case "PROFICIENCY":
      return ProficiencySchema;
    case "MODIFIER":
      return ModifierSchema;
    case "ACTION":
      return ActionSchema;
    case "SPELL":
      return SpellSchema;
    case "SPELLCASTING":
      return SpellCastingSchema;
    case "RESOURCE":
      return ResourceSchema;
    case "ABILITY":
      return AbilitySchema;
    case "SKILL":
      return SkillSchema;
    case "TYPE":
      return TypeSchema;
  }
} */
