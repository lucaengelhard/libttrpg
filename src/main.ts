import * as path from "@std/path";
import { Node } from "./types.ts";

const lib = await createLibrary("./examples/index.json");
console.log(lib);

async function readData(path: string) {
  const data = await Deno.readTextFile(path);
  return JSON.parse(data);
}

type Library = Map<string, Map<string, Node>>;
async function createLibrary(entryPoint: string) {
  const inputPath = path.resolve(entryPoint);
  const data = await readData(inputPath);

  const library: Library = new Map();
  const visited = new Set<string>();

  await traverse(data, inputPath);

  return library;

  async function traverse(node: Node, filePath: string) {
    if ("name" in node) {
      const category = library.getOrInsert(node.type, new Map());
      if (category.has(node.name)) {
        throw `Duplicate Identifier in ${node.type}: ${node.name}`;
      }
      category.set(node.name, node);
      return;
    }

    switch (node.type) {
      case "LIBRARY": {
        await traverse(node.content, filePath);
        break;
      }
      case "IMPORT": {
        const newAbsPath = path.resolve(path.dirname(filePath), node.from);

        if (visited.has(newAbsPath)) break;
        visited.add(newAbsPath);
        const imported = await readData(newAbsPath);
        await traverse(imported, newAbsPath);
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
