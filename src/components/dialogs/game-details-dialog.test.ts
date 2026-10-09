import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import {
  AUTH_DIALOG_OPEN_EVENT,
  isAuthDialogRequestDetail,
  type AuthDialogRequestDetail,
} from './auth-dialog-events';
import {
  createGameDetailsDialog,
  type GameDetailsDialogController,
} from './game-details-dialog';
import {
  SNACKBAR_SHOW_EVENT,
  isSnackbarRequestDetail,
} from '../snackbar/snackbar-events';
import type { SnackbarOptions } from '../snackbar/snackbar';
import type { AppSession } from '../../features/auth/app-session';
import type { AuthenticatedGameActionsService } from '../../features/game-actions/authenticated-game-actions';
import {
  ApiHttpError,
  ApiNetworkError,
  ApiResponseError,
} from '../../services/api-client';
import {
  fetchGameComments,
  fetchGameDetails,
} from '../../services/minigames-api';
import type {
  CommentLikeResult,
  CommentsResponse,
  FavoriteGameResult,
  GameComment,
  GameDetails,
} from '../../types/api';

vi.mock('../../services/minigames-api', () => ({
  fetchGameComments: vi.fn(),
  fetchGameDetails: vi.fn(),
}));

interface PromiseWithResolversConstructor extends PromiseConstructor {
  readonly withResolvers: <Value>() => {
    readonly promise: Promise<Value>;
    readonly reject: (reason?: unknown) => void;
    readonly resolve: (value: Value | PromiseLike<Value>) => void;
  };
}

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: Value | PromiseLike<Value>) => void;
}

interface GameActionsSpies {
  readonly getActiveSession: Mock<
    AuthenticatedGameActionsService['getActiveSession']
  >;
  readonly submitComment: Mock<
    AuthenticatedGameActionsService['submitComment']
  >;
  readonly toggleCommentLike: Mock<
    AuthenticatedGameActionsService['toggleCommentLike']
  >;
  readonly toggleFavorite: Mock<
    AuthenticatedGameActionsService['toggleFavorite']
  >;
}

interface GameDetailsDialogFixture {
  readonly authRequests: AuthDialogRequestDetail[];
  readonly controller: GameDetailsDialogController;
  readonly dialog: HTMLDialogElement;
  readonly service: AuthenticatedGameActionsService;
  readonly serviceSpies: GameActionsSpies;
  readonly setSession: (session: AppSession | undefined) => void;
  readonly snackbarMessages: SnackbarOptions[];
}

const SLUG: string = 'tiny-gardens';

const SESSION: AppSession = {
  authenticatedAt: 1_700_000_000_000,
  displayName: 'Ada Player',
  email: 'ada@example.com',
};

const SECOND_SESSION: AppSession = {
  authenticatedAt: 1_700_000_001_000,
  displayName: 'Grace Player',
  email: 'grace@example.com',
};

const GAME: GameDetails = {
  fullDescription: 'A calm game about arranging tiny gardens.',
  heroImage: '/assets/images/games/tiny-gardens.webp',
  isLikedByCurrentUser: false,
  likesCount: 12,
  name: 'Tiny Gardens',
  rating: 4.8,
  slug: SLUG,
  specs: {
    duration: '10 minutes',
    genre: 'Puzzle',
    players: '1',
    price: 'Free',
  },
  topRecords: [],
};

const COMMENTS: readonly GameComment[] = [
  {
    authorName: 'Lin',
    commentId: 'comment-1',
    createdAt: '2026-10-08T12:00:00.000Z',
    isLikedByCurrentUser: false,
    likesCount: 2,
    text: 'A thoughtful comment.',
  },
  {
    authorName: 'Sam',
    commentId: 'comment-2',
    createdAt: '2026-10-08T13:00:00.000Z',
    isLikedByCurrentUser: false,
    likesCount: 4,
    text: 'A second point of view.',
  },
];

