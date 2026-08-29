/**
 * Policy module.
 *
 * Port of delegation/policy.rs.
 */

// Re-export from predicate.ts
export type { Predicate } from "./predicate.js";
export { runPredicate, glob, predicateToIpld, ipldToPredicate, RunError, FromIpldError } from "./predicate.js";

// Re-export from selector/index.ts
export { Selector, parseSelector } from "./selector/index.js";
export type { SelectorErrorReason } from "./selector/error.js";

// Re-export from selector/select.ts
export { Select } from "./selector/select.js";
export { SelectorError, resolveSliceIndices, selectorErrorToIpld, ipldToSelectorError } from "./selector/select.js";

// Re-export from selector/selectable.ts
export type { Selectable } from "./selector/selectable.js";
export { selectIpld, selectNumber, selectString, selectCollection } from "./selector/selectable.js";

// Re-export from selector/filter.ts
export type { Filter } from "./selector/filter.js";
export { filterToString, parseFilter, filterIsIn, filterIsDotField, filterToIpld, ipldToFilter } from "./selector/filter.js";

// Re-export from selector/error.ts
export { ParseError, parseErrorToIpld, ipldToParseError, selectorErrorReasonToIpld, ipldToSelectorErrorReason } from "./selector/error.js";

// Alias kept for barrel compatibility (the package barrel exports this name)
export { ParseError as filterParseError } from "./selector/error.js";