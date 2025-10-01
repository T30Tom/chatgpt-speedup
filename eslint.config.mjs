// eslint.config.mjs
import js from "@eslint/js";
import pluginJson from "@eslint/json";
import globals from "globals";

export default [
  // JS recommended rules
  js.configs.recommended,

  // JSON support (lint manifest.json, package.json, etc.)
  pluginJson.configs.recommended,

  // Project rules for your MV3 extension JS
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script", // use "module" only if you actually use import/export
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-console": "off"
    },
  },

  // Ignores
  {
    ignores: ["dist/**", "build/**", "icons/**", "**/*.min.js", "*.zip"],
  },
];
