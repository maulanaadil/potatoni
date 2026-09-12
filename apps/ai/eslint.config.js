import { config } from "@repo/eslint-config/base";
import globals from "globals";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    files: ["**/*.ts"],
    languageOptions: { globals: globals.node },
    // The Babel parser can't see type-only names or type-only usage; `tsc --noEmit`
    // (noUnusedLocals/noUnusedParameters) catches both instead.
    rules: { "no-undef": "off", "no-unused-vars": "off" },
  },
];
