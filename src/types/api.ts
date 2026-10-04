export type CommentSort = 'newest' | 'oldest';

export type GameSort = 'name-asc' | 'name-desc' | 'rating-asc' | 'rating-desc';

export type IsoDateString = string;

export interface ApiDataEnvelope<TData> {
  readonly data: TData;
}

export interface ApiEnvelope<TData, TMeta> extends ApiDataEnvelope<TData> {
  readonly meta: TMeta;
}

export interface ApiErrorPayload {
  readonly error: string;
}

export interface GameCategory {
  readonly isDefault: boolean;
  readonly label: string;
  readonly slug: string;
}

export interface CatalogMeta {
  readonly description: string;
  readonly totalItems: number;
}

export type CategoriesResponse = ApiEnvelope<
  readonly GameCategory[],
  CatalogMeta
>;

export interface LeaderboardEntry {
  readonly favoriteGameName: string;
  readonly favoriteGameSlug: string;
  readonly gamesPlayed: number;
  readonly playerName: string;
  readonly rank: number;
  readonly streakDays: number;
  readonly totalScore: number;
}

export type LeaderboardResponse = ApiEnvelope<
  readonly LeaderboardEntry[],
  CatalogMeta
>;

export interface GameSummary {
  readonly cardImage: string;
  readonly category: string;
  readonly likesCount: number;
  readonly name: string;
  readonly price: string;
  readonly rating: number;
  readonly shortDescription: string;
  readonly slug: string;
}

export interface FeaturedGamesFilter {
  readonly featured: true;
}

export interface LibraryGamesFilter {
  readonly category: string;
  readonly sort: GameSort;
}

export type AppliedGamesFilter = FeaturedGamesFilter | LibraryGamesFilter;

export interface GamesMeta {
  readonly appliedFilter: AppliedGamesFilter;
  readonly limit: number;
  readonly page: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export type GamesResponse = ApiEnvelope<readonly GameSummary[], GamesMeta>;

export interface GameRecord {
  readonly achievedAt: IsoDateString;
  readonly playerName: string;
  readonly position: number;
  readonly score: number;
}

export interface GameSpecs {
  readonly duration: string;
  readonly genre: string;
  readonly players: string;
  readonly price: string;
}

export interface GameDetails {
  readonly fullDescription: string;
  readonly heroImage: string;
  readonly isLikedByCurrentUser: boolean;
  readonly likesCount: number;
  readonly name: string;
  readonly rating: number;
  readonly slug: string;
  readonly specs: GameSpecs;
  readonly topRecords: readonly GameRecord[];
}

export type GameDetailsResponse = ApiDataEnvelope<GameDetails>;

export interface GameComment {
  readonly authorName: string;
  readonly commentId: string;
  readonly createdAt: IsoDateString;
  readonly isLikedByCurrentUser: boolean;
  readonly likesCount: number;
  readonly text: string;
}

export interface CommentsMeta {
  readonly returnedCount: number;
  readonly sort?: CommentSort;
  readonly totalComments: number;
}

export type CommentsResponse = ApiEnvelope<
  readonly GameComment[],
  CommentsMeta
>;
