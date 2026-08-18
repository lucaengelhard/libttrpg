export class CaseInsensitiveSet<T extends string> extends Set<T> {
  constructor(input?: Iterable<T>) {
    super();
    if (!input) return;
    for (const value of input) {
      super.add(this.normalize(value));
    }
  }

  private normalize(value: T): T {
    return value.toLowerCase() as T;
  }

  override has(value: T): boolean {
    return super.has(this.normalize(value));
  }

  override add(value: T): this {
    return super.add(this.normalize(value));
  }

  override delete(value: T): boolean {
    return super.delete(this.normalize(value));
  }
}
