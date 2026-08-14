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

export function getNodePathSegments(
  p: string,
): { value: string; identifier?: string; counter?: number }[] {
  const segments = p.split(PATH_SEPARATOR);
  return segments.map((s) => {
    const [value, identifier] = s.split(PATH_IDENTIFIER);
    if (identifier) {
      const [name, counter] = identifier.split(PATH_COUNTER);
      return { value, identifier: name, counter: parseInt(counter) };
    }
    return { value };
  });
}
