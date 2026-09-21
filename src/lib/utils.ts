export type NestedMap<T> = Map<string, T | NestedMap<T>>;

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
