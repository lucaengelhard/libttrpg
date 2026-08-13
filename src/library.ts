import * as path from "@std/path";
import { readData } from "./lib/utils.ts";
import { Node } from "./types.ts";

export type Library = Awaited<ReturnType<typeof createLibrary>>;
export async function createLibrary(entryPoint: string) {
  const inputPath = path.resolve(entryPoint);
  const { data } = await readData("", inputPath);

  const library = new Map<
    string,
    Map<string, { node: Extract<Node, { name: string }>; filePath: string }>
  >();

  await traverse(data, inputPath);

  return {
    content: library,
    acccess(category: string, identifier: string) {
      return library.get(category)?.get(identifier);
    },
    has(category: string, identifier: string) {
      return library.get(category)?.has(identifier) ?? false;
    },
  };

  async function traverse(node: Node, filePath: string) {
    if ("name" in node) {
      const category = library.getOrInsert(node.type, new Map());
      if (category.has(node.name)) {
        throw `Duplicate Identifier in ${node.type}: ${node.name}`;
      }
      category.set(node.name, { node, filePath });
      return;
    }

    switch (node.type) {
      case "IMPORT": {
        const { data, newPath } = await readData(filePath, node.from);
        await traverse(data, newPath);
        break;
      }
      case "MULTIPLE": {
        for (const item of node.values) {
          await traverse(item, filePath);
        }
        break;
      }
    }
  }
}
