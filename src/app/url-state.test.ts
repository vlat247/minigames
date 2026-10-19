import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIBRARY_CATEGORY,
  DEFAULT_LIBRARY_PAGE,
  DEFAULT_LIBRARY_SORT,
  isAuthMode,
  isLibraryCategory,
  isLibrarySort,
  normalizeUrlState,
  parseUrlState,
  serializeUrlState,
  updateUrlState,
  type AuthMode,
  type GameSort,
  type LibraryCategory,
} from './url-state';

const createLibraryUrl = (search = ''): URL => {
  return new URL(`https://minigames.example/library${search}`);
};

describe('URL state value guards', () => {
  it('recognizes supported values and rejects unsupported or missing values', () => {
    expect(isAuthMode('login')).toBe(true);
    expect(isAuthMode('register')).toBe(true);
    expect(isAuthMode('reset')).toBe(false);
    expect(isAuthMode(null)).toBe(false);

    expect(isLibraryCategory('puzzle')).toBe(true);
    expect(isLibraryCategory('all')).toBe(true);
    expect(isLibraryCategory('racing')).toBe(false);
    expect(isLibraryCategory(null)).toBe(false);

    expect(isLibrarySort('rating-desc')).toBe(true);
    expect(isLibrarySort('name-asc')).toBe(true);
    expect(isLibrarySort('popular-desc')).toBe(false);
    expect(isLibrarySort(null)).toBe(false);
  });
});

describe('parseUrlState', () => {
  it('returns library defaults when state parameters are absent', () => {
    expect(parseUrlState(createLibraryUrl('?campaign=autumn'))).toEqual({
      auth: undefined,
      category: DEFAULT_LIBRARY_CATEGORY,
      game: undefined,
      page: DEFAULT_LIBRARY_PAGE,
      sort: DEFAULT_LIBRARY_SORT,
    });
  });

  it('parses supported library and dialog state from a URL', () => {
    const url = createLibraryUrl(
      '?category=strategy&sort=name-desc&page=12&auth=register',
    );

    expect(parseUrlState(url)).toEqual({
      auth: 'register',
      category: 'strategy',
      game: undefined,
      page: 12,
      sort: 'name-desc',
    });
  });

  it('accepts URLSearchParams and trims a game slug', () => {
    const parameters = new URLSearchParams(
      'category=arcade&sort=rating-asc&page=3&game=%20snake%20',
    );

    expect(parseUrlState(parameters)).toEqual({
      auth: undefined,
      category: 'arcade',
      game: 'snake',
      page: 3,
      sort: 'rating-asc',
    });
  });

  it('gives an open game precedence over an auth dialog', () => {
    const state = parseUrlState(
      createLibraryUrl('?game=minesweeper&auth=login'),
    );

    expect(state.game).toBe('minesweeper');
    expect(state.auth).toBeUndefined();
  });

  it('falls back for unsupported category, sort, and auth values', () => {
    const state = parseUrlState(
      createLibraryUrl('?category=racing&sort=popular&auth=reset'),
    );

    expect(state).toEqual({
      auth: undefined,
      category: DEFAULT_LIBRARY_CATEGORY,
      game: undefined,
      page: DEFAULT_LIBRARY_PAGE,
      sort: DEFAULT_LIBRARY_SORT,
    });
  });

  it.each([
    ['an empty value', ''],
    ['zero', '0'],
    ['a negative integer', '-1'],
    ['a decimal', '1.5'],
    ['a leading-zero integer', '01'],
    ['surrounding whitespace', '%202%20'],
    ['an unsafe integer', '9007199254740992'],
  ])('uses the default page for %s', (_caseName, pageValue) => {
    const state = parseUrlState(createLibraryUrl(`?page=${pageValue}`));

    expect(state.page).toBe(DEFAULT_LIBRARY_PAGE);
  });

  it('treats a blank game parameter as absent', () => {
    const state = parseUrlState(createLibraryUrl('?game=%20%20&auth=login'));

    expect(state.game).toBeUndefined();
    expect(state.auth).toBe('login');
  });
});

describe('serializeUrlState', () => {
  it('serializes the complete state while preserving unrelated parameters', () => {
    const source = new URLSearchParams('campaign=autumn');
    const serialized = serializeUrlState(
      {
        auth: 'register',
        category: 'card',
        game: undefined,
        page: 4,
        sort: 'name-asc',
      },
      source,
    );

    expect(Object.fromEntries(serialized)).toEqual({
      auth: 'register',
      campaign: 'autumn',
      category: 'card',
      page: '4',
      sort: 'name-asc',
    });
    expect(source.toString()).toBe('campaign=autumn');
  });

  it('trims optional values and removes blank optional parameters', () => {
    const serialized = serializeUrlState(
      {
        auth: undefined,
        category: 'all',
        game: '  tic-tac-toe  ',
        page: 1,
        sort: 'rating-desc',
      },
      new URLSearchParams('auth=login&game=old-game'),
    );

    expect(serialized.get('game')).toBe('tic-tac-toe');
    expect(serialized.has('auth')).toBe(false);
  });

  it('round-trips a valid state through search parameters', () => {
    const expectedState = {
      auth: undefined,
      category: 'farm' as const,
      game: 'harvest-rush',
      page: 7,
      sort: 'rating-asc' as const,
    };

    expect(parseUrlState(serializeUrlState(expectedState))).toEqual(
      expectedState,
    );
  });
});

