type Listener<T> = (updated: T) => void;

export type Signal<T> = {
  symbol: symbol;
  value: T;
  listen: (Listener: Listener<T>) => void;
  derive: <U>(transform: (updated: T, current?: U) => U) => Signal<U>;
};

export function Signal<T>(initial: T): Signal<T> {
  const symbol = Symbol("Signal");
  const listeners = new Set<Listener<T>>();

  let value = initial;

  return {
    get symbol() {
      return symbol;
    },
    get value() {
      return value;
    },
    set value(updated: T) {
      value = updated;
      listeners.forEach((listener) => listener(value));
    },
    listen: (listener) => listeners.add(listener),
    derive: <U>(transform: (updated: T, current?: U) => U) => {
      const derivative = Signal(transform(value));
      listeners.add((updated) =>
        derivative.value = transform(updated, derivative.value)
      );
      return derivative;
    },
  };
}
