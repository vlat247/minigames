import type {
  CategoriesResponse,
  CommentSort,
  CommentsResponse,
  GameDetailsResponse,
  GamesResponse,
  GameSort,
  LeaderboardResponse,
} from '../types/api';
import { getApiJson, type ApiRequestOptions } from './api-client';

export interface LibraryGamesQuery {
  readonly category: string;
  readonly limit: number;
  readonly page: number;
  readonly sort: GameSort;
}

export interface GameDetailsRequestOptions extends ApiRequestOptions {
  readonly userEmail?: string;
}

export interface GameCommentsRequestOptions extends ApiRequestOptions {
  readonly limit?: number;
  readonly sort?: CommentSort;
  readonly userEmail?: string;
}

const createPath = (pathname: string, parameters: URLSearchParams): string => {
  const query: string = parameters.toString();
  return query.length === 0 ? pathname : `${pathname}?${query}`;
};

const createGamePath = (gameSlug: string): string => {
  return `/api/games/${encodeURIComponent(gameSlug)}`;
};

export const fetchCategories = (
  options: ApiRequestOptions = {},
): Promise<CategoriesResponse> => {
  return getApiJson<CategoriesResponse>('/api/categories', options);
};

export const fetchLeaderboard = (
  options: ApiRequestOptions = {},
): Promise<LeaderboardResponse> => {
  return getApiJson<LeaderboardResponse>('/api/leaderboard', options);
};

export const fetchFeaturedGames = (
  options: ApiRequestOptions = {},
): Promise<GamesResponse> => {
  return getApiJson<GamesResponse>('/api/games?featured=true', options);
};

export const fetchLibraryGames = (
  query: LibraryGamesQuery,
  options: ApiRequestOptions = {},
): Promise<GamesResponse> => {
  const parameters: URLSearchParams = new URLSearchParams({
    category: query.category,
    limit: String(query.limit),
    page: String(query.page),
    sort: query.sort,
  });

  return getApiJson<GamesResponse>(
    createPath('/api/games', parameters),
    options,
  );
};

export const fetchGameDetails = (
  gameSlug: string,
  options: GameDetailsRequestOptions = {},
): Promise<GameDetailsResponse> => {
  const parameters: URLSearchParams = new URLSearchParams();

  if (options.userEmail !== undefined) {
    parameters.set('userEmail', options.userEmail);
  }

  return getApiJson<GameDetailsResponse>(
    createPath(createGamePath(gameSlug), parameters),
    { signal: options.signal },
  );
};

export const fetchGameComments = (
  gameSlug: string,
  options: GameCommentsRequestOptions = {},
): Promise<CommentsResponse> => {
  const parameters: URLSearchParams = new URLSearchParams();

  if (options.limit !== undefined) {
    parameters.set('limit', String(options.limit));
  }

  if (options.sort !== undefined) {
    parameters.set('sort', options.sort);
  }

  if (options.userEmail !== undefined) {
    parameters.set('userEmail', options.userEmail);
  }

  return getApiJson<CommentsResponse>(
    createPath(`${createGamePath(gameSlug)}/comments`, parameters),
    { signal: options.signal },
  );
};
