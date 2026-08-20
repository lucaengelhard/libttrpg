import deepEqual from "deep-equal";
type Listener<T> = (updated: T) => void;

export type Signal<T> = {
  symbol: symbol;
  value: T;
  listen: (Listener: Listener<T>) => void;
  dependency: <U>(
    dependency: Signal<U>,
    callback: (updated: T, current: U) => void,
  ) => void;
  pull: <U>(
    parent: Signal<U>,
    callback: (value: U, current: T) => void,
  ) => void;
};

export function Signal<T>(initial: T): Signal<T> {
  const symbol = Symbol("Signal");
  const listeners = new Set<Listener<T>>();

  const dependencies = new Set<symbol>();
  const parents = new Set<symbol>();

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
    dependency: <U>(
      dependency: Signal<U>,
      callback: (updated: T, current: U) => void,
    ) => {
      if (dependencies.has(dependency.symbol)) return;
      dependencies.add(dependency.symbol);
      listeners.add((updated) => callback(updated, dependency.value));
    },
    pull: <U>(
      parent: Signal<U>,
      callback: (value: U, current: T) => void,
    ) => {
      if (parents.has(parent.symbol)) return;
      parents.add(parent.symbol);
      let previous = parent.value;
      parent.listen((updated) => {
        if (deepEqual(parent.value, previous)) return;
        previous = parent.value;
        callback(updated, value);
      });
    },
  };
}
