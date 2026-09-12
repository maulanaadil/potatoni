import babelParser from "@babel/eslint-parser";

/**
 * ESLint only runs the rules Biome doesn't have (React Compiler and Next.js checks).
 * Formatting, imports and general linting live in the root biome.json.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  {
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-typescript"],
        },
      },
    },
  },
  {
    ignores: ["dist/**"],
  },
];
