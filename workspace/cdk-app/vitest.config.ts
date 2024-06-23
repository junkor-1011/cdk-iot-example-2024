import { defineConfig } from 'vite';
import 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['./test/**/*.(test|spec).ts'],
    pool: 'forks',
  },
});
