import * as z from "zod";
import { NodeSchema } from "./validate.ts";
const JSONSchema = z.toJSONSchema(NodeSchema, {
  unrepresentable: "any",
  reused: "ref",
});

Deno.writeTextFileSync("schema.json", JSON.stringify(JSONSchema));
console.log("Written schema to schema.json");
