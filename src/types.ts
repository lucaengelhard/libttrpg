type Class = {
  type: "CLASS";
  name: string;
  hitDice: number;
  asi: number[];
  levels: Record<number, Node>;
  STATIC: Record<string, Node>;
};

type ClassFeat = {
  type: "CLASS_FEAT";
  name: string;
  levels?: Record<number, Node>;
};

type Feat = {
  type: "FEAT";
  name: string;
  gives: Node;
};

type Proficiency = {
  type: "PROFICIENCY";
  expertise?: boolean;
  skill: Node;
};

type Modifier = {
  type: "MODIFIER";
  value?: number | Node;
  modifies?: Node;
  modifyIf?: string;
  set?: Node;
  setIf?: string;
  spellList?: string[];
  spellcasting?: {
    ability: NodeWith<"DERIVE">;
    spellTable: NodeWith<"DERIVE">;
  };
};

type Resource = {
  type: "RESOURCE";
  name: string;
  uses: number | Node;
  reset: string;
};

type Action = {
  type: "ACTION";
  time: string;
  effect: Node;
};

type Spell = {
  type: "SPELL";
  spell: string;
  castWithoutSpellSlot?: {
    count: number;
    reset: string;
  };
};

type Skill = {
  type: "SKILL";
  name: string;
  ability: Node;
  hasPassive?: boolean;
  proficient?: boolean;
  expertise?: boolean;
};

type Roll = {
  type: "ROLL";
  diceType: number;
  diceCount: number;
  modifier?: Node;
  minimum?: number;
};

type Literal = {
  type: "LITERAL";
  value: string | number;
};

type Multiple = {
  type: "MULTIPLE";
  values: Node[];
};

type Choose = {
  type: "CHOOSE";
  count: number;
  from: Node;
};

type Optional = {
  type: "OPTIONAL";
  value: Node;
};

type Derive = {
  type: "DERIVE";
  from: string;
};

type Empty = typeof EMPTY;
export const EMPTY = { type: "EMPTY" } as const;

export type Operator = Multiple | Choose | Derive | Optional | Empty;
export type Value =
  | Class
  | ClassFeat
  | Feat
  | Proficiency
  | Modifier
  | Resource
  | Action
  | Spell
  | Skill
  | Roll
  | Literal;
export type Node = Operator | Value;
export type NodeType = Node["type"];
export type NodeWithout<T extends NodeType> = Exclude<Node, { type: T }>;
export type NodeWith<T extends NodeType> = Extract<Node, { type: T }>;

type Character = {
  CLASSES: Record<string, { level: number }>;
  ABILITIES: Record<string, any>;
  SKILLS: Record<string, Skill>;
  SPELLS: Record<string, any>;
};
export type Env = {
  CHARACTER: Character;
  CURRENT_PATH: string;
  STATIC: Record<string, Node>;
};
