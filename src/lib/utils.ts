export function id<T>(a: T) {
  return a;
}

type NestedMap<T> = Map<string, T | Map<string, NestedMap<T>>>;

export function nestedMap<T>(record: Record<string, T>): NestedMap<T> {
  const res = new Map();

  for (const [name, value] of Object.entries(record)) {
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
