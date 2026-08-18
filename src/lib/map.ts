import { Node } from "../system/tree/types.ts";
import deepEqual from "deep-equal";

export class CaseInsensitiveMap<K, V> extends Map<K, V> {
  #locked = false;

  constructor(
    input?: Iterable<readonly [K, V]>,
  ) {
    super();

    if (!input) return;

    for (const [k, v] of input) {
      super.set(this.normalize(k), v);
    }
  }

  private normalize(key: K): K {
    return typeof key === "string" ? (key.toLowerCase() as K) : key;
  }

  override get(key: K): V | undefined {
    return super.get(this.normalize(key));
  }

  override set(key: K, value: V): this {
    if (this.#locked) throw `Tried to set locked Map`;
    return super.set(this.normalize(key), value);
  }

  override has(key: K): boolean {
    return super.has(this.normalize(key));
  }

  override delete(key: K): boolean {
    if (this.#locked) throw `Tried to delete from locked Map`;
    return super.delete(this.normalize(key));
  }

  override forEach(
    callbackfn: (value: V, key: K, map: CaseInsensitiveMap<K, V>) => void,
  ): void {
    super.forEach((value, key) => callbackfn(value, key, this));
  }

  override getOrInsert(key: K, defaultValue: V): V {
    if (this.#locked) throw `Tried to getOrInsert from locked Map`;
    return super.getOrInsert(this.normalize(key), defaultValue);
  }

  override getOrInsertComputed(key: K, callback: (key: K) => V): V {
    if (this.#locked) throw `Tried to getOrInsertComputed from locked Map`;

    return super.getOrInsertComputed(this.normalize(key), callback);
  }

  public getOrThrow(key: K): V {
    const res = this.get(key);
    if (res === undefined) throw `No "${key} in map"`;
    return res;
  }

  public lock() {
    this.#locked = true;
    return this;
  }

  public isSameAs(other: CaseInsensitiveMap<K, V>): boolean {
    if (
      !this.keys().every((k) => other.has(k)) &&
      other.keys().every((k) => this.has(k))
    ) return false;

    for (const [key, value] of this) {
      const otherValue = this.get(key)!;
      if (typeof value !== typeof otherValue) return false;
      if (
        !(value instanceof CaseInsensitiveMap) ||
        !(otherValue instanceof CaseInsensitiveMap) ||
        !value.isSameAs(otherValue)
      ) return false;
      if (!deepEqual(value, otherValue)) return false;
      // TODO are these enough checks?
    }
    return true;
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
