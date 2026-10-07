import { afterEach, describe, expect, it, vi } from 'vitest';

type PathsModule = typeof import('./paths');

const importPathsWithBase = async (baseUrl: string): Promise<PathsModule> => {
  vi.stubEnv('BASE_URL', baseUrl);
  vi.resetModules();

  return import('./paths');
};

describe('application paths', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('with the root base path', () => {
    it.each([
      ['library', '/library'],
      ['/library', '/library'],
      ['///games/42', '/games/42'],
      ['', '/'],
    ])('builds %s as %s', async (path, expected) => {
      const { getAppPath } = await importPathsWithBase('/');

      expect(getAppPath(path)).toBe(expected);
    });

    it('keeps route pathnames unchanged', async () => {
      const { getRoutePath } = await importPathsWithBase('/');

      expect(getRoutePath('/library')).toBe('/library');
      expect(getRoutePath('/')).toBe('/');
    });
  });

  describe('with a nested base path', () => {
    it('builds app paths without duplicate leading slashes', async () => {
      const { getAppPath } = await importPathsWithBase('/minigames/');

      expect(getAppPath('library')).toBe('/minigames/library');
      expect(getAppPath('///games/42')).toBe('/minigames/games/42');
    });

    it.each(['/minigames', '/minigames/'])(
      'maps the base pathname %s to the root route',
      async (pathname) => {
        const { getRoutePath } = await importPathsWithBase('/minigames/');

        expect(getRoutePath(pathname)).toBe('/');
      },
    );

    it('strips the configured base from nested routes', async () => {
      const { getRoutePath } = await importPathsWithBase('/minigames/');

      expect(getRoutePath('/minigames/library')).toBe('/library');
      expect(getRoutePath('/minigames/games/42')).toBe('/games/42');
    });

    it('leaves pathnames outside the configured base unchanged', async () => {
      const { getRoutePath } = await importPathsWithBase('/minigames/');

      expect(getRoutePath('/other/library')).toBe('/other/library');
    });
  });
});
