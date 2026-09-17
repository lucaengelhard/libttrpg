type NestedMap<T> = Map<string, T | NestedMap<T>>;

export function nestedMap<T>(map: Map<string, T>): NestedMap<T> {
  const res = new Map();

  for (const [name, value] of map.entries()) {
    const segments = name.split(".");

    let currentMap = res;

    let i = 0;

    while (segments[i + 1] !== undefined) {
      currentMap = currentMap.getOrInsert(segments[i], new Map());
      i++;
    }

    currentMap.set(segments[i], value);
  }

  return res;
}

type ExhaustiveTuple<Union, Tuple extends Union[]> = [Union] extends
  [Tuple[number]] ? Tuple : never;

export function createExhaustiveTuple<Union>() {
  return <U extends [Union, ...Union[]]>(tuple: ExhaustiveTuple<Union, U>) =>
    tuple;
}

// deno-lint-ignore no-explicit-any
export type OmitDistributive<T, K extends PropertyKey> = T extends any
  ? (T extends object ? OmitRecursively<T, K>
    : T extends Array<infer Value> ? OmitDistributive<Value, K>
    : T)
  : never;

type OmitRecursively<T, K extends PropertyKey> = Omit<
  { [P in keyof T]: OmitDistributive<T[P], K> },
  K
>;
