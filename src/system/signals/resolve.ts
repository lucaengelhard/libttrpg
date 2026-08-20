import deepEqual from "deep-equal";
import { CaseInsensitiveMap } from "../../lib/map.ts";
import { add, getModifier } from "../../lib/utils.ts";
import type {
  Node,
  ProficiencyValue,
  Query,
  StoreKey,
  Value,
} from "../tree/types.ts";
import { applyParams } from "./applyParams.ts";

import { Signal } from "./signal.ts";

type Score = {
  type: "SCORE";
  base: number;
  modifiers?: Map<symbol, number>;
  overwrite?: number;
  proficiency?: number;
}; // TODO max: number

type CharacterValue = Signal<Score>;

type QueryResult = CharacterValue | null;

type Store = CaseInsensitiveMap<
  StoreKey,
  Signal<CaseInsensitiveMap<string, CharacterValue>>
>;

const Store: Store = new CaseInsensitiveMap();
export function apply(node: Node) {
  switch (node.type) {
    case "MULTIPLE": {
      node.values.forEach(apply);
      break;
    }
    case "CHOOSE": {
      // TODO
      break;
    }
    case "OPTIONAL": {
      if (!node.active) break;
      apply(node.value);
      break;
    }
    case "MODIFIER": {
      if (node.set) set(node.set, node.value);
      if (node.modify) set(node.modify, node.value, true);

      break;
    }

    case "ABILITY": {
      const abilityMapSignal = Store
        .getOrInsert(node.type, Signal(new CaseInsensitiveMap()));

      const newAbilityMap = new CaseInsensitiveMap(abilityMapSignal.value);
      const ability = newAbilityMap.getOrInsert(
        node.name,
        Signal({
          type: "SCORE",
          base: node.value ?? 0,
        }),
      );

      if (ability.value.base !== (node.value ?? 0)) {
        ability.value = {
          ...ability.value,
          base: node.value ?? 0,
        };
      }

      abilityMapSignal.value = newAbilityMap;

      const saveMapSignal = Store
        .getOrInsert("save", Signal(new CaseInsensitiveMap()));

      const setBase = (
        abilityScore: Score,
        currentMap: CaseInsensitiveMap<string, Signal<Score>>,
      ) => {
        if (abilityScore === null) return;

        const newMap = new CaseInsensitiveMap(currentMap);
        const characterValue = newMap.getOrInsert(
          node.name,
          Signal({
            type: "SCORE",
            base: getModifier(getScoreValue(abilityScore)),
          }),
        );

        const newValue = getModifier(getScoreValue(abilityScore));

        if (characterValue.value.base !== newValue) {
          characterValue.value = {
            ...characterValue.value,
            base: newValue,
          };
        }

        saveMapSignal.value = newMap;
      };

      setBase(ability.value, saveMapSignal.value);
      ability.dependency(saveMapSignal, setBase);

      break;
    }

    case "SKILL": {
      const ability = lookup(node.ability);
      const skillMapSignal = Store
        .getOrInsert(node.type, Signal(new CaseInsensitiveMap()));

      const setBase = (
        queryResult: QueryResult,
        currentMap: CaseInsensitiveMap<string, Signal<Score>>,
      ) => {
        if (queryResult === null) return;

        const newMap = new CaseInsensitiveMap(currentMap);
        const characterValue = newMap.getOrInsert(
          node.name,
          Signal({
            type: "SCORE",
            base: getModifier(getScoreValue(queryResult.value)),
          }),
        );

        const newValue = getModifier(getScoreValue(queryResult.value));

        if (characterValue.value.base !== newValue) {
          characterValue.value = {
            ...characterValue.value,
            base: newValue,
          };
        }

        skillMapSignal.value = newMap;
      };

      setBase(ability.value, skillMapSignal.value);
      ability.dependency(skillMapSignal, setBase);

      const skill = lookup(`character.skill.${node.name}`);

      const passiveMapSignal = Store
        .getOrInsert("passive", Signal(new CaseInsensitiveMap()));

      const setPassiveBase = (
        queryResult: QueryResult,
        currentMap: CaseInsensitiveMap<string, Signal<Score>>,
      ) => {
        if (queryResult === null) return;

        const newMap = new CaseInsensitiveMap(currentMap);
        const characterValue = newMap.getOrInsert(
          node.name,
          Signal({
            type: "SCORE",
            base: getModifier(getScoreValue(queryResult.value)) + 10,
          }),
        );

        const newValue = getModifier(getScoreValue(queryResult.value)) + 10;

        if (characterValue.value.base !== newValue) {
          characterValue.value = {
            ...characterValue.value,
            base: newValue,
          };
        }

        passiveMapSignal.value = newMap;
      };

      setPassiveBase(skill.value, passiveMapSignal.value);
      skill.dependency(passiveMapSignal, setPassiveBase);

      break;
    }

    case "PROFICIENCY": {
      const value = Signal(node.value);
      const skill = lookup(node.skill);

      const applyScoreProficiency = (
        proficiency: ProficiencyValue | undefined,
        score: QueryResult,
      ) => {
        if (
          proficiency === undefined || score === null || skill.value === null
        ) {
          return;
        }

        if (
          score.value.proficiency === undefined ||
          proficiency > score.value.proficiency
        ) {
          skill.value.value = { ...score.value, proficiency: proficiency };
        }
      };

      skill.dependency(value, (updated, current) => {
        applyScoreProficiency(current, updated);
      });

      applyScoreProficiency(value.value, skill.value);

      break;
    }

    case "RESOURCE": {
      break;
    }

    case "ROLL": {
      // TODO
      break;
    }
    case "EMPTY":
    case "LOOKUP": {
      break;
    }

    case "CLASS":
    case "SUBCLASS":
    case "FEAT":
    case "SPELL":
    case "SPELLCASTING":
    case "ACTION":
    case "TYPE":
    case "IMPORT":
  }
}

