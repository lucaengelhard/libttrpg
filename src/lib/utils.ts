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

export function recordMap<V extends string | number | symbol, K, T>(
  record: Record<V, K>,
  transform: (value: K) => T,
) {
  return Object.fromEntries(
    Object.entries<K>(record).map(([key, value]) => [key, transform(value)]),
  );
}
