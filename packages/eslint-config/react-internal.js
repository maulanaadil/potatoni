import globals from "globals";
import { config as baseConfig } from "./base.js";
import { reactHooksConfig } from "./react-hooks.js";

/**
 * A custom ESLint configuration for libraries that use React.
 *
 * @type {import("eslint").Linter.Config[]} */
export const config = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
  },
  ...reactHooksConfig,
];
