import { describe, expect, it, vi } from 'vitest';

import type { AppSession } from '../auth/app-session';
import {
  AUTHENTICATION_REQUIRED_MESSAGE,
  AuthenticationRequiredError,
  COMMENT_VALIDATION_MESSAGES,
  GameActionResponseError,
  createAuthenticatedGameActionsService,
  type CommentLikeMutation,
  type CommentSubmissionMutation,
  type FavoriteMutation,
} from './game-actions-service';

const SESSION: AppSession = {
  authenticatedAt: 1_700_000_000_000,
  displayName: 'Ada Player',
  email: 'ada@example.com',
};

const FAVORITE_RESPONSE = {
  data: {
    gameSlug: 'cozy-minesweeper',
    isFavorited: true,
    likesCount: 12,
  },
} as const;

const COMMENT = {
  authorName: 'Ada Player',
  commentId: 'comment-42',
  createdAt: '2026-10-09T08:15:00.000Z',
  isLikedByCurrentUser: false,
  likesCount: 0,
  text: 'Excellent game!',
} as const;

const COMMENT_LIKE_RESPONSE = {
  data: {
    isLikedByCurrentUser: true,
    likesCount: 5,
  },
} as const;

interface HarnessOptions {
  readonly session?: AppSession | null;
}

const createHarness = (options: HarnessOptions = {}) => {
  const requireActiveSession = vi.fn(() =>
    options.session === null ? undefined : (options.session ?? SESSION),
  );
  const toggleFavorite = vi.fn<FavoriteMutation>(async () => FAVORITE_RESPONSE);
  const submitComment = vi.fn<CommentSubmissionMutation>(async () => ({
    data: COMMENT,
  }));
  const toggleLike = vi.fn<CommentLikeMutation>(
    async () => COMMENT_LIKE_RESPONSE,
  );
  const service = createAuthenticatedGameActionsService({
    sessionController: { requireActiveSession },
    submitComment,
    toggleFavorite,
    toggleLike,
  });

  return {
    requireActiveSession,
    service,
    submitComment,
    toggleFavorite,
    toggleLike,
  };
};

