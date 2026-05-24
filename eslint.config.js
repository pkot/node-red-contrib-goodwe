"use strict";

const js = require("@eslint/js");
const globals = require("globals");

// Flat-config replacement for the legacy .eslintrc.json (#120). Same rule
// set and globals as before; ESLint 8.x is EOL so we move to 10.x.
module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                ...globals.jest
            }
        },
        rules: {
            indent: ["error", 4],
            "linebreak-style": ["error", "unix"],
            quotes: ["error", "double"],
            semi: ["error", "always"],
            // ESLint 9+ defaults `caughtErrors` to "all" — explicitly
            // honor the same underscore-prefix convention for caught errors
            // that the codebase already uses for unused function args.
            "no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
            ]
        }
    }
];
