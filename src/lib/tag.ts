export type Tag<Name extends string = any, T = any> = {
  $tag: Name;
  $value: T;
};

export function Tag<Name extends string, T>(tag: Name, value: T): Tag<Name, T> {
  return { $tag: tag, $value: value };
}