describe('authenticated game-actions service', () => {
  it('reads the currently active session through the validating controller', () => {
    const harness = createHarness();

    expect(harness.service.getActiveSession()).toBe(SESSION);
    expect(harness.requireActiveSession).toHaveBeenCalledOnce();
  });

  it.each(['favorite', 'comment', 'like'] as const)(
    'rejects a guest %s mutation before calling the API',
    async (action) => {
      const harness = createHarness({ session: null });

      let request: Promise<unknown>;

      switch (action) {
        case 'favorite': {
          request = harness.service.toggleFavorite('cozy-minesweeper');
          break;
        }
        case 'comment': {
          request = harness.service.submitComment(
            'cozy-minesweeper',
            'Excellent game!',
          );
          break;
        }
        case 'like': {
          request = harness.service.toggleCommentLike('comment-42');
          break;
        }
      }

      await expect(request).rejects.toMatchObject({
        message: AUTHENTICATION_REQUIRED_MESSAGE,
        name: 'AuthenticationRequiredError',
      });
      await expect(request).rejects.toBeInstanceOf(AuthenticationRequiredError);
      expect(harness.requireActiveSession).toHaveBeenCalledOnce();
      expect(harness.toggleFavorite).not.toHaveBeenCalled();
      expect(harness.submitComment).not.toHaveBeenCalled();
      expect(harness.toggleLike).not.toHaveBeenCalled();
    },
  );

  it('toggles a favorite with session identity and returns validated server state', async () => {
    const harness = createHarness();
    const controller = new AbortController();

    await expect(
      harness.service.toggleFavorite('cozy-minesweeper', {
        signal: controller.signal,
      }),
    ).resolves.toEqual(FAVORITE_RESPONSE.data);
    expect(harness.toggleFavorite).toHaveBeenCalledWith(
      'cozy-minesweeper',
      SESSION.email,
      { signal: controller.signal },
    );
    expect(
      harness.requireActiveSession.mock.invocationCallOrder[0],
    ).toBeLessThan(harness.toggleFavorite.mock.invocationCallOrder[0] ?? 0);
  });

  it.each([
    [{ data: { ...FAVORITE_RESPONSE.data, gameSlug: 'different-game' } }],
    [{ data: { ...FAVORITE_RESPONSE.data, isFavorited: 'yes' } }],
    [{ data: { ...FAVORITE_RESPONSE.data, likesCount: -1 } }],
    [{ data: { ...FAVORITE_RESPONSE.data, likesCount: 1.5 } }],
    [{}],
  ])('rejects an invalid favorite response: %j', async (response) => {
    const harness = createHarness();
    harness.toggleFavorite.mockResolvedValueOnce(
      response as Awaited<ReturnType<FavoriteMutation>>,
    );

    await expect(
      harness.service.toggleFavorite('cozy-minesweeper'),
    ).rejects.toMatchObject({
      kind: 'favorite',
      name: 'GameActionResponseError',
      response,
    });
  });

  it('submits trimmed text and profile name with session identity', async () => {
    const harness = createHarness({
      session: { ...SESSION, displayName: '  Ada Player  ' },
    });
    const controller = new AbortController();

    await expect(
      harness.service.submitComment('cozy-minesweeper', '  Excellent game!\n', {
        signal: controller.signal,
      }),
    ).resolves.toEqual(COMMENT);
    expect(harness.submitComment).toHaveBeenCalledWith(
      'cozy-minesweeper',
      {
        authorName: 'Ada Player',
        text: 'Excellent game!',
        userEmail: SESSION.email,
      },
      { signal: controller.signal },
    );
    expect(
      harness.requireActiveSession.mock.invocationCallOrder[0],
    ).toBeLessThan(harness.submitComment.mock.invocationCallOrder[0] ?? 0);
  });

  it.each([
    ['', 'text-required', COMMENT_VALIDATION_MESSAGES.textRequired],
    [' \n\t ', 'text-required', COMMENT_VALIDATION_MESSAGES.textRequired],
    [
      ` ${'a'.repeat(501)} `,
      'text-length',
      COMMENT_VALIDATION_MESSAGES.textLength,
    ],
  ] as const)(
    'rejects invalid comment text without making a request: %j',
    async (text, code, message) => {
      const harness = createHarness();

      await expect(
        harness.service.submitComment('cozy-minesweeper', text),
      ).rejects.toMatchObject({
        code,
        message,
        name: 'CommentValidationError',
      });
      expect(harness.requireActiveSession).toHaveBeenCalledOnce();
      expect(harness.submitComment).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['A', 'ada@example.com', 'ada'],
    [`A${'b'.repeat(30)}`, 'grace.hopper@example.com', 'grace.hopper'],
    [' '.repeat(4), '@example.com', 'Player'],
  ])(
    'falls back from an invalid session display name %j to a valid comment author',
    async (displayName, email, expectedAuthorName) => {
      const harness = createHarness({
        session: { ...SESSION, displayName, email },
      });

      await expect(
        harness.service.submitComment('cozy-minesweeper', 'Excellent game!'),
      ).resolves.toEqual(COMMENT);
      expect(harness.submitComment).toHaveBeenCalledWith(
        'cozy-minesweeper',
        {
          authorName: expectedAuthorName,
          text: 'Excellent game!',
          userEmail: email,
        },
        {},
      );
    },
  );

  it.each([
    [{ data: { ...COMMENT, commentId: '' } }],
    [{ data: { ...COMMENT, createdAt: ' ' } }],
    [{ data: { ...COMMENT, authorName: 7 } }],
    [{ data: { ...COMMENT, text: null } }],
    [{ data: { ...COMMENT, isLikedByCurrentUser: 'false' } }],
    [{ data: { ...COMMENT, likesCount: -1 } }],
  ])('rejects an invalid created-comment response: %j', async (response) => {
    const harness = createHarness();
    harness.submitComment.mockResolvedValueOnce(
      response as Awaited<ReturnType<CommentSubmissionMutation>>,
    );

    await expect(
      harness.service.submitComment('cozy-minesweeper', 'Excellent game!'),
    ).rejects.toMatchObject({
      kind: 'comment-create',
      name: 'GameActionResponseError',
      response,
    });
  });

  it('toggles a comment like with session identity and returns server state', async () => {
    const harness = createHarness();
    const controller = new AbortController();

    await expect(
      harness.service.toggleCommentLike('comment-42', {
        signal: controller.signal,
      }),
    ).resolves.toEqual(COMMENT_LIKE_RESPONSE.data);
    expect(harness.toggleLike).toHaveBeenCalledWith(
      'comment-42',
      SESSION.email,
      { signal: controller.signal },
    );
    expect(
      harness.requireActiveSession.mock.invocationCallOrder[0],
    ).toBeLessThan(harness.toggleLike.mock.invocationCallOrder[0] ?? 0);
  });

  it.each([
    [{ data: { ...COMMENT_LIKE_RESPONSE.data, isLikedByCurrentUser: 1 } }],
    [{ data: { ...COMMENT_LIKE_RESPONSE.data, likesCount: -1 } }],
    [{ data: { ...COMMENT_LIKE_RESPONSE.data, likesCount: 2.5 } }],
    [{ data: null }],
  ])('rejects an invalid comment-like response: %j', async (response) => {
    const harness = createHarness();
    harness.toggleLike.mockResolvedValueOnce(
      response as Awaited<ReturnType<CommentLikeMutation>>,
    );

    await expect(
      harness.service.toggleCommentLike('comment-42'),
    ).rejects.toMatchObject({
      kind: 'comment-like',
      name: 'GameActionResponseError',
      response,
    });
  });

  it('preserves API failures and never retries an ambiguous mutation', async () => {
    const cause = new TypeError('network connection dropped');
    const harness = createHarness();
    harness.toggleFavorite.mockRejectedValueOnce(cause);

    const request = harness.service.toggleFavorite('cozy-minesweeper');

    await expect(request).rejects.toBe(cause);
    expect(harness.toggleFavorite).toHaveBeenCalledOnce();
    expect(harness.requireActiveSession).toHaveBeenCalledOnce();
  });

  it('marks invalid successful responses as ambiguous without retrying', async () => {
    const response = { data: { likesCount: 'unknown' } };
    const harness = createHarness();
    harness.toggleLike.mockResolvedValueOnce(
      response as unknown as Awaited<ReturnType<CommentLikeMutation>>,
    );

    const request = harness.service.toggleCommentLike('comment-42');

    await expect(request).rejects.toBeInstanceOf(GameActionResponseError);
    expect(harness.toggleLike).toHaveBeenCalledOnce();
  });

  it('accepts the exact comment boundaries after trimming', async () => {
    const harness = createHarness({
      session: { ...SESSION, displayName: `A${'b'.repeat(29)}` },
    });

    await expect(
      harness.service.submitComment('cozy-minesweeper', ` ${'x'.repeat(500)} `),
    ).resolves.toEqual(COMMENT);
    expect(harness.submitComment).toHaveBeenCalledWith(
      'cozy-minesweeper',
      expect.objectContaining({
        authorName: `A${'b'.repeat(29)}`,
        text: 'x'.repeat(500),
      }),
      {},
    );
  });
});
