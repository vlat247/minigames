import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        pretendToBeVisual: true,
        url: 'http://localhost/',
      },
    },
    restoreMocks: true,
    setupFiles: ['./src/test/setup.ts'],
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Test sources verify application code; they are not application logic.
        'src/**/*.{test,spec}.{ts,tsx}',
        // Shared test setup is infrastructure rather than shipped application code.
        'src/test/**',
        // Declaration and type-only modules have no executable runtime behavior.
        'src/**/*.d.ts',
        'src/types/**',
      ],
    },
  },
});
