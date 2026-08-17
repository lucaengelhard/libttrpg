import deepEqual from "deep-equal";

import { CaseInsensitiveMap } from "../../lib/map.ts";
import { log } from "../../lib/utils.ts";
import { parse } from "./parse.ts";
import { Node, Store } from "./types.ts";

export function iterate(
  tree: Node,
  config?: {
    maxIterations?: number;
    store?: Store;
    log?: boolean;
  },
) {
  const {
    maxIterations,
    store = new CaseInsensitiveMap() as Store,
  } = config ??
    {
      maxIterations: undefined,
      store: new CaseInsensitiveMap(),
      log: false,
    };

  log(`ITERATION #0`, config?.log ?? false);
  let previous = parse(tree, {
    nodePath: "ROOT",
    store,
    apply: true,
    choiceDelete: true,
    log: config?.log ?? false,
  });

  let iterations = 1;
  while (true) {
    log(`ITERATION #${iterations}`, config?.log ?? false);
    const result = parse(previous, {
      nodePath: "ROOT",
      store,
      apply: true,
      choiceDelete: true,
      log: config?.log ?? false,
    });

    if (deepEqual(previous, result)) return { result, iterations, store };
    previous = result;
    iterations++;
    if (maxIterations && maxIterations < iterations) {
      return { result, iterations, store };
    }
  }
}
