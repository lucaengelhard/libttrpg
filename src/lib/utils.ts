export function getModifier(value: number): number {
  return Math.floor((value - 10) / 2);
}

export async function readData(path: string) {
  const data = await Deno.readTextFile(path);
  return JSON.parse(data);
}
