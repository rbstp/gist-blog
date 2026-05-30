import js from "@eslint/js";
import globals from "globals";
import css from "@eslint/css";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // Ignore generated output and caches
  { ignores: ["dist/**", ".cache/**"] },

  // Node TypeScript sources (build entry, generator code, scripts, tests)
  {
    files: ["src/build.ts", "src/lib/**/*.ts", "scripts/**/*.ts", "test/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
    },
  },

  // Browser client TypeScript scripts
  {
    files: ["src/client/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Allow bundlers or loaders to inject these at runtime
        requestAnimationFrame: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { args: "none", vars: "all", varsIgnorePattern: "^_" }],
    },
  },

  // CSS linting for source styles
  // Note: Individual modules may reference CSS variables from other modules,
  // so we disable property validation for module files
  {
    files: ["src/styles/modules/**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
    rules: {
      "css/use-baseline": "off",
      "css/no-important": "off",
      "css/no-invalid-properties": "off", // Modules reference vars from other modules
    },
  },

  // CSS linting for concatenated/generated styles - strict validation
  {
    files: ["dist/**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
    rules: {
      "css/use-baseline": "off",
      "css/no-important": "off",
    },
  },
]);