const CREATED_COMMENT: GameComment = {
  authorName: SESSION.displayName,
  commentId: 'comment-created',
  createdAt: '2026-10-09T08:00:00.000Z',
  isLikedByCurrentUser: false,
  likesCount: 0,
  text: 'A new comment.',
};

const controllers: GameDetailsDialogController[] = [];
const eventControllers: AbortController[] = [];
const fetchGameCommentsMock = vi.mocked(fetchGameComments);
const fetchGameDetailsMock = vi.mocked(fetchGameDetails);

const createCommentsResponse = (
  comments: readonly GameComment[] = COMMENTS,
  totalComments: number = comments.length,
): CommentsResponse => ({
  data: comments,
  meta: {
    returnedCount: comments.length,
    sort: 'newest',
    totalComments,
  },
});

const createDeferred = <Value>(): Deferred<Value> => {
  const promiseConstructor = Promise as PromiseWithResolversConstructor;
  return promiseConstructor.withResolvers<Value>();
};

const createHttpError = (status: number, statusText: string): ApiHttpError =>
  new ApiHttpError(
    new Response(null, { status, statusText }),
    'https://example.test/mutation',
    statusText,
    {},
  );

const getRequiredElement = <ElementType extends Element>(
  root: ParentNode,
  selector: string,
): ElementType => {
  const element: ElementType | null = root.querySelector<ElementType>(selector);
  if (element === null) {
    throw new Error(`Expected an element matching ${selector}.`);
  }

  return element;
};

const getCommentLikeButton = (
  dialog: HTMLDialogElement,
  commentId: string,
): HTMLButtonElement =>
  getRequiredElement<HTMLButtonElement>(
    dialog,
    `[data-comment-like][data-comment-id="${commentId}"]`,
  );

const dispatchDelegatedClick = (element: Element): void => {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

const pressEnter = (
  textarea: HTMLTextAreaElement,
  options: { readonly shiftKey?: boolean } = {},
): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    shiftKey: options.shiftKey,
  });
  textarea.dispatchEvent(event);
  return event;
};

const dispatchSubmit = (form: HTMLFormElement): SubmitEvent => {
  const event = new SubmitEvent('submit', {
    bubbles: true,
    cancelable: true,
  });
  form.dispatchEvent(event);
  return event;
};

const reopenSameGame = async (
  fixture: GameDetailsDialogFixture,
): Promise<void> => {
  fixture.controller.synchronize(undefined);
  fixture.controller.synchronize(SLUG);
  await waitForReadyDialog(fixture.dialog);
};

const waitForReadyDialog = async (dialog: HTMLDialogElement): Promise<void> => {
  await vi.waitFor(() => {
    expect(dialog.querySelector('[data-game-favorite]')).not.toBeNull();
    expect(dialog.querySelectorAll('[data-comment-like]')).toHaveLength(
      COMMENTS.length,
    );
  });
};

