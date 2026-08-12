import { EMPTY, Env, Node, NodeType, NodeWith } from "./types.ts";

export function parse(node: Node, inputEnv: Env): Node {
  const env = { ...inputEnv };
  env.CURRENT_PATH = env.CURRENT_PATH.length === 0
    ? node.type
    : `${env.CURRENT_PATH} -> ${node.type}`;

  if ("name" in node) {
    env.CURRENT_PATH = `${env.CURRENT_PATH} (${node.name})`;
  }

  switch (node.type) {
    case "CLASS": {
      parseMultiple(Object.values(node.levels), {
        ...env,
        STATIC: node.STATIC,
      });
      return EMPTY;
    }
    case "MULTIPLE": {
      return parseMultiple(node.values, env); // TODO Spread directly nested multiples?
    }
    case "CHOOSE": {
      const options = parse(node.from, env);

      if (!expect(options, "MULTIPLE")) return EMPTY;
      // TODO
      return EMPTY;
    }
    case "CLASS_FEAT": {
      if (node.levels === undefined) return EMPTY;
      parseMultiple(Object.values(node.levels), env);
      return EMPTY;
    }
    case "FEAT": {
      parse(node.gives, env);
      return EMPTY;
    }
    case "PROFICIENCY": {
      const skill = parse(node.skill, env);
      if (!expect(skill, "SKILL", "MULTIPLE")) {
        return EMPTY;
      }

      if (skill.type === "SKILL") {
        // TODO
      } else {
        // TODO
      }

      return EMPTY; // TODO
    }
    case "DERIVE": {
      return accessEnv(env, node.from) ?? EMPTY;
    }
    case "MODIFIER": {
      const value = node.value ? literal(node.value, env) : undefined;
      // TODO
      return EMPTY;
    }
    case "LITERAL":
    case "SPELL": {
      return node;
    }
    case "OPTIONAL": {
      //env.CHOICES[]
      return EMPTY;
    }
    case "RESOURCE":
    case "ACTION":
    case "ROLL":
    default:
      console.warn(`Unhandled NodeType: ${node.type}`);

      if (node.type === undefined) {
        console.log(node);
      }
      console.log(env.CURRENT_PATH);

      return EMPTY;
  }
}

function parseMultiple(nodes: Node[], env: Env): NodeWith<"MULTIPLE"> {
  return { type: "MULTIPLE", values: nodes.map((n) => parse(n, env)) };
}

function is<T extends NodeType>(
  node: Node,
  ...types: T[]
): node is NodeWith<T> {
  return types.some((t) => node.type === t);
}

export function expect<N extends NodeType>(
  node: Node,
  ...types: N[]
): node is NodeWith<N> {
  const res = is(node, ...types);
  if (!res) {
    const wantedTypes = types.length === 1 ? types[0] : types.join(" | ");
    console.warn(`Expected: ${wantedTypes}, Got: ${node.type}`);
  }
  return res;
}

function literal(
  input: Node | NodeWith<"LITERAL">["value"],
  env: Env,
): NodeWith<"LITERAL" | "EMPTY"> {
  if (typeof input === "string" || typeof input === "number") {
    return { type: "LITERAL", value: input };
  }

  const res = parse(input, env);
  if (!expect(res, "LITERAL")) return EMPTY;
  return res;
}

function accessEnv(env: Env, key: string) {
  if (!key.startsWith("$")) return null;
  const [path, query] = key.replace("$", "").split("?");
  const pathSegments = path.split(".");

  let current: Record<string, any> = env;
  for (const segment of pathSegments) {
    if (!(segment in current)) return null;
    current = current[segment];
  }

  if (!query) return current;
  let res: any = current;
  const querySegments = query.split(";");
  for (const segment of querySegments) {
    const values = segment.split("=")[1].split("|");
    res = res.filter((e) =>
      segment in e && values.some((v) => e[segment] === v)
    );
  }
  return res;
}
