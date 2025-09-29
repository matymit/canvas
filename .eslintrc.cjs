module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    '.eslintrc.cjs',
    'src-tauri',
    'src/archive/**/*',
    'archive/**/*',
    'src/test/archive/**/*',
    'src/test/**/*',
    'src/**/__tests__/**/*',
    'playwright.config.ts',
    'vitest.config.ts',
    'e2e/**/*',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['react-refresh', '@typescript-eslint'],
  rules: {
    // Production safety rules
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-unused-vars': 'off', // Handled by TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    
    // React rules
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    
    // Performance rules
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // TypeScript rules
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/ban-ts-comment': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/prefer-readonly': 'warn',
    
    // Import rules
    'import/no-default-export': 'off',
    'import/prefer-default-export': 'off',
    
    // Canvas project architectural constraints
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['react-konva', 'react-konva/*'],
            message: 'react-konva is forbidden in this project. Use vanilla Konva.js directly (Konva.Stage, Konva.Layer, Konva.Node) as per architectural requirements.'
          },
          {
            group: ['@konva/react', '@konva/react/*'],
            message: '@konva/react is forbidden in this project. Use vanilla Konva.js directly (Konva.Stage, Konva.Layer, Konva.Node) as per architectural requirements.'
          },
          {
            group: ['react-canvas-konva', 'react-canvas-konva/*'],
            message: 'react-canvas-konva is forbidden in this project. Use vanilla Konva.js directly (Konva.Stage, Konva.Layer, Konva.Node) as per architectural requirements.'
          }
        ]
      }
    ],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
