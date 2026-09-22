import { resolve } from "@std/path/resolve";
import { bundleJSON } from "../lib/bundle.ts";

if (Deno.args[0]) {
  console.log(
    JSON.stringify(
      await bundleJSON(resolve(Deno.cwd(), Deno.args[0])),
    ),
  );
}
