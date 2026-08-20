type Listener<T> = (next: T) => void;

export type Signal<T> = {
  symbol: symbol;
  value: T;
  listen: (Listener: Listener<T>) => void;
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
  };
}
