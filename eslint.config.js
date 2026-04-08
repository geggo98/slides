import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default [
  ...pluginVue.configs["flat/recommended"],
  {
    files: [
      "**/components/**/*.vue",
      "**/layouts/**/*.vue",
      "**/pages/**/*.vue",
    ],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      // Formatting rules — handled by prettier, not eslint
      "vue/max-attributes-per-line": "off",
      "vue/html-self-closing": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/html-indent": "off",
      "vue/first-attribute-linebreak": "off",

      // Slidev presentations use v-html with static data, no XSS risk
      "vue/no-v-html": "off",

      // Slidev layouts are single-word by convention (e.g. end.vue)
      "vue/multi-word-component-names": "off",
    },
  },
  {
    files: ["**/components/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },
];
