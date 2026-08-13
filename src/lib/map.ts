export class CaseInsensitiveMap<K, V> extends Map<K, V> {
  constructor(input?: Map<K, V> | [K, V][]) {
    if (!input) {
      super();
      return;
    }

    const entries = input instanceof Map ? input.entries() : input;

    super(
      Array.from(entries, ([k, v]) => [
        typeof k === "string" ? (k.toLowerCase() as K) : k,
        v,
      ]),
    );
  }

  private normalize(key: K): K {
    return typeof key === "string" ? (key.toLowerCase() as K) : key;
  }

  override get(key: K): V | undefined {
    return super.get(this.normalize(key));
  }

  override set(key: K, value: V): this {
    return super.set(this.normalize(key), value);
  }

  override has(key: K): boolean {
    return super.has(this.normalize(key));
  }

  override delete(key: K): boolean {
    return super.delete(this.normalize(key));
  }

  override forEach(
    callbackfn: (value: V, key: K, map: CaseInsensitiveMap<K, V>) => void,
  ): void {
    super.forEach((value, key) => callbackfn(value, key, this));
  }

  override getOrInsert(key: K, defaultValue: V): V {
    return super.getOrInsert(this.normalize(key), defaultValue);
  }

  override getOrInsertComputed(key: K, callback: (key: K) => V): V {
    return super.getOrInsertComputed(this.normalize(key), callback);
  }
}