function lookup(query?: Query) {
  const resultValue = Signal<QueryResult>(null);

  if (!query) return resultValue;

  const [accessor] = query.toLowerCase().split("?");
  const [section, category, selector] = accessor.split(".");
  if (
    section !== "character" || category === undefined || selector === undefined
  ) return resultValue;
  const categorySignal = Store
    .getOrInsert(category, Signal(new CaseInsensitiveMap()));

  categorySignal.listen((updated) => {
    const selectedValue = updated.get(selector);
    if (!selectedValue) return;
    if (resultValue.value === null) {
      resultValue.value = selectedValue;
      return;
    }

    if (!compare(selectedValue, resultValue.value)) return;
    resultValue.value = selectedValue;
  });

  const currentValue = categorySignal.value.get(selector);
  if (currentValue) {
    resultValue.value = currentValue;
  }

  return resultValue;
}

function set(query: Query, value: Value, modify = false) {
  const valueSignal = typeof value === "number" ? Signal(value) : lookup(value);

  const [accessor, params] = query.toLowerCase().split("?");
  const [section, category, selector] = accessor.split(".");
  if (section !== "character" || category === undefined) return;

  const categorySignal = Store
    .getOrInsert(category, Signal(new CaseInsensitiveMap()));

  const setValue = (
    updated: number | QueryResult,
    current: CaseInsensitiveMap<string, Signal<Score>>,
  ) => {
    if (updated === null) return;

    const updatedValue = typeof updated === "number"
      ? updated
      : getScoreValue(updated.value);

    for (const [key, value] of current.entries()) {
      if ((selector && selector !== key) || !applyParams(value, params)) {
        continue;
      }

      switch (value.value.type) {
        case "SCORE": {
          if (modify) {
            const modifiers = new Map(value.value.modifiers);
            modifiers.set(valueSignal.symbol, updatedValue);
            value.value = { ...value.value, modifiers };
          } else {
            value.value = { ...value.value, overwrite: updatedValue };
            // TODO only overwrite if bigger
          }
          break;
        }
      }
    }

    categorySignal.value = categorySignal.value; // Force update
  };

  setValue(valueSignal.value, categorySignal.value);
  valueSignal.dependency<CaseInsensitiveMap<string, CharacterValue>>(
    categorySignal,
    setValue,
  );

  valueSignal.pull(categorySignal, (value, current) => {
    setValue(current, value);
  });
}

function getScoreValue(score: Score): number {
  if (score.overwrite !== undefined) return score.overwrite;
  const modifiers = score.modifiers && score.modifiers.size > 0
    ? score.modifiers.values().reduce(add)
    : 0;

  return score.base + modifiers;
}

function compare(a: CharacterValue, b: CharacterValue): boolean {
  return deepEqual(a, b); // TODO replace with lighter own function
}

apply({
  type: "MULTIPLE",
  values: [
    { type: "MODIFIER", value: 14, set: "character.ability.wisdom" },
    { type: "SKILL", name: "Perception", ability: "character.ability.wisdom" },
    { type: "PROFICIENCY", skill: "character.skill.perception", value: 2 },
    { type: "ABILITY", name: "Wisdom" },
  ],
});

console.log(
  new Map(
    Store
      .entries()
      .map(([key, value]) => [
        key,
        new Map(
          value.value
            .entries()
            .map(([k, v]) => [k, v.value]),
        ),
      ]),
  ),
);
