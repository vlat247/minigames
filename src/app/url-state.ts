import type { GameSort } from '../types/api';

export const LIBRARY_CATEGORY_VALUES = [
  'all',
  'puzzle',
  'card',
  'match',
  'farm',
  'strategy',
  'arcade',
] as const;

export type LibraryCategory = (typeof LIBRARY_CATEGORY_VALUES)[number];

export const LIBRARY_SORT_VALUES = [
  'rating-desc',
  'rating-asc',
  'name-asc',
  'name-desc',
] as const satisfies readonly GameSort[];

export const AUTH_MODES = ['login', 'register'] as const;

export type AuthMode = (typeof AUTH_MODES)[number];

export const DEFAULT_LIBRARY_CATEGORY: LibraryCategory = 'all';
export const DEFAULT_LIBRARY_SORT: GameSort = 'rating-desc';
export const DEFAULT_LIBRARY_PAGE: number = 1;

export interface UrlState {
  readonly auth: AuthMode | undefined;
  readonly category: LibraryCategory;
  readonly game: string | undefined;
  readonly page: number;
  readonly sort: GameSort;
}

export interface NormalizeUrlStateOptions {
  readonly includeDialogs?: boolean;
  readonly includeLibraryState?: boolean;
}

export interface UrlStateUpdate {
  readonly auth?: AuthMode | null;
  readonly category?: LibraryCategory | null;
  readonly game?: string | null;
  readonly page?: number | null;
  readonly sort?: GameSort | null;
}

const SEARCH_PARAMETERS = {
  auth: 'auth',
  category: 'category',
  game: 'game',
  page: 'page',
  sort: 'sort',
} as const;

const POSITIVE_INTEGER_PATTERN: RegExp = /^[1-9]\d*$/;

const isOneOf = <Value extends string>(
  value: string | null,
  allowedValues: readonly Value[],
): value is Value => {
  return value !== null && allowedValues.includes(value as Value);
};

export const isAuthMode = (value: string | null): value is AuthMode => {
  return isOneOf(value, AUTH_MODES);
};

export const isLibraryCategory = (
  value: string | null,
): value is LibraryCategory => {
  return isOneOf(value, LIBRARY_CATEGORY_VALUES);
};

export const isLibrarySort = (value: string | null): value is GameSort => {
  return isOneOf(value, LIBRARY_SORT_VALUES);
};

