(function bootstrapPersonNameAliases(root, factory) {
  const aliases = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = aliases;
  }
  root.__PERSON_NAME_ALIASES__ = aliases;
})(typeof globalThis !== "undefined" ? globalThis : this, () => [
  ["Dawn Xiaodong Song", "Dawn Song"],
  ["Peter Mayer", "Jörg-Peter Mayer"],
  ["Xinyi Wang", "Elena Xinyi Wang"],
]);