const createFixture = (
  initialSessionInput: AppSession | null = SESSION,
): GameDetailsDialogFixture => {
  const initialSession: AppSession | undefined =
    initialSessionInput ?? undefined;
  let currentSession: AppSession | undefined = initialSession;
  const getActiveSession = vi.fn<
    AuthenticatedGameActionsService['getActiveSession']
  >(() => currentSession);
  const submitComment = vi
    .fn<AuthenticatedGameActionsService['submitComment']>()
    .mockResolvedValue(CREATED_COMMENT);
  const toggleCommentLike = vi
    .fn<AuthenticatedGameActionsService['toggleCommentLike']>()
    .mockResolvedValue({
      isLikedByCurrentUser: true,
      likesCount: 3,
    });
  const toggleFavorite = vi
    .fn<AuthenticatedGameActionsService['toggleFavorite']>()
    .mockResolvedValue({
      gameSlug: SLUG,
      isFavorited: true,
      likesCount: 13,
    });
  const service: AuthenticatedGameActionsService = {
    getActiveSession,
    submitComment,
    toggleCommentLike,
    toggleFavorite,
  };
  const controller: GameDetailsDialogController = createGameDetailsDialog();
  const dialog: HTMLDialogElement = controller.element;
  const eventController = new AbortController();
  const authRequests: AuthDialogRequestDetail[] = [];
  const snackbarMessages: SnackbarOptions[] = [];

  controllers.push(controller);
  eventControllers.push(eventController);
  document.body.append(dialog);
  document.addEventListener(
    AUTH_DIALOG_OPEN_EVENT,
    (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (isAuthDialogRequestDetail(detail)) {
        authRequests.push(detail);
      }
    },
    { signal: eventController.signal },
  );
  document.addEventListener(
    SNACKBAR_SHOW_EVENT,
    (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (isSnackbarRequestDetail(detail)) {
        snackbarMessages.push(detail);
      }
    },
    { signal: eventController.signal },
  );

  controller.setGameActionsService(service);
  controller.setSession(initialSession);
  controller.synchronize(SLUG);

  return {
    authRequests,
    controller,
    dialog,
    service,
    serviceSpies: {
      getActiveSession,
      submitComment,
      toggleCommentLike,
      toggleFavorite,
    },
    setSession: (session: AppSession | undefined): void => {
      currentSession = session;
      controller.setSession(session);
    },
    snackbarMessages,
  };
};

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value(this: HTMLDialogElement): void {
        this.open = false;
      },
    },
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement): void {
        this.open = true;
      },
    },
  });
});

afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
});

beforeEach(() => {
  fetchGameDetailsMock.mockReset().mockResolvedValue({ data: GAME });
  fetchGameCommentsMock.mockReset().mockResolvedValue(createCommentsResponse());
});

afterEach(() => {
  for (const controller of controllers.splice(0).toReversed()) {
    controller.destroy();
    controller.element.remove();
  }
  for (const eventController of eventControllers.splice(0).toReversed()) {
    eventController.abort();
  }
});

