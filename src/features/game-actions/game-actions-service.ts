import type { AppSession } from '../auth/app-session';
import type { SessionController } from '../auth/session-controller';
import {
  createGameComment,
  toggleCommentLike as requestCommentLikeToggle,
  toggleGameFavorite,
} from '../../services/minigames-api';
import type { ApiRequestOptions } from '../../services/api-client';
import type {
  CommentLikeResult,
  CommentLikeResponse,
  CreateCommentResponse,
  FavoriteGameResponse,
  FavoriteGameResult,
  GameComment,
} from '../../types/api';

export const AUTHENTICATION_REQUIRED_MESSAGE =
  'Sign in to use this feature.' as const;

export const COMMENT_VALIDATION_MESSAGES = {
  authorNameLength:
    'Your profile name must be between 2 and 30 characters.' as const,
  textLength: 'Comments must be 500 characters or fewer.' as const,
  textRequired: 'Write a comment before sending.' as const,
};

export type CommentValidationErrorCode =
  'author-name-length' | 'text-length' | 'text-required';

export type GameActionResponseKind =
  'comment-create' | 'comment-like' | 'favorite';

export class AuthenticationRequiredError extends Error {
  public constructor() {
    super(AUTHENTICATION_REQUIRED_MESSAGE);
    this.name = 'AuthenticationRequiredError';
  }
}

export class CommentValidationError extends Error {
  public readonly code: CommentValidationErrorCode;

  public constructor(code: CommentValidationErrorCode) {
    let message: string;

    switch (code) {
      case 'author-name-length': {
        message = COMMENT_VALIDATION_MESSAGES.authorNameLength;
        break;
      }
      case 'text-length': {
        message = COMMENT_VALIDATION_MESSAGES.textLength;
        break;
      }
      case 'text-required': {
        message = COMMENT_VALIDATION_MESSAGES.textRequired;
        break;
      }
    }

    super(message);
    this.name = 'CommentValidationError';
    this.code = code;
  }
}

export class GameActionResponseError extends Error {
  public readonly kind: GameActionResponseKind;

  public readonly response: unknown;

  public constructor(kind: GameActionResponseKind, response: unknown) {
    super('The MiniGames API returned an invalid game-action response.');
    this.name = 'GameActionResponseError';
    this.kind = kind;
    this.response = response;
  }
}

export type FavoriteMutation = typeof toggleGameFavorite;
export type CommentSubmissionMutation = typeof createGameComment;
export type CommentLikeMutation = typeof requestCommentLikeToggle;

export interface AuthenticatedGameActionsServiceOptions {
  readonly sessionController: Pick<SessionController, 'requireActiveSession'>;
  readonly submitComment?: CommentSubmissionMutation;
  readonly toggleFavorite?: FavoriteMutation;
  readonly toggleLike?: CommentLikeMutation;
}

export interface AuthenticatedGameActionsService {
  readonly getActiveSession: () => AppSession | undefined;
  readonly submitComment: (
    gameSlug: string,
    text: string,
    options?: ApiRequestOptions,
  ) => Promise<GameComment>;
  readonly toggleCommentLike: (
    commentId: string,
    options?: ApiRequestOptions,
  ) => Promise<CommentLikeResult>;
  readonly toggleFavorite: (
    gameSlug: string,
    options?: ApiRequestOptions,
  ) => Promise<FavoriteGameResult>;
}

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonnegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const hasString = (value: Record<PropertyKey, unknown>, key: string): boolean =>
  typeof value[key] === 'string';

const getResponseData = (response: unknown): unknown =>
  isRecord(response) ? response.data : undefined;

const isFavoriteResult = (
  value: unknown,
  requestedGameSlug: string,
): value is FavoriteGameResult =>
  isRecord(value) &&
  value.gameSlug === requestedGameSlug &&
  typeof value.isFavorited === 'boolean' &&
  isNonnegativeSafeInteger(value.likesCount);

