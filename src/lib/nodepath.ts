import { Node } from "../system/tree.ts";

export const PATH_SEPARATOR = "_/_";
export const PATH_IDENTIFIER = "@";
export const PATH_COUNTER = "#";

export function getNodePath(node: Node, currentPath: string) {
  const pathChunk = "name" in node
    ? `${node.type}${PATH_IDENTIFIER}${node.name}`
    : node.key
    ? `${node.type}${PATH_IDENTIFIER}${node.key}`
    : node.type;
  return currentPath.length !== 0
    ? `${currentPath}${PATH_SEPARATOR}${pathChunk}`
    : pathChunk;
}

export function getPathComponents(
  path: string,
): [string, string | undefined, string | undefined] {
  const [value, counter] = path
    .split(PATH_COUNTER);
  const [tag, identifer] = value
    .split(PATH_IDENTIFIER);

  return [tag, identifer, counter].map((s) =>
    s !== undefined ? s.toUpperCase() : undefined
  ) as [string, string | undefined, string | undefined];
}

export function getFromNodePath(node: Node, path: string): Node | undefined {
  const [current, ...rest] = path
    .split(PATH_SEPARATOR)
    .map((s) => s.toUpperCase());

  const next = rest.join(PATH_SEPARATOR);

  const [tag, identifer, counter] = getPathComponents(current);

  if (tag === "ROOT") return getFromNodePath(node, next);
  if (tag !== node.type) return undefined;
  if ("name" in node && node.name.toUpperCase() !== identifer) return undefined;
  if (node.key && node.key.toUpperCase() !== identifer) return undefined;
  if (!rest || rest.length === 0) return node;

  switch (node.type) {
    case "MULTIPLE": {
      return node.values
        .map((v) => getFromNodePath(v, next))
        .find((v) => v !== undefined);
    }
    case "CLASS": {
      if (!counter) return;
      const level = node.levels[counter];
      return getFromNodePath(level, next);
    }

    case "FEAT": {
      if (counter && node.levels) {
        return getFromNodePath(node.levels[counter], next);
      }

      return;
    }
    case "EMPTY":
    case "SUBCLASS":
    case "ACTION":
    case "SPELL":
    case "RESOURCE":
    case "ABILITY":
    case "SKILL":
    case "TYPE":
    case "IMPORT":
    case "DEPENDENCY":
    case "ROLL":
    case "LITERAL":
    case "COMPUTED":
    case "CHOOSE":
    case "OPTIONAL":
    case "PROFICIENCY":
    case "MODIFIER":
    case "SPELLCASTING":
      console.log("TODO", node.type);
  }
}
