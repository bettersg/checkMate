module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 8,
  },
  extends: ["eslint:recommended", "google", "plugin:prettier/recommended"],
  rules: {
    quotes: ["error", "double"],
    semi: ["error", "never"], // This enforces no semicolons
    "prettier/prettier": ["error"], // Runs Prettier as an ESLint rule
  },
}