describe('game details dialog personalization', () => {
  it.each([
    ['authenticated', SESSION, SESSION.email],
    ['guest', null, undefined],
  ] as const)(
    'loads %s details and comments with the matching user identity',
    async (_label, session, expectedEmail) => {
      const { dialog } = createFixture(session);

      await waitForReadyDialog(dialog);

      expect(fetchGameDetailsMock).toHaveBeenCalledWith(SLUG, {
        signal: expect.any(AbortSignal),
        userEmail: expectedEmail,
      });
      expect(fetchGameCommentsMock).toHaveBeenCalledWith(SLUG, {
        limit: 3,
        signal: expect.any(AbortSignal),
        sort: 'newest',
        userEmail: expectedEmail,
      });
      if (session === null) {
        expect(dialog.querySelector('form[data-comment-composer]')).toBeNull();
      } else {
        expect(
          dialog.querySelector('form[data-comment-composer]'),
        ).not.toBeNull();
      }
    },
  );

  it('hides the composer and refetches unpersonalized state on logout', async () => {
    const fixture = createFixture();
    await waitForReadyDialog(fixture.dialog);
    expect(
      fixture.dialog.querySelector('form[data-comment-composer]'),
    ).not.toBeNull();

    fixture.setSession(undefined);

    expect(
      fixture.dialog.querySelector('form[data-comment-composer]'),
    ).toBeNull();
    await vi.waitFor(() => {
      expect(fetchGameDetailsMock).toHaveBeenCalledTimes(2);
      expect(fetchGameCommentsMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchGameDetailsMock).toHaveBeenNthCalledWith(2, SLUG, {
      signal: expect.any(AbortSignal),
      userEmail: undefined,
    });
    expect(fetchGameCommentsMock).toHaveBeenNthCalledWith(2, SLUG, {
      limit: 3,
      signal: expect.any(AbortSignal),
      sort: 'newest',
      userEmail: undefined,
    });
  });
});

describe('game details dialog authentication guards', () => {
  it('routes a guest favorite through login feedback without a mutation', async () => {
    const fixture = createFixture(null);
    await waitForReadyDialog(fixture.dialog);

    getRequiredElement<HTMLButtonElement>(
      fixture.dialog,
      '[data-game-favorite]',
    ).click();

    expect(fixture.authRequests).toEqual([{ mode: 'login' }]);
    expect(fixture.snackbarMessages).toContainEqual({
      message: 'Sign in to manage favorites.',
      variant: 'warning',
    });
    expect(fixture.serviceSpies.toggleFavorite).not.toHaveBeenCalled();
  });

  it('routes a guest comment like through login feedback without a mutation', async () => {
    const fixture = createFixture(null);
    await waitForReadyDialog(fixture.dialog);

    getCommentLikeButton(fixture.dialog, 'comment-1').click();

    expect(fixture.authRequests).toEqual([{ mode: 'login' }]);
    expect(fixture.snackbarMessages).toContainEqual({
      message: 'Sign in to like comments.',
      variant: 'warning',
    });
    expect(fixture.serviceSpies.toggleCommentLike).not.toHaveBeenCalled();
  });
});

describe('game details dialog favorite action', () => {
  it('deduplicates a pending request and renders only the server result', async () => {
    const favoriteResult = createDeferred<FavoriteGameResult>();
    const fixture = createFixture();
    fixture.serviceSpies.toggleFavorite.mockReturnValue(favoriteResult.promise);
    await waitForReadyDialog(fixture.dialog);
    const favoriteButton = getRequiredElement<HTMLButtonElement>(
      fixture.dialog,
      '[data-game-favorite]',
    );
    const likesCount = getRequiredElement<HTMLElement>(
      fixture.dialog,
      '[data-game-favorite-count]',
    );

    dispatchDelegatedClick(favoriteButton);
    dispatchDelegatedClick(favoriteButton);

    expect(fixture.serviceSpies.toggleFavorite).toHaveBeenCalledOnce();
    expect(favoriteButton.disabled).toBe(true);
    expect(favoriteButton.ariaBusy).toBe('true');
    expect(favoriteButton.ariaPressed).toBe('false');
    expect(likesCount.textContent).toBe('12');

    favoriteResult.resolve({
      gameSlug: SLUG,
      isFavorited: true,
      likesCount: 99,
    });

    await vi.waitFor(() => {
      expect(favoriteButton.disabled).toBe(false);
      expect(favoriteButton.ariaPressed).toBe('true');
      expect(likesCount.textContent).toBe('99');
    });
  });

  it('ignores a mutation result from the previous session', async () => {
    const favoriteResult = createDeferred<FavoriteGameResult>();
    const secondSessionGame: GameDetails = {
      ...GAME,
      isLikedByCurrentUser: false,
      likesCount: 40,
    };
    fetchGameDetailsMock
      .mockResolvedValueOnce({ data: GAME })
      .mockResolvedValueOnce({ data: secondSessionGame });
    const fixture = createFixture();
    fixture.serviceSpies.toggleFavorite.mockReturnValue(favoriteResult.promise);
    await waitForReadyDialog(fixture.dialog);

    dispatchDelegatedClick(
      getRequiredElement(fixture.dialog, '[data-game-favorite]'),
    );
    fixture.setSession(SECOND_SESSION);

    await vi.waitFor(() => {
      expect(fetchGameDetailsMock).toHaveBeenCalledTimes(2);
      expect(
        getRequiredElement(fixture.dialog, '[data-game-favorite-count]')
          .textContent,
      ).toBe('40');
    });
    favoriteResult.resolve({
      gameSlug: SLUG,
      isFavorited: true,
      likesCount: 999,
    });
    await favoriteResult.promise;
    await Promise.resolve();

    const favoriteButton = getRequiredElement<HTMLButtonElement>(
      fixture.dialog,
      '[data-game-favorite]',
    );
    expect(favoriteButton.ariaPressed).toBe('false');
    expect(
      getRequiredElement(fixture.dialog, '[data-game-favorite-count]')
        .textContent,
    ).toBe('40');
    expect(fixture.snackbarMessages).not.toContainEqual({
      message: 'Game added to favorites.',
      variant: 'success',
    });
  });

  it('keeps a pending favorite locked when the same game is closed and reopened', async () => {
    const favoriteResult = createDeferred<FavoriteGameResult>();
    const fixture = createFixture();
    fixture.serviceSpies.toggleFavorite.mockReturnValue(favoriteResult.promise);
    await waitForReadyDialog(fixture.dialog);

    dispatchDelegatedClick(
      getRequiredElement(fixture.dialog, '[data-game-favorite]'),
    );
    await reopenSameGame(fixture);

    const reopenedButton = getRequiredElement<HTMLButtonElement>(
      fixture.dialog,
      '[data-game-favorite]',
    );
    expect(reopenedButton.disabled).toBe(true);
    expect(reopenedButton.ariaBusy).toBe('true');

    dispatchDelegatedClick(reopenedButton);
    expect(fixture.serviceSpies.toggleFavorite).toHaveBeenCalledOnce();

    favoriteResult.resolve({
      gameSlug: SLUG,
      isFavorited: true,
      likesCount: 99,
    });

    await vi.waitFor(() => {
      expect(reopenedButton.disabled).toBe(false);
      expect(reopenedButton.ariaBusy).toBeNull();
    });
    expect(reopenedButton.ariaPressed).toBe('true');
    expect(
      getRequiredElement(fixture.dialog, '[data-game-favorite-count]')
        .textContent,
    ).toBe('99');
    expect(fixture.snackbarMessages).toContainEqual({
      message: 'Game added to favorites.',
      variant: 'success',
    });
  });

  it('unlocks without revalidation or optimistic state after a definitive favorite failure', async () => {
    const fixture = createFixture();
    fixture.serviceSpies.toggleFavorite.mockRejectedValueOnce(
      createHttpError(400, 'Bad Request'),
    );
    await waitForReadyDialog(fixture.dialog);
    const favoriteButton = getRequiredElement<HTMLButtonElement>(
      fixture.dialog,
      '[data-game-favorite]',
    );

    dispatchDelegatedClick(favoriteButton);

    await vi.waitFor(() => {
      expect(favoriteButton.disabled).toBe(false);
      expect(fixture.snackbarMessages).toContainEqual({
        message: 'We could not update your favorites. Please try again.',
        variant: 'error',
      });
    });
    expect(favoriteButton.ariaBusy).toBeNull();
    expect(favoriteButton.ariaPressed).toBe('false');
    expect(
      getRequiredElement(fixture.dialog, '[data-game-favorite-count]')
        .textContent,
    ).toBe('12');
    expect(fixture.serviceSpies.toggleFavorite).toHaveBeenCalledOnce();
    expect(fetchGameDetailsMock).toHaveBeenCalledOnce();
    expect(fetchGameCommentsMock).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'network',
      new ApiNetworkError(
        'https://example.test/favorites',
        new TypeError('connection dropped'),
      ),
    ],
    [
      'invalid-response',
      new ApiResponseError(
        'https://example.test/favorites',
        new SyntaxError('invalid JSON'),
      ),
    ],
    ['5xx', createHttpError(503, 'Service Unavailable')],
  ] as const)(
    'uses a GET-only revalidation after an ambiguous %s favorite failure',
    async (_label, error) => {
      const fixture = createFixture();
      fixture.serviceSpies.toggleFavorite.mockRejectedValueOnce(error);
      await waitForReadyDialog(fixture.dialog);

      dispatchDelegatedClick(
        getRequiredElement(fixture.dialog, '[data-game-favorite]'),
      );

      await vi.waitFor(() => {
        expect(fetchGameDetailsMock).toHaveBeenCalledTimes(2);
        expect(
          getRequiredElement<HTMLButtonElement>(
            fixture.dialog,
            '[data-game-favorite]',
          ).disabled,
        ).toBe(false);
      });
      const favoriteButton = getRequiredElement<HTMLButtonElement>(
        fixture.dialog,
        '[data-game-favorite]',
      );
      expect(favoriteButton.ariaPressed).toBe('false');
      expect(
        getRequiredElement(fixture.dialog, '[data-game-favorite-count]')
          .textContent,
      ).toBe('12');
      expect(fixture.serviceSpies.toggleFavorite).toHaveBeenCalledOnce();
      expect(fetchGameCommentsMock).toHaveBeenCalledOnce();
      expect(fetchGameDetailsMock).toHaveBeenNthCalledWith(2, SLUG, {
        signal: expect.any(AbortSignal),
        userEmail: SESSION.email,
      });
      expect(fixture.snackbarMessages).toContainEqual({
        message:
          'We could not confirm whether your favorite changed. Refresh before trying again.',
        variant: 'error',
      });
    },
  );
});

describe('game details dialog comment submission', () => {
  it('submits raw text on Enter, preserves Shift+Enter, clears on success, and reloads latest comments', async () => {
    const fixture = createFixture();
    await waitForReadyDialog(fixture.dialog);
    const textarea = getRequiredElement<HTMLTextAreaElement>(
      fixture.dialog,
      '[data-comment-text]',
    );
    textarea.value = '  A new comment.  ';

    const shiftEnter = pressEnter(textarea, { shiftKey: true });

    expect(shiftEnter.defaultPrevented).toBe(false);
    expect(fixture.serviceSpies.submitComment).not.toHaveBeenCalled();

    const enter = pressEnter(textarea);

    expect(enter.defaultPrevented).toBe(true);
    await vi.waitFor(() => {
      expect(fixture.serviceSpies.submitComment).toHaveBeenCalledWith(
        SLUG,
        '  A new comment.  ',
      );
      expect(fetchGameCommentsMock).toHaveBeenCalledTimes(2);
    });
    expect(textarea.value).toBe('');
    expect(fetchGameCommentsMock).toHaveBeenNthCalledWith(2, SLUG, {
      limit: 3,
      signal: expect.any(AbortSignal),
      sort: 'newest',
      userEmail: SESSION.email,
    });
    expect(fixture.snackbarMessages).toContainEqual({
      message: 'Comment posted.',
      variant: 'success',
    });
  });

  it.each([
    [
      'definitive',
      new ApiHttpError(
        new Response(null, { status: 400, statusText: 'Bad Request' }),
        'https://example.test/comments',
        'Bad Request',
        {},
      ),
      'We could not post your comment. Please try again.',
    ],
    [
      'unknown',
      new ApiNetworkError(
        'https://example.test/comments',
        new TypeError('connection dropped'),
      ),
      'We could not confirm whether your comment was posted. Check the comments before trying again.',
    ],
  ] as const)(
    'retains the draft and shows %s failure feedback',
    async (_label, error, message) => {
      const fixture = createFixture();
      fixture.serviceSpies.submitComment.mockRejectedValueOnce(error);
      await waitForReadyDialog(fixture.dialog);
      const textarea = getRequiredElement<HTMLTextAreaElement>(
        fixture.dialog,
        '[data-comment-text]',
      );
      const draft: string = 'Keep this draft';
      textarea.value = draft;

      pressEnter(textarea);

      await vi.waitFor(() => {
        expect(
          getRequiredElement(fixture.dialog, '[data-comment-status]')
            .textContent,
        ).toBe(message);
      });
      expect(textarea.value).toBe(draft);
      expect(textarea.disabled).toBe(false);
      expect(fetchGameCommentsMock).toHaveBeenCalledOnce();
      expect(fixture.snackbarMessages).toContainEqual({
        message,
        variant: 'error',
      });
    },
  );

  it('keeps comment submission locked when the same game is closed and reopened', async () => {
    const commentResult = createDeferred<GameComment>();
    const fixture = createFixture();
    fixture.serviceSpies.submitComment.mockReturnValue(commentResult.promise);
    await waitForReadyDialog(fixture.dialog);
    const initialTextarea = getRequiredElement<HTMLTextAreaElement>(
      fixture.dialog,
      '[data-comment-text]',
    );
    initialTextarea.value = 'First submission';

    pressEnter(initialTextarea);
    await reopenSameGame(fixture);

    const reopenedComposer = getRequiredElement<HTMLFormElement>(
      fixture.dialog,
      '[data-comment-composer]',
    );
    const reopenedTextarea = getRequiredElement<HTMLTextAreaElement>(
      reopenedComposer,
      '[data-comment-text]',
    );
    const reopenedSubmit = getRequiredElement<HTMLButtonElement>(
      reopenedComposer,
      'button[type="submit"]',
    );
    expect(reopenedComposer.ariaBusy).toBe('true');
    expect(reopenedTextarea.disabled).toBe(true);
    expect(reopenedSubmit.disabled).toBe(true);

    reopenedTextarea.value = 'Duplicate submission';
    expect(dispatchSubmit(reopenedComposer).defaultPrevented).toBe(true);
    expect(fixture.serviceSpies.submitComment).toHaveBeenCalledOnce();

    commentResult.resolve(CREATED_COMMENT);

    await vi.waitFor(() => {
      expect(reopenedTextarea.disabled).toBe(false);
      expect(reopenedSubmit.disabled).toBe(false);
    });
    expect(reopenedComposer.ariaBusy).toBeNull();
    expect(fixture.serviceSpies.submitComment).toHaveBeenCalledWith(
      SLUG,
      'First submission',
    );
    expect(reopenedTextarea.value).toBe('');
    expect(fetchGameCommentsMock).toHaveBeenCalledTimes(3);
    expect(fixture.snackbarMessages).toContainEqual({
      message: 'Comment posted.',
      variant: 'success',
    });
  });
});

describe('game details dialog comment likes', () => {
  it('deduplicates each comment independently and applies server results', async () => {
    const firstResult = createDeferred<CommentLikeResult>();
    const secondResult = createDeferred<CommentLikeResult>();
    const fixture = createFixture();
    fixture.serviceSpies.toggleCommentLike.mockImplementation(
      (commentId: string): Promise<CommentLikeResult> =>
        commentId === 'comment-1' ? firstResult.promise : secondResult.promise,
    );
    await waitForReadyDialog(fixture.dialog);
    const firstButton = getCommentLikeButton(fixture.dialog, 'comment-1');
    const secondButton = getCommentLikeButton(fixture.dialog, 'comment-2');

    dispatchDelegatedClick(firstButton);
    dispatchDelegatedClick(firstButton);
    dispatchDelegatedClick(secondButton);

    expect(fixture.serviceSpies.toggleCommentLike).toHaveBeenCalledTimes(2);
    expect(fixture.serviceSpies.toggleCommentLike).toHaveBeenNthCalledWith(
      1,
      'comment-1',
    );
    expect(fixture.serviceSpies.toggleCommentLike).toHaveBeenNthCalledWith(
      2,
      'comment-2',
    );
    expect(firstButton.disabled).toBe(true);
    expect(secondButton.disabled).toBe(true);
    expect(firstButton.ariaPressed).toBe('false');

    secondResult.resolve({ isLikedByCurrentUser: true, likesCount: 14 });
    await vi.waitFor(() => {
      expect(secondButton.disabled).toBe(false);
      expect(secondButton.ariaPressed).toBe('true');
      expect(
        getRequiredElement(secondButton, '[data-comment-like-count]')
          .textContent,
      ).toBe('14');
    });
    expect(firstButton.disabled).toBe(true);

    firstResult.resolve({ isLikedByCurrentUser: true, likesCount: 8 });
    await vi.waitFor(() => {
      expect(firstButton.disabled).toBe(false);
      expect(firstButton.ariaPressed).toBe('true');
      expect(
        getRequiredElement(firstButton, '[data-comment-like-count]')
          .textContent,
      ).toBe('8');
    });
  });

  it('keeps a pending comment like locked when the same game is closed and reopened', async () => {
    const likeResult = createDeferred<CommentLikeResult>();
    const fixture = createFixture();
    fixture.serviceSpies.toggleCommentLike.mockReturnValue(likeResult.promise);
    await waitForReadyDialog(fixture.dialog);

    dispatchDelegatedClick(getCommentLikeButton(fixture.dialog, 'comment-1'));
    await reopenSameGame(fixture);

    const reopenedButton = getCommentLikeButton(fixture.dialog, 'comment-1');
    expect(reopenedButton.disabled).toBe(true);
    expect(reopenedButton.ariaBusy).toBe('true');

    dispatchDelegatedClick(reopenedButton);
    expect(fixture.serviceSpies.toggleCommentLike).toHaveBeenCalledOnce();

    likeResult.resolve({ isLikedByCurrentUser: true, likesCount: 99 });

    await vi.waitFor(() => {
      expect(reopenedButton.disabled).toBe(false);
      expect(reopenedButton.ariaBusy).toBeNull();
    });
    expect(reopenedButton.ariaPressed).toBe('true');
    expect(
      getRequiredElement(reopenedButton, '[data-comment-like-count]')
        .textContent,
    ).toBe('99');
    expect(fixture.snackbarMessages).toContainEqual({
      message: 'Comment liked.',
      variant: 'success',
    });
  });

  it('unlocks without revalidation or optimistic state after a definitive comment-like failure', async () => {
    const fixture = createFixture();
    fixture.serviceSpies.toggleCommentLike.mockRejectedValueOnce(
      createHttpError(409, 'Conflict'),
    );
    await waitForReadyDialog(fixture.dialog);
    const likeButton = getCommentLikeButton(fixture.dialog, 'comment-1');

    dispatchDelegatedClick(likeButton);

    await vi.waitFor(() => {
      expect(likeButton.disabled).toBe(false);
      expect(fixture.snackbarMessages).toContainEqual({
        message: 'We could not update that comment like. Please try again.',
        variant: 'error',
      });
    });
    expect(likeButton.ariaBusy).toBeNull();
    expect(likeButton.ariaPressed).toBe('false');
    expect(
      getRequiredElement(likeButton, '[data-comment-like-count]').textContent,
    ).toBe('2');
    expect(fixture.serviceSpies.toggleCommentLike).toHaveBeenCalledOnce();
    expect(fetchGameCommentsMock).toHaveBeenCalledOnce();
    expect(fetchGameDetailsMock).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'network',
      new ApiNetworkError(
        'https://example.test/comment-likes',
        new TypeError('connection dropped'),
      ),
    ],
    [
      'invalid-response',
      new ApiResponseError(
        'https://example.test/comment-likes',
        new SyntaxError('invalid JSON'),
      ),
    ],
    ['5xx', createHttpError(502, 'Bad Gateway')],
  ] as const)(
    'uses a GET-only revalidation after an ambiguous %s comment-like failure',
    async (_label, error) => {
      const fixture = createFixture();
      fixture.serviceSpies.toggleCommentLike.mockRejectedValueOnce(error);
      await waitForReadyDialog(fixture.dialog);

      dispatchDelegatedClick(getCommentLikeButton(fixture.dialog, 'comment-1'));

      await vi.waitFor(() => {
        expect(fetchGameCommentsMock).toHaveBeenCalledTimes(2);
        expect(getCommentLikeButton(fixture.dialog, 'comment-1').disabled).toBe(
          false,
        );
      });
      const likeButton = getCommentLikeButton(fixture.dialog, 'comment-1');
      expect(likeButton.ariaPressed).toBe('false');
      expect(
        getRequiredElement(likeButton, '[data-comment-like-count]').textContent,
      ).toBe('2');
      expect(fixture.serviceSpies.toggleCommentLike).toHaveBeenCalledOnce();
      expect(fetchGameDetailsMock).toHaveBeenCalledOnce();
      expect(fetchGameCommentsMock).toHaveBeenNthCalledWith(2, SLUG, {
        limit: 3,
        signal: expect.any(AbortSignal),
        sort: 'newest',
        userEmail: SESSION.email,
      });
      expect(fixture.snackbarMessages).toContainEqual({
        message:
          'We could not confirm whether the comment like changed. Refresh before trying again.',
        variant: 'error',
      });
    },
  );
});
