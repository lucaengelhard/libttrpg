type Class = {
  type: "CLASS";
  name: string;
  hitDice: number;
  asi: number[];
  levels: Record<number, NodeWithout<"CLASS">>;
  STATIC: Record<string, NodeWithout<"CLASS">>;
};

type ClassFeat = {
  type: "CLASS_FEAT";
  name: string;
  levels: Record<number, NodeWithout<"CLASS">>;
};

type Feat = {
  type: "FEAT";
  name: string;
  gives: NodeWithout<"CLASS">;
};

type Proficiency = {
  type: "PROFICIENCY";
  expertise?: boolean;
  skill: NodeWithout<"CLASS">;
};

type Modifier = {
  type: "Modifier";
  value?: number | NodeWithout<"CLASS">;
  modifies?: NodeWithout<"CLASS">;
  modifyIf?: string;
  set?: NodeWithout<"CLASS">;
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
  uses: number | NodeWithout<"CLASS">;
  reset: string;
};

type Action = {
  type: "ACTION";
  time: string;
  effect: NodeWithout<"CLASS">;
};

type Spell = {
  type: "SPELL";
  spell: string;
  castWithoutSpellSlot?: {
    count: number;
    reset: string;
  };
};

type Roll = {
  type: "ROLL";
  diceType: number;
  diceCount: number;
  modifier?: NodeWithout<"CLASS">;
  minimum?: number;
};

type Multiple = {
  type: "MULTIPLE";
  values: NodeWithout<"CLASS">[];
};

type Choose = {
  type: "CHOOSE";
  count: number;
  from: NodeWithout<"CLASS">;
};

type Optional = {
  type: "OPTIONAL";
  value: NodeWithout<"CLASS">;
};

type Derive = {
  type: "DERIVE";
  from: string;
};

type Operator = Multiple | Choose | Derive | Optional;
type Value =
  | Class
  | ClassFeat
  | Feat
  | Proficiency
  | Modifier
  | Resource
  | Action
  | Spell
  | Roll;
type Node = Operator | Value;
type NodeType = Node["type"];
type NodeWithout<T extends NodeType> = Exclude<Node, { type: T }>;
type NodeWith<T extends NodeType> = Extract<Node, { type: T }>;
