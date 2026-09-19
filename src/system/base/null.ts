import type * as z from "zod";
import { NOOP, type Resolver } from "../parse.ts";
import { createNode } from "../schema.ts";

export type Null = z.infer<typeof Null>;
export const Null = createNode("Expression", "Null", {});

export const NULL: Resolver<Null> = () => NOOP;
