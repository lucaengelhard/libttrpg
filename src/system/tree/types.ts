import { CaseInsensitiveMap, NodeMap } from "../../lib/map.ts";
import { exhaustiveUnionArray } from "../../lib/utils.ts";

// OPERATORS
export type Import = {
  type: "IMPORT";
  from: string;
};

export type Multiple = {
  type: "MULTIPLE";
  values: (NodeWithKey | NodeWithName)[];
};

export type Choose = {
  type: "CHOOSE";
  count: Value;
  from: Node;
  selected?: Multiple;
  slectedKeys?: Set<string>;
  open?: Multiple;
  openKeys?: Set<string>;
};

export type Optional = {
  type: "OPTIONAL";
  value: Node;
  active?: boolean;
};

export type Literal = {
  type: "LITERAL";
  value: string | number | boolean;
};

export type Computed = {
  type: "COMPUTED";
  base?: Value;
  overwrite?: Value[];
  modifiers: Value[];
  proficiency?: { value: ProficiencyValue; source: string }[];
};
export type Value = (Literal | Computed | Roll) & { source?: string };

export type Dependency = {
  type: "DEPENDENCY";
  query: string;
  result?: Node;
};

export type Empty = typeof EMPTY;

// VALUES
export type Class = {
  type: "CLASS";
  name: string;
  levels: Record<string, Node>;
  level?: number;
  hitDice: number;
  asi: number[];
  static?: Record<string, Node> | NodeMap;
  // TODO make static optional for every node and the introduce some kind of scoping
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
  gives?: Multiple;
};

export type Proficiency = {
  type: "PROFICIENCY";
  save?: Node;
  skill?: Node;
  armor?: Node;
  weapon?: Node;
  value?: ProficiencyValue;
};

export type Modifier = {
  type: "MODIFIER";
  value: Node;
  modify?: Node;
  set?: Node;
  // TODO add conditional setting and modifying
};

export type Action = {
  type: "ACTION";
  name: string;
  time: string;
};

export type Spell = {
  type: "SPELL";
  name: string;
  alwaysPrepared?: boolean;
  castWithoutSpellSlot?: Resource;
  level: number;
  upcast?: boolean;
  ability?: Node;
};

export type Spellcasting = {
  type: "SPELLCASTING";
  ability: Node;
  table: Record<
    string,
    { spells: number; slots: number[]; prepared?: number; cantrips?: number }
  >;
};

export type Roll = {
  type: "ROLL";
  diceType: Node;
  diceCount: Node;
  minimum: Node;
  modifier: Node;
};

export type Resource = {
  type: "RESOURCE";
  name: string;
  uses: Node;
  spent: Literal;
  resetTrigger: string;
};

export type Ability = { type: "ABILITY"; name: string };
export type Skill = {
  type: "SKILL";
  name: string;
  ability: string;
  hasPassive?: boolean;
};

export type Type = {
  type: "TYPE";
  of: string;
  name: string;
  source?: Set<string>;
};

export type Node =
  & (
    | Import
    | Multiple
    | Dependency
    | Value
    | Choose
    | Optional
    | Empty
    | Class
    | Subclass
    | Feat
    | Proficiency
    | Modifier
    | Action
    | Spell
    | Spellcasting
    | Roll
    | Resource
    | Ability
    | Skill
    | Type
  )
  & { key?: string; description?: string };
export type NodeWithKey = Node & { key: string };
export type NodeWithName = Node & { name: string };
export type NodeType = Node["type"];
export type NodeWithout<T extends NodeType> = Exclude<Node, { type: T }>;
export type NodeWith<T extends NodeType> = Extract<Node, { type: T }>;
export type ProficiencyValue = 0.5 | 1 | 2;

export type Store = CaseInsensitiveMap<
  string,
  CaseInsensitiveMap<string, NodeMap>
>;

export const NODE_TYPES = exhaustiveUnionArray<NodeType>()(
  [
    "ABILITY",
    "ACTION",
    "CHOOSE",
    "CLASS",
    "COMPUTED",
    "DEPENDENCY",
    "EMPTY",
    "FEAT",
    "IMPORT",
    "LITERAL",
    "MODIFIER",
    "MULTIPLE",
    "OPTIONAL",
    "PROFICIENCY",
    "RESOURCE",
    "ROLL",
    "SKILL",
    "SPELL",
    "SPELLCASTING",
    "SUBCLASS",
    "TYPE",
  ] as const,
);

export const EMPTY = { type: "EMPTY" } as const;
export const ZERO: Literal = { type: "LITERAL", value: 0 } as const;
