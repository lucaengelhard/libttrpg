import { id } from "../../lib/utils.ts";

type Listener<T> = (next: T) => void;

export type DynamicValue<T = unknown> = {
  symbol: symbol;
  value: T;
  listen: (Listener: Listener<T>) => void;
  deriveFrom: <P>(parent: DynamicValue<P>, map: (value: P) => T) => void;
  set: (value?: T, condition?: (current: T, next: T) => boolean) => void;
  setBase: (value: T) => void;
};

export function DynamicValue<T>(
  base: T,
  combinator: (a: NoInfer<T>, b: NoInfer<T>) => T = id,
): DynamicValue<T> {
  const symbol = Symbol("DynamicValue");
  const parents = new Map<symbol, T>([[symbol, base]]);
  const listeners = new Set<Listener<T>>();
  let override: T | undefined = undefined;

  function getValue() {
    return override ?? reduce(parents.values().toArray());
  }

  function reduce(values: T[]): T {
    if (values.length === 1) return values[0];
    const [a, b, ...rest] = values;
    return reduce([combinator(a, b), ...rest]);
  }

  function update() {
    const value = getValue();
    listeners.forEach((listener) => listener(value));
  }

  return {
    get value() {
      return getValue();
    },
    get symbol() {
      return symbol;
    },
    listen: (listener: Listener<T>) => listeners.add(listener),
    deriveFrom: <P>(parent: DynamicValue<P>, map: (value: P) => T) => {
      parent.listen((next: P) => {
        if (parents.get(parent.symbol) === next) return;
        parents.set(parent.symbol, map(next));
        update();
      });
      parents.set(parent.symbol, map(parent.value));
      update();
    },
    set: (value, condition) => {
      if (override && condition && value && !condition(override, value)) return;
      override = value;
      update();
    },
    setBase: (value) => {
      parents.set(symbol, value);
      update();
    },
  };
}