const getOptionalValue = (value: string | null): string | undefined => {
  const normalizedValue: string = value?.trim() ?? '';
  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

const getPage = (value: string | null): number => {
  if (value === null || !POSITIVE_INTEGER_PATTERN.test(value)) {
    return DEFAULT_LIBRARY_PAGE;
  }

  const page: number = Number(value);
  return Number.isSafeInteger(page) ? page : DEFAULT_LIBRARY_PAGE;
};

export const parseUrlState = (source: URL | URLSearchParams): UrlState => {
  const searchParameters: URLSearchParams =
    source instanceof URL ? source.searchParams : source;
  const categoryValue: string | null = searchParameters.get(
    SEARCH_PARAMETERS.category,
  );
  const sortValue: string | null = searchParameters.get(SEARCH_PARAMETERS.sort);
  const game: string | undefined = getOptionalValue(
    searchParameters.get(SEARCH_PARAMETERS.game),
  );
  const authValue: string | null = searchParameters.get(SEARCH_PARAMETERS.auth);

  return {
    auth: game === undefined && isAuthMode(authValue) ? authValue : undefined,
    category: isLibraryCategory(categoryValue)
      ? categoryValue
      : DEFAULT_LIBRARY_CATEGORY,
    game,
    page: getPage(searchParameters.get(SEARCH_PARAMETERS.page)),
    sort: isLibrarySort(sortValue) ? sortValue : DEFAULT_LIBRARY_SORT,
  };
};

const setOptionalParameter = (
  searchParameters: URLSearchParams,
  key: string,
  value: string | null | undefined,
): void => {
  const normalizedValue: string | undefined = getOptionalValue(value ?? null);

  if (normalizedValue === undefined) {
    searchParameters.delete(key);
    return;
  }

  searchParameters.set(key, normalizedValue);
};

export const serializeUrlState = (
  state: UrlState,
  source: URLSearchParams = new URLSearchParams(),
): URLSearchParams => {
  const searchParameters: URLSearchParams = new URLSearchParams(source);

  searchParameters.set(SEARCH_PARAMETERS.category, state.category);
  searchParameters.set(SEARCH_PARAMETERS.sort, state.sort);
  searchParameters.set(SEARCH_PARAMETERS.page, String(state.page));
  setOptionalParameter(searchParameters, SEARCH_PARAMETERS.game, state.game);
  setOptionalParameter(searchParameters, SEARCH_PARAMETERS.auth, state.auth);

  return searchParameters;
};

export const updateUrlState = (source: URL, update: UrlStateUpdate): URL => {
  const url: URL = new URL(source);

  if ('category' in update) {
    if (update.category === null || update.category === undefined) {
      url.searchParams.delete(SEARCH_PARAMETERS.category);
    } else if (isLibraryCategory(update.category)) {
      url.searchParams.set(SEARCH_PARAMETERS.category, update.category);
    } else {
      throw new TypeError(`Unsupported Library category: ${update.category}`);
    }
  }

  if ('sort' in update) {
    if (update.sort === null || update.sort === undefined) {
      url.searchParams.delete(SEARCH_PARAMETERS.sort);
    } else if (isLibrarySort(update.sort)) {
      url.searchParams.set(SEARCH_PARAMETERS.sort, update.sort);
    } else {
      throw new TypeError(`Unsupported Library sort value: ${update.sort}`);
    }
  }

  if ('page' in update) {
    if (update.page === null || update.page === undefined) {
      url.searchParams.delete(SEARCH_PARAMETERS.page);
    } else if (
      Number.isSafeInteger(update.page) &&
      update.page >= DEFAULT_LIBRARY_PAGE
    ) {
      url.searchParams.set(SEARCH_PARAMETERS.page, String(update.page));
    } else {
      throw new RangeError('Library page must be a positive safe integer.');
    }
  }

  if ('game' in update) {
    setOptionalParameter(url.searchParams, SEARCH_PARAMETERS.game, update.game);
    if (getOptionalValue(update.game ?? null) !== undefined) {
      url.searchParams.delete(SEARCH_PARAMETERS.auth);
    }
  }

  if ('auth' in update) {
    if (update.auth === null || update.auth === undefined) {
      url.searchParams.delete(SEARCH_PARAMETERS.auth);
    } else if (isAuthMode(update.auth)) {
      url.searchParams.set(SEARCH_PARAMETERS.auth, update.auth);
      url.searchParams.delete(SEARCH_PARAMETERS.game);
    } else {
      throw new TypeError(`Unsupported auth mode: ${update.auth}`);
    }
  }

  return url;
};

export const normalizeUrlState = (
  source: URL,
  options: NormalizeUrlStateOptions = {},
): URL => {
  const url: URL = new URL(source);
  const state: UrlState = parseUrlState(url);

  if (options.includeLibraryState === true) {
    url.searchParams.set(SEARCH_PARAMETERS.category, state.category);
    url.searchParams.set(SEARCH_PARAMETERS.sort, state.sort);
    url.searchParams.set(SEARCH_PARAMETERS.page, String(state.page));
  } else {
    url.searchParams.delete(SEARCH_PARAMETERS.category);
    url.searchParams.delete(SEARCH_PARAMETERS.sort);
    url.searchParams.delete(SEARCH_PARAMETERS.page);
  }

  if (options.includeDialogs === false) {
    url.searchParams.delete(SEARCH_PARAMETERS.game);
    url.searchParams.delete(SEARCH_PARAMETERS.auth);
  } else {
    setOptionalParameter(url.searchParams, SEARCH_PARAMETERS.game, state.game);
    setOptionalParameter(url.searchParams, SEARCH_PARAMETERS.auth, state.auth);
  }

  return url;
};

export type { GameSort } from '../types/api';
