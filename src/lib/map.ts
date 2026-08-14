import { Node } from "../system/tree.ts";

export class CaseInsensitiveMap<K, V> extends Map<K, V> {
  constructor(input?: Iterable<readonly [K, V]>) {
    super();

    if (!input) return;

    for (const [k, v] of input) {
      this.set(k, v); // reuses your normalization
    }
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

  public getOrThrow(key: K): V {
    const res = this.get(key);
    if (res === undefined) throw `No "${key} in map"`;
    return res;
  }
}

export class NodeMap extends CaseInsensitiveMap<string, Node> {
  constructor(input?: Map<string, Node> | [string, Node][]) {
    super(input);
  }

  public getNode<T extends Node["type"]>(
    key: string,
    ...type: T[]
  ): Extract<Node, { type: T }> | undefined {
    const node = super.get(key);
    if (!node || !type.some((t) => t === node.type)) return undefined;
    return node as Extract<Node, { type: T }>;
  }
}