describe('updateUrlState', () => {
  it('updates library state without mutating the source URL', () => {
    const source = createLibraryUrl(
      '?category=all&sort=rating-desc&page=1&campaign=autumn#games',
    );
    const updated = updateUrlState(source, {
      category: 'match',
      page: 5,
      sort: 'name-desc',
    });

    expect(updated.searchParams.get('category')).toBe('match');
    expect(updated.searchParams.get('sort')).toBe('name-desc');
    expect(updated.searchParams.get('page')).toBe('5');
    expect(updated.searchParams.get('campaign')).toBe('autumn');
    expect(updated.hash).toBe('#games');
    expect(source.searchParams.get('category')).toBe('all');
    expect(source.searchParams.get('page')).toBe('1');
  });

  it('opens a trimmed game and closes the auth dialog', () => {
    const updated = updateUrlState(createLibraryUrl('?auth=login'), {
      game: '  snake  ',
    });

    expect(updated.searchParams.get('game')).toBe('snake');
    expect(updated.searchParams.has('auth')).toBe(false);
  });

  it('opens an auth dialog and closes the game dialog', () => {
    const updated = updateUrlState(createLibraryUrl('?game=snake'), {
      auth: 'register',
    });

    expect(updated.searchParams.get('auth')).toBe('register');
    expect(updated.searchParams.has('game')).toBe(false);
  });

  it('lets auth win when a single update requests both dialogs', () => {
    const updated = updateUrlState(createLibraryUrl(), {
      auth: 'login',
      game: 'snake',
    });

    expect(updated.searchParams.get('auth')).toBe('login');
    expect(updated.searchParams.has('game')).toBe(false);
  });

  it('removes state parameters requested with null or undefined', () => {
    const source = createLibraryUrl(
      '?category=card&sort=name-asc&page=8&game=snake&auth=login',
    );
    const updated = updateUrlState(source, {
      auth: null,
      category: null,
      game: undefined,
      page: null,
      sort: undefined,
    });

    expect(updated.searchParams.has('category')).toBe(false);
    expect(updated.searchParams.has('sort')).toBe(false);
    expect(updated.searchParams.has('page')).toBe(false);
    expect(updated.searchParams.has('game')).toBe(false);
    expect(updated.searchParams.has('auth')).toBe(false);
  });

  it('deletes a blank game without changing the current auth dialog', () => {
    const updated = updateUrlState(createLibraryUrl('?game=snake&auth=login'), {
      game: ' '.repeat(3),
    });

    expect(updated.searchParams.has('game')).toBe(false);
    expect(updated.searchParams.get('auth')).toBe('login');
  });

  it('rejects unsupported category, sort, and auth values', () => {
    const source = createLibraryUrl();

    expect(() =>
      updateUrlState(source, {
        category: 'racing' as LibraryCategory,
      }),
    ).toThrowError(new TypeError('Unsupported Library category: racing'));
    expect(() =>
      updateUrlState(source, {
        sort: 'popular-desc' as GameSort,
      }),
    ).toThrowError(
      new TypeError('Unsupported Library sort value: popular-desc'),
    );
    expect(() =>
      updateUrlState(source, {
        auth: 'reset' as AuthMode,
      }),
    ).toThrowError(new TypeError('Unsupported auth mode: reset'));
  });

  it.each([0, -1, 1.5, NaN, Infinity, 9_007_199_254_740_992])(
    'rejects invalid page value %s',
    (page) => {
      expect(() => updateUrlState(createLibraryUrl(), { page })).toThrowError(
        new RangeError('Library page must be a positive safe integer.'),
      );
    },
  );
});

describe('normalizeUrlState', () => {
  it('removes library state by default and normalizes dialog state', () => {
    const source = createLibraryUrl(
      '?category=puzzle&sort=name-asc&page=2&game=%20snake%20&auth=login&campaign=autumn',
    );
    const normalized = normalizeUrlState(source);

    expect(Object.fromEntries(normalized.searchParams)).toEqual({
      campaign: 'autumn',
      game: 'snake',
    });
    expect(source.searchParams.get('category')).toBe('puzzle');
    expect(source.searchParams.get('game')).toBe(' snake ');
  });

  it('writes default library values for invalid or missing state', () => {
    const normalized = normalizeUrlState(
      createLibraryUrl('?category=racing&sort=popular&page=0&campaign=autumn'),
      { includeLibraryState: true },
    );

    expect(normalized.searchParams.get('category')).toBe(
      DEFAULT_LIBRARY_CATEGORY,
    );
    expect(normalized.searchParams.get('sort')).toBe(DEFAULT_LIBRARY_SORT);
    expect(normalized.searchParams.get('page')).toBe(
      String(DEFAULT_LIBRARY_PAGE),
    );
    expect(normalized.searchParams.get('campaign')).toBe('autumn');
  });

  it('removes both dialog parameters when dialogs are excluded', () => {
    const normalized = normalizeUrlState(
      createLibraryUrl('?game=snake&auth=login&category=arcade'),
      { includeDialogs: false, includeLibraryState: true },
    );

    expect(normalized.searchParams.has('game')).toBe(false);
    expect(normalized.searchParams.has('auth')).toBe(false);
    expect(normalized.searchParams.get('category')).toBe('arcade');
  });

  it('keeps a valid auth dialog when no game dialog is present', () => {
    const normalized = normalizeUrlState(
      createLibraryUrl('?auth=register&game=%20%20'),
    );

    expect(Object.fromEntries(normalized.searchParams)).toEqual({
      auth: 'register',
    });
  });
});
