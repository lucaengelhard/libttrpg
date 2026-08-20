import type { CaseInsensitiveMap, NodeMap } from "../../lib/map.ts";
import { exhaustiveUnionArray } from "../../lib/utils.ts";
import type { Library } from "../library.ts";

// Resolvers
export type Import = {
  type: "IMPORT";
  from: string;
};

export type Lookup = {
  type: "LOOKUP";
  query: string;
  result?: Node;
};

// Operators
export type Multiple = {
  type: "MULTIPLE";
  values: Node[];
};

export type Choose = {
  type: "CHOOSE";
  count: Value;
  from: Multiple | Lookup;
  selected?: string[];
  chooseAdditionalAt?: {
    level?: number[];
    classLevel?: number[];
  };
};

export type Optional = {
  type: "OPTIONAL";
  value: Node;
  active?: boolean;
};

export type Empty = typeof EMPTY;

export type Modifier = {
  type: "MODIFIER";
  value: Value;
  modify?: Query;
  set?: Query;
  // TODO add conditional setting and modifying
};

export type Roll = {
  type: "ROLL";
  diceType: Value;
  diceCount: Value;
  minimum: Value;
  modifier: Value;
};

export type Resource = {
  type: "RESOURCE";
  name: string;
  uses: Value;
  resetTrigger: string;
  spent?: number;
};

// Character Values
export type Class = {
  type: "CLASS";
  name: string;
  hitDice: number;
  asi: number[];
  levels: Record<string, Node>;
  level?: number;
};

export type Subclass = {
  type: "SUBCLASS";
  name: string;
  for: string;
  levels: Record<string, Node>;
};

export type Feat = {
  type: "FEAT";
  name: string;
  levels?: Record<string, Node>;
  useClassLevel?: boolean;
  gives?: Node;
};

export type Proficiency = {
  type: "PROFICIENCY";
  save?: Query;
  skill?: Query;
  armor?: Multiple | Lookup;
  weapon?: Multiple | Lookup;
  value?: ProficiencyValue;
};

export type Spell = {
  type: "SPELL";
  name: string;
  alwaysPrepared?: boolean;
  castWithoutSpellSlot?: Resource;
  level: number;
  upcast?: boolean;
  ability?: Query;
  class?: string[];
};

export type Spellcasting = {
  type: "SPELLCASTING";
  ability: Node;
  table: Record<
    string,
    { spells: number; slots: number[]; prepared?: number; cantrips?: number }
  >;
};

export type Ability = {
  type: "ABILITY";
  name: string;
  value?: number;
};

export type Skill = {
  type: "SKILL";
  name: string;
  ability: string;
  hasPassive?: boolean;
};

export type Action = {
  type: "ACTION";
  name: string;
  time: string;
};

export type Type = {
  type: "TYPE";
  of: string;
  name: string;
};

export type Node =
  & (
    | Import
    | Lookup
    | Multiple
    | Choose
    | Optional
    | Empty
    | Modifier
    | Roll
    | Resource
    | Class
    | Subclass
    | Feat
    | Proficiency
    | Spell
    | Spellcasting
    | Ability
    | Skill
    | Action
    | Type
  )
  & {
    key?: string;
    name?: string;
    description?: string;
    static?: Record<string, Node>;
    within?: { class?: string; subclass?: string; feat?: string };
  };

export type NodeType = Node["type"];
export type NodeWithout<T extends NodeType> = Exclude<Node, { type: T }>;
export type NodeWith<T extends NodeType> = Extract<Node, { type: T }>;

export type Value = number | Query;
export type ProficiencyValue = 0.5 | 1 | 2;
export type Query = string;

type AdditonalStoreKey =
  | "INFO"
  | "STATS"
  | "PASSIVE"
  | "SAVE";
export type StoreKey =
  | (NodeType | Lowercase<NodeType>)
  | (AdditonalStoreKey | Lowercase<AdditonalStoreKey>)
  // deno-lint-ignore ban-types
  | (string & {});
export type Store = {
  library: Library;
  character: CaseInsensitiveMap<StoreKey, NodeMap>;
};

export const NODE_TYPES: readonly NodeType[] = exhaustiveUnionArray<NodeType>()(
  [
    "IMPORT",
    "LOOKUP",
    "MULTIPLE",
    "CHOOSE",
    "OPTIONAL",
    "EMPTY",
    "MODIFIER",
    "ROLL",
    "RESOURCE",
    "CLASS",
    "SUBCLASS",
    "FEAT",
    "PROFICIENCY",
    "SPELL",
    "SPELLCASTING",
    "ABILITY",
    "SKILL",
    "ACTION",
    "TYPE",
  ] as const,
);

export const EMPTY = { type: "EMPTY" } as const;

export const PROFICIENCY_NAME = {
  0.5: "half",
  1: "full",
  2: "expertise",
} as const satisfies Record<ProficiencyValue, string>;
