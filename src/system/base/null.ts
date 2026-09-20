import { type Resolver, VOID } from "../parse.ts";
import { type Infer, Schema } from "../schema.ts";

export type Null = Infer<typeof Null>;
export const Null: Schema<"Null"> = Schema(
  "Null",
  () => ({}),
);

export const NULL: Resolver<Null> = () => VOID;
