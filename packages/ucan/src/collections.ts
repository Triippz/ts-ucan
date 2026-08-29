/**
 * Conditional collection type aliases.
 *
 * In Rust, these use HashMap/HashSet when std is enabled,
 * and fall back to BTreeMap/BTreeSet for no_std.
 * In TypeScript, we always use Map and Set.
 */

export type UcanMap<K, V> = Map<K, V>;
export type UcanSet<T> = Set<T>;
