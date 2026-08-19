/* type Update = {
  value: Reactive;
  query: string;
};

type Depend = {
  query: string;
};

type Value = {
  value: number;
};

type Reactive = (Update | Depend | Value) & { dependencies: string[] };
 */
const tree = {
  type: "MULTIPLE",
  values: [
    { type: "DYNAMIC", current: 0, identifer: "counter" },
    { type: "UPDATE", value: 1, updates: "counter" },
  ],
} as const;

function resolve(
  input,
  state: Map<string, { current: any; set: (newValue: any) => void }>,
) {
  switch (input.type) {
    case "MULTIPLE": {
      return { ...input, values: input.values.map((v) => resolve(v, state)) };
    }
    case "DYNAMIC": {
      const set = (newValue) => {
        const currentState = state.get(input.identifer)!;
        state.set(input.identifer, { ...currentState, current: newValue });
      };

      if (!state.has(input.identifer)) {
        state.set(input.identifer, { current: input.current, set });
      }

      return { ...input };
    }
    case "UPDATE": {
      const toUpdate = state.get(input.updates);
      toUpdate?.set(input.value);
      return { ...input };
    }
  }
}

const state = new Map();
console.log(resolve(tree, state));
