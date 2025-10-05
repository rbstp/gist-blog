import js from "@eslint/js";
import globals from "globals";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // Ignore generated output and caches
  { ignores: ["dist/**", ".cache/**"] },

  // Node/CommonJS sources (build scripts and generator code)
  {
    files: ["src/**/*.js", "scripts/**/*.js", "src/build.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
  },

  // Browser client scripts
  {
    files: ["src/client/**/*.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        // Allow bundlers or loaders to inject these at runtime
        requestAnimationFrame: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", vars: "all", varsIgnorePattern: "^_" }],
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
