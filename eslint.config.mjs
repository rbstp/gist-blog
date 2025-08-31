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

  // CSS linting for source styles only
  {
    files: ["src/**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
    rules: {
      // Allow modern properties and occasional !important in this project
      "css/use-baseline": "off",
      "css/no-important": "off",
    },
  },
]);
