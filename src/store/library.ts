export type Library = Record<string, SerializedNode>;

export function libraryLookup(
  library: Library,
  query: string,
): SerializedNode[] {
  const querySegments = query.split(".");

  return Object.entries(library).filter(([key]) => {
    const nameSegments = key.split(".");

    return querySegments.every((segment, index) =>
      segment === nameSegments[index]
    );
  }).map(([_, v]) => v);
}
