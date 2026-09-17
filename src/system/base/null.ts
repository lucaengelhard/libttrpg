import { NOOP, type Resolver } from "../parse.ts";
import type { Expression } from "../node.ts";

export type Null = Expression<"Null", Record<string, never>>;

export const NULL: Resolver<Null> = () => NOOP;
