import { type UserConfig, defineConfig } from 'vite';
import 'vitest/config';

const testConfig = {
  passWithNoTests: true,
} as const satisfies UserConfig['test'];

export default defineConfig({
  test: {
    ...testConfig,
  },
});
