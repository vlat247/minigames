import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['coverage/**', 'dist/**', 'node_modules/**'],
  },
  {
    linterOptions: {
      noInlineConfig: true,
    },
  },
  {
    files: ['**/*.{js,mjs,ts}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      unicorn.configs.recommended,
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-inferrable-types': 'off',
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
        },
      ],
      'unicorn/no-null': 'off',
      'unicorn/prevent-abbreviations': 'off',
    },
  },
);
