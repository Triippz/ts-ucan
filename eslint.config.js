import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["packages/*/src/**/*.ts", "packages/*/test/**/*.ts", "examples/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  { ignores: ["**/dist/**", "node_modules/**", ".reference/**"] },
);
