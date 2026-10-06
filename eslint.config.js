// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // The app's Text/TextInput opt out of the OS font-size setting, which the
    // fixed type ramp and fixed row heights depend on. React Native's own
    // components do not, and React 19 removed `defaultProps`, so there is no
    // way to set it globally — the import is the only enforcement point.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/text.tsx', 'src/hooks/use-keyboard-aware-scroll.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Text', 'TextInput'],
              message:
                "Import Text / TextInput from '@/components/text' — react-native's resize with the phone's font-size setting and break the layout.",
            },
          ],
        },
      ],
    },
  },
]);
