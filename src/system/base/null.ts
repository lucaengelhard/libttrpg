import type * as z from "zod";
import { type Resolver, VOID } from "../parse.ts";
import { NodeSchema, type ZodNode } from "../schema.ts";

export type Null = z.infer<typeof Null>;
export const Null: ZodNode<"Null"> = NodeSchema("Null", {});

export const NULL: Resolver<Null> = () => VOID;