const isCommentLikeResult = (value: unknown): value is CommentLikeResult =>
  isRecord(value) &&
  typeof value.isLikedByCurrentUser === 'boolean' &&
  isNonnegativeSafeInteger(value.likesCount);

const isGameComment = (value: unknown): value is GameComment =>
  isRecord(value) &&
  hasString(value, 'authorName') &&
  hasString(value, 'commentId') &&
  hasString(value, 'createdAt') &&
  typeof value.isLikedByCurrentUser === 'boolean' &&
  isNonnegativeSafeInteger(value.likesCount) &&
  hasString(value, 'text') &&
  (value.commentId as string).trim().length > 0 &&
  (value.createdAt as string).trim().length > 0;

const unwrapFavoriteResponse = (
  response: FavoriteGameResponse,
  requestedGameSlug: string,
): FavoriteGameResult => {
  const data: unknown = getResponseData(response);

  if (!isFavoriteResult(data, requestedGameSlug)) {
    throw new GameActionResponseError('favorite', response);
  }

  return data;
};

const unwrapCommentResponse = (
  response: CreateCommentResponse,
): GameComment => {
  const data: unknown = getResponseData(response);

  if (!isGameComment(data)) {
    throw new GameActionResponseError('comment-create', response);
  }

  return data;
};

const unwrapCommentLikeResponse = (
  response: CommentLikeResponse,
): CommentLikeResult => {
  const data: unknown = getResponseData(response);

  if (!isCommentLikeResult(data)) {
    throw new GameActionResponseError('comment-like', response);
  }

  return data;
};

const validateComment = (
  session: AppSession,
  rawText: string,
): { readonly authorName: string; readonly text: string } => {
  const authorName: string = session.displayName.trim();

  if (authorName.length < 2 || authorName.length > 30) {
    throw new CommentValidationError('author-name-length');
  }

  const text: string = rawText.trim();

  if (text.length === 0) {
    throw new CommentValidationError('text-required');
  }

  if (text.length > 500) {
    throw new CommentValidationError('text-length');
  }

  return { authorName, text };
};

export const createAuthenticatedGameActionsService = (
  options: AuthenticatedGameActionsServiceOptions,
): AuthenticatedGameActionsService => {
  const {
    sessionController,
    submitComment = createGameComment,
    toggleFavorite = toggleGameFavorite,
    toggleLike = requestCommentLikeToggle,
  } = options;

  const requireSession = (): AppSession => {
    const session: AppSession | undefined =
      sessionController.requireActiveSession();

    if (session === undefined) {
      throw new AuthenticationRequiredError();
    }

    return session;
  };

  return {
    getActiveSession: (): AppSession | undefined =>
      sessionController.requireActiveSession(),
    submitComment: async (
      gameSlug: string,
      rawText: string,
      requestOptions: ApiRequestOptions = {},
    ): Promise<GameComment> => {
      const session: AppSession = requireSession();
      const { authorName, text } = validateComment(session, rawText);
      const response: CreateCommentResponse = await submitComment(
        gameSlug,
        {
          authorName,
          text,
          userEmail: session.email,
        },
        requestOptions,
      );

      return unwrapCommentResponse(response);
    },
    toggleCommentLike: async (
      commentId: string,
      requestOptions: ApiRequestOptions = {},
    ): Promise<CommentLikeResult> => {
      const session: AppSession = requireSession();
      const response: CommentLikeResponse = await toggleLike(
        commentId,
        session.email,
        requestOptions,
      );

      return unwrapCommentLikeResponse(response);
    },
    toggleFavorite: async (
      gameSlug: string,
      requestOptions: ApiRequestOptions = {},
    ): Promise<FavoriteGameResult> => {
      const session: AppSession = requireSession();
      const response: FavoriteGameResponse = await toggleFavorite(
        gameSlug,
        session.email,
        requestOptions,
      );

      return unwrapFavoriteResponse(response, gameSlug);
    },
  };
};
