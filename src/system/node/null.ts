import { type Expression, NOOP, type Resolver } from "./index.ts";

export type Null = Expression<"Null", Record<string, never>>;

export const NULL: Resolver<Null> = () => NOOP;
