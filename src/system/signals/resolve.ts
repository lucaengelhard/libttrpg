import { CaseInsensitiveMap } from "../../lib/map.ts";
import { add, id } from "../../lib/utils.ts";
import type { Node, Query, StoreKey, Value } from "../tree/types.ts";
import { applyParams } from "./applyParams.ts";

import { Signal } from "./signal.ts";

type Literal = string | number | boolean | Literal[];
type CharacterValue = { value: number; params?: Record<string, Literal> };

type QueryResult = CharacterValue | null;
type Queries = CaseInsensitiveMap<string, Signal<QueryResult>>;

const Queries: Queries = new CaseInsensitiveMap();

type Store = CaseInsensitiveMap<
  string,
  CaseInsensitiveMap<StoreKey, Signal<CharacterValue>>
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
      const value = getValue(node.value);
      if (!value) break;

      /* for (const toModify of lookup(node.modify)) {
        toModify.deriveFrom(value, id);
      }

      for (const toSet of lookup(node.set)) {
        value.listen((next) => toSet.set(next));
        toSet.set(value.value);
      } */

      break;
    }
    case "RESOURCE": {
      singleLookup(`%[]`);
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
    case "PROFICIENCY":
    case "SPELL":
    case "SPELLCASTING":
    case "ABILITY":
    case "SKILL":
    case "ACTION":
    case "TYPE":
    case "IMPORT":
  }
}

function getValue(value: Value) {
  return typeof value === "number"
    ? DynamicValue(value, add)
    : singleLookup(value);
}

function lookup(query?: Query) {
  if (!query) return [];
  const [accessor, params] = query.toLowerCase().split("?");
  const [section, category, selector] = accessor.split(".");
  if (section !== "character") return [];
  const resultValue = Queries
    .getOrInsert(
      query.toLowerCase(),
      Signal(null),
    );

  const map = Store.getOrInsert(category, new CaseInsensitiveMap());

  if (selector) {
    const selectedValue = map.getOrInsert(
      selector,
      Signal<CharacterValue>({ value: 0 }),
    );

    selectedValue.listen((updated) => resultValue.value = updated);
    resultValue.value = selectedValue.value;
    return resultValue;
  }

  const executeQuery = () =>
    map.values()
      .filter((value) => applyParams(value.value.params ?? {}, params))
      .toArray();

  /*

  // TODO
  const executeQuery = () =>
    map.values()
      .filter((value) => applyParams(value, params))
      .toArray();

  return executeQuery(); */
}

function singleLookup(query?: Query) {
  const res = lookup(query);
  if (res.length === 0) return undefined;
  return res[0];
}
