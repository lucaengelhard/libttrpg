type CharacterValue = {
  value: number;
  props?: Record<string, string | number | boolean>;
};
type QueryResult = DynamicValue<CharacterValue>[];

function modifier(value: CharacterValue, modifier: number = 0): CharacterValue {
  return { ...value, value: getModifier(value.value) + modifier };
}

function add(a: CharacterValue, b: CharacterValue): CharacterValue {
  return { ...a, ...b, value: a.value + b.value };
}

function isGreater(a: CharacterValue, b: CharacterValue) {
  return a.value > b.value;
}

const values: CaseInsensitiveMap<
  StoreKey,
  CaseInsensitiveMap<string, DynamicValue<CharacterValue>>
> = new CaseInsensitiveMap();

function resolve(node: Node) {
  switch (node.type) {
    case "ABILITY": {
      const ability = lookup(toQuery(node.type, node.name))!;
      ability.setBase({ value: node.value ?? 0 });
      lookup(toQuery("save", node.name))!.deriveFrom(ability, modifier);

      break;
    }
    case "SKILL": {
      const skill = lookup(toQuery(node.type, node.name))!;
      skill.setBase({ value: node.value ?? 0 });

      if (node.hasPassive) {
        lookup(toQuery("passive", node.name))!.deriveFrom(
          skill,
          (next) => modifier(next, 10),
        );
      }

      break;
    }

    case "MODIFIER": {
      const value = typeof node.value === "number"
        ? DynamicValue({ value: node.value }, add)
        : lookup(node.value)!;

      if (!value) break;

      const toModify = lookup(node.modify);
      if (toModify) toModify.deriveFrom(value, id);

      const toSet = lookup(node.set);
      if (toSet) {
        value.listen((next) => toSet.set(next)); // TODO use isGreater?
        toSet.set(value.value);
      }

      break;
    }

    case "PROFICIENCY": {
      const proficiencies = values
        .getOrInsert("proficiency", new CaseInsensitiveMap());

      const bonus = lookup("stat.proficiency_bonus")!;
      const proficiencyValue = node.value ?? 1;

      const applyProficiency = (query: string) => {
        const proficiency = proficiencies.getOrInsert(
          `${query}@${PROFICIENCY_NAME[proficiencyValue]}`,
          DynamicValue<CharacterValue>({ value: proficiencyValue }, id),
        );

        proficiency.set(
          {
            value: proficiencyValue * bonus.value.value,
            props: { proficiencyValue },
          },
          isGreater,
        );
        bonus.listen((value) =>
          proficiency.set({ value: proficiencyValue * value.value }, isGreater)
        );

        const value = lookup(query);

        if (value) {
          value.deriveFrom(proficiency, (current) => {
            if (
              current.props && value.value.props &&
              current.props.proficiencyValue &&
              value.value.props.proficiencyValue &&
              typeof current.props.proficiencyValue === "number" &&
              typeof value.value.props.proficiencyValue === "number" &&
              current.props.proficiencyValue <
                value.value.props.proficiencyValue
            ) {
              return { value: 0 };
            }
            return current;
          });
        }
      };

      if (node.save) applyProficiency(node.save.replace("ability", "save"));
      if (node.skill) applyProficiency(node.skill);

      break;
    }

    case "CLASS": {
      const characterLevel = lookup("stat.level")!;
      const classValue = lookup(toQuery(node.type, node.name))!;
      classValue.set({ value: node.level ?? 0 });
      characterLevel.deriveFrom(classValue, id);

      for (const [level, value] of Object.entries(node.levels)) {
        if (parseInt(level) > (node.level ?? 0)) continue;
        resolve(value);
      }
      break;
    }
    case "SUBCLASS": {
      const classValue = lookup(toQuery(node.type, node.for))!;

      classValue.listen((next) => {
        for (const [level, value] of Object.entries(node.levels)) {
          if (parseInt(level) > next.value) continue;
          resolve(value);
        }
      });

      for (const [level, value] of Object.entries(node.levels)) {
        if (parseInt(level) > classValue.value.value) continue;
        resolve(value);
      }

      break;
    }

    case "FEAT": {
      const classValue = node.useLevelsOf
        ? lookup(toQuery(node.type, node.useLevelsOf))!
        : undefined;

      const currentLevel = classValue ?? lookup("stat.level")!;

      if (node.levels) {
        currentLevel.listen((next) => {
          if (!node.levels) return;
          for (const [level, value] of Object.entries(node.levels)) {
            if (parseInt(level) > next.value) continue;
            resolve(value);
          }
        });

        for (const [level, value] of Object.entries(node.levels)) {
          if (parseInt(level) > currentLevel.value.value) continue;
          resolve(value);
        }
      }

      if (node.gives) resolve(node.gives);

      break;
    }

    case "CHOOSE": {
      const count = typeof node.count === "number"
        ? DynamicValue({ value: node.count }, add)
        : lookup(node.count)!;

      const classLevel = node.useLevelsOf
        ? lookup(toQuery(node.type, node.useLevelsOf))!
        : undefined;

      const characterLevel = lookup("stat.level")!;

      if (!node.selected || node.selected.length === 0) break;

      if (is(node.from, "LOOKUP")) break; // TODO
      if (is(node.from, "MULTIPLE")) {
        node.from.values.forEach((v, i) => {
          const identifer = getNodeIdentifier(v);
          if (
            i >= count.value.value || identifer === undefined ||
            !node.selected?.includes(identifer)
          ) return;
          resolve(v);
        });
      }

      break;
    }
    case "OPTIONAL": {
      if (!node.active) break;
      resolve(node.value);

      break;
    }
    case "MULTIPLE": {
      node.values.forEach(resolve);
      break;
    }

    case "LOOKUP": {
      // TODO just for static/library lookup
      // lookup nodes and return
      // maybe even resolve in earlier step??
      break;
    }

    case "TYPE":
    case "IMPORT":
    case "EMPTY": {
      break;
    }

    case "ROLL":
    case "COMPUTED":
    case "ACTION":
    case "SPELL":
    case "SPELLCASTING":
    case "RESOURCE":
  }
}

function lookup(
  query?: Query,
  defaultValue?: DynamicValue<CharacterValue>,
): DynamicValue<CharacterValue> | DynamicValue<QueryResult> | undefined {
  if (!query) return;
  const [category, key] = query.split(".");

  if (!key) {
    const [section, params] = category.split("?");

    const executeQuery = (): QueryResult => {
      const sectionMap = values.getOrInsert(
        section as StoreKey,
        new CaseInsensitiveMap(),
      );

      return sectionMap
        .values()
        .filter((v) => applyParams(v, params))
        .toArray();
    };

    const resultValue = DynamicValue(executeQuery(), id);

    return;
  }
  return values
    .getOrInsert(category as StoreKey, new CaseInsensitiveMap())
    .getOrInsert(key, defaultValue ?? DynamicValue({ value: 0 }, add));
}

function toQuery(category: string, key: string): Query {
  return `${category}.${key}`;
}

function printValues() {
  console.log(
    new Map(
      values.entries().map((
        [key, value],
      ) => [
        key,
        new Map(value.entries().map(([key, value]) => [key, value.value])),
      ]),
    ),
  );
}

const tree = {
  type: "MULTIPLE",
  values: [{
    type: "PROFICIENCY",
    skill: "skill.acrobatics",
  }, {
    type: "PROFICIENCY",
    skill: "skill.acrobatics",
    value: 0.5,
  }, {
    type: "PROFICIENCY",
    skill: "skill.acrobatics",
    value: 2,
  }],
};

resolve(tree);

printValues();

//console.log(build(tree));
