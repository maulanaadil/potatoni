import pluginReactHooks from "eslint-plugin-react-hooks";

/**
 * React Compiler rules from eslint-plugin-react-hooks. Biome already owns the two classic
 * hook rules (useHookAtTopLevel, useExhaustiveDependencies), so they're off here to avoid
 * reporting the same problem twice.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const reactHooksConfig = [
  pluginReactHooks.configs.flat.recommended,
  {
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];
