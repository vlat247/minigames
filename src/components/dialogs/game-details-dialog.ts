import {
  createBlockErrorState,
  createEmptyState,
  createSkeletonState,
} from '../async-state/async-state';
import { dispatchSnackbar } from '../snackbar/snackbar-events';
import {
  ApiAbortError,
  ApiHttpError,
  ApiNetworkError,
  ApiResponseError,
  isApiAbortError,
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
import {
  createAvatarColorRegistry,
  createCommentComposer,
  createCommentElements,
  createGameDetailsFragment,
  GAME_DETAILS_TITLE_ID,
  isCommentsResponsePayload,
  isGameDetailsPayload,
  resizeCommentTextarea,
  updateCommentComposerState,
  updateCommentLikeControl,
  updateGameFavoriteControls,
  type AvatarColorResolver,
  type CommentComposerElements,
} from './game-details-content';
import { dispatchAuthDialogRequest } from './auth-dialog-events';
import { dispatchGameDetailsCloseRequest } from './game-details-events';
import {
  getProfileName,
  type AppSession,
} from '../../features/auth/app-session';
import {
  AuthenticationRequiredError,
  CommentValidationError,
  type AuthenticatedGameActionsService,
} from '../../features/game-actions/authenticated-game-actions';
import './game-details-dialog.scss';

const DIALOG_TRANSITION_DURATION_MS: number = 240;
const LATEST_COMMENTS_LIMIT: number = 3;
const DETAILS_ERROR_MESSAGE: string =
  'Game details are unavailable right now. Please try again.';
const COMMENTS_ERROR_MESSAGE: string =
  'The latest comments are unavailable right now. Please try again.';
const GAME_NOT_FOUND_MESSAGE: string = 'We could not find the requested game.';
const GAME_COMMENTS_TITLE_ID: string = 'game-comments-title';
const FAVORITE_SIGN_IN_MESSAGE: string = 'Sign in to manage favorites.';
const COMMENT_LIKE_SIGN_IN_MESSAGE: string = 'Sign in to like comments.';
const FAVORITE_UNKNOWN_MESSAGE: string =
  'We could not confirm whether your favorite changed. Refresh before trying again.';
const FAVORITE_ERROR_MESSAGE: string =
  'We could not update your favorites. Please try again.';
const COMMENT_LIKE_UNKNOWN_MESSAGE: string =
  'We could not confirm whether the comment like changed. Refresh before trying again.';
const COMMENT_LIKE_ERROR_MESSAGE: string =
  'We could not update that comment like. Please try again.';
const COMMENT_SUBMISSION_UNKNOWN_MESSAGE: string =
  'We could not confirm whether your comment was posted. Check the comments before trying again.';
const COMMENT_SUBMISSION_ERROR_MESSAGE: string =
  'We could not post your comment. Please try again.';

type DetailsLoadOutcome = 'empty' | 'error' | 'not-found' | 'ready' | 'stale';

export interface GameDetailsDialogController {
  readonly destroy: () => void;
  readonly element: HTMLDialogElement;
  readonly setGameActionsService: (
    service: AuthenticatedGameActionsService,
  ) => void;
  readonly setSession: (session: AppSession | undefined) => void;
  readonly synchronize: (slug: string | undefined) => void;
}

const areSessionsEqual = (
  first: AppSession | undefined,
  second: AppSession | undefined,
): boolean =>
  first === second ||
  (first !== undefined &&
    second !== undefined &&
    first.authenticatedAt === second.authenticatedAt &&
    first.displayName === second.displayName &&
    first.email === second.email);

const isAmbiguousMutationError = (error: unknown): boolean => {
  return (
    error instanceof ApiAbortError ||
    error instanceof ApiNetworkError ||
    error instanceof ApiResponseError ||
    !(error instanceof ApiHttpError) ||
    error.status >= 500
  );
};

const requestAuthentication = (message: string): void => {
  dispatchSnackbar({ message, variant: 'warning' });
  dispatchAuthDialogRequest('login');
};

const getRequiredElement = <ElementType extends Element>(
  root: ParentNode,
  selector: string,
): ElementType => {
  const element: ElementType | null = root.querySelector<ElementType>(selector);
  if (element === null) {
    throw new Error(`Missing required game-details element: ${selector}`);
  }

  return element;
};

export const createGameDetailsDialog = (): GameDetailsDialogController => {
  const dialog: HTMLDialogElement = document.createElement('dialog');
  const eventController: AbortController = new AbortController();
  const { signal } = eventController;

  dialog.className = 'game-details-dialog';
  dialog.setAttribute('aria-label', 'Game details');
  dialog.innerHTML = `
    <button class="game-details-dialog__close" type="button" data-dialog-close aria-label="Close game details">
      <span class="material-symbols-rounded" aria-hidden="true">close</span>
    </button>
    <div class="game-details-dialog__body">
      <div class="game-details-dialog__details" data-game-details-content></div>
      <section class="game-comments game-details-dialog__comments" data-game-comments-section aria-labelledby="${GAME_COMMENTS_TITLE_ID}">
        <h3 id="${GAME_COMMENTS_TITLE_ID}" data-game-comments-heading>Comments</h3>
        <div data-game-comment-composer></div>
        <div class="game-comments__list" data-game-comments-content></div>
      </section>
    </div>
  `;

  const closeButton: HTMLButtonElement = getRequiredElement<HTMLButtonElement>(
    dialog,
    '[data-dialog-close]',
  );
  const detailsContent: HTMLDivElement = getRequiredElement<HTMLDivElement>(
    dialog,
    '[data-game-details-content]',
  );
  const commentsSection: HTMLElement = getRequiredElement<HTMLElement>(
    dialog,
    '[data-game-comments-section]',
  );
  const commentsHeading: HTMLHeadingElement =
    getRequiredElement<HTMLHeadingElement>(
      dialog,
      '[data-game-comments-heading]',
    );
  const commentsContent: HTMLDivElement = getRequiredElement<HTMLDivElement>(
    dialog,
    '[data-game-comments-content]',
  );
  const commentComposerHost: HTMLDivElement =
    getRequiredElement<HTMLDivElement>(dialog, '[data-game-comment-composer]');

  let activeSlug: string | undefined;
  let activeSession: AppSession | undefined;
  let avatarColorResolver: AvatarColorResolver = createAvatarColorRegistry();
  let closeTimer: number | undefined;
  let commentComposer: CommentComposerElements | undefined;
  let commentSubmission:
    | {
        readonly email: string;
        readonly slug: string;
      }
    | undefined;
  let commentsRequest: AbortController | undefined;
  let commentsRequestVersion: number = 0;
  const commentsById = new Map<string, GameComment>();
  let detailsRequest: AbortController | undefined;
  let detailsRequestVersion: number = 0;
  let favoriteMutation:
    | {
        readonly email: string;
        readonly slug: string;
      }
    | undefined;
  let gameActionsService: AuthenticatedGameActionsService | undefined;
  let isDestroyed: boolean = false;
  const likeMutations = new Map<
    string,
    {
      readonly email: string;
      readonly slug: string;
    }
  >();
  let openAnimationFrame: number | undefined;
  let renderedGame: GameDetails | undefined;
  let returnFocusElement: HTMLElement | null = null;

  const getFavoriteControls = ():
    | {
        readonly button: HTMLButtonElement;
        readonly count: HTMLElement;
      }
    | undefined => {
    const button: HTMLButtonElement | null =
      detailsContent.querySelector<HTMLButtonElement>('[data-game-favorite]');
    const count: HTMLElement | null = detailsContent.querySelector<HTMLElement>(
      '[data-game-favorite-count]',
    );

    return button === null || count === null ? undefined : { button, count };
  };

  const getCommentLikeButton = (
    commentId: string,
  ): HTMLButtonElement | undefined => {
    return [
      ...commentsContent.querySelectorAll<HTMLButtonElement>(
        '[data-comment-like]',
      ),
    ].find((button: HTMLButtonElement): boolean => {
      return button.dataset.commentId === commentId;
    });
  };

  const isActiveMutationIdentity = (slug: string, email: string): boolean => {
    return (
      !isDestroyed &&
      dialog.open &&
      activeSlug === slug &&
      activeSession?.email === email
    );
  };

  const renderCommentComposer = (): void => {
    commentComposer = undefined;
    commentComposerHost.replaceChildren();

    if (activeSession === undefined || activeSlug === undefined) {
      return;
    }

    const composer: CommentComposerElements = createCommentComposer(
      getProfileName(activeSession),
    );
    const isPending: boolean =
      commentSubmission?.slug === activeSlug &&
      commentSubmission.email === activeSession.email;
    updateCommentComposerState(composer, { isPending });
    commentComposer = composer;
    commentComposerHost.append(composer.element);
  };

  const renderFavoriteState = (isPending: boolean): void => {
    if (renderedGame === undefined) {
      return;
    }

    const controls = getFavoriteControls();
    if (controls === undefined) {
      return;
    }

    updateGameFavoriteControls(controls.button, controls.count, {
      gameName: renderedGame.name,
      isFavorited: renderedGame.isLikedByCurrentUser,
      isPending,
      likesCount: renderedGame.likesCount,
    });
  };

  const renderCommentLikeState = (
    commentId: string,
    isPending: boolean,
  ): void => {
    const comment: GameComment | undefined = commentsById.get(commentId);
    const button: HTMLButtonElement | undefined =
      getCommentLikeButton(commentId);
    if (comment === undefined || button === undefined) {
      return;
    }

    updateCommentLikeControl(button, {
      isLikedByCurrentUser: comment.isLikedByCurrentUser,
      isPending,
      likesCount: comment.likesCount,
    });
  };

  const setDialogLabel = (label: string): void => {
    dialog.removeAttribute('aria-labelledby');
    dialog.setAttribute('aria-label', label);
  };

  const setDialogTitle = (): void => {
    dialog.removeAttribute('aria-label');
    dialog.setAttribute('aria-labelledby', GAME_DETAILS_TITLE_ID);
  };

  const abortDetailsRequest = (): void => {
    detailsRequestVersion += 1;
    detailsRequest?.abort();
    detailsRequest = undefined;
  };

  const abortCommentsRequest = (): void => {
    commentsRequestVersion += 1;
    commentsRequest?.abort();
    commentsRequest = undefined;
  };

  const isCurrentDetailsRequest = (
    request: AbortController,
    requestVersion: number,
    slug: string,
  ): boolean => {
    return (
      !isDestroyed &&
      !request.signal.aborted &&
      requestVersion === detailsRequestVersion &&
      slug === activeSlug
    );
  };

  const isCurrentCommentsRequest = (
    request: AbortController,
    requestVersion: number,
    slug: string,
  ): boolean => {
    return (
      !isDestroyed &&
      !request.signal.aborted &&
      requestVersion === commentsRequestVersion &&
      slug === activeSlug
    );
  };

  const renderDetailsLoading = (): void => {
    renderedGame = undefined;
    setDialogLabel('Loading game details');
    detailsContent.setAttribute('aria-busy', 'true');
    detailsContent.replaceChildren(
      createSkeletonState({
        label: 'Loading game details',
        variant: 'details',
      }),
    );
  };

  const renderDetailsEmpty = (): void => {
    renderedGame = undefined;
    setDialogLabel('Game details unavailable');
    detailsContent.removeAttribute('aria-busy');
    detailsContent.replaceChildren(
      createEmptyState({
        message: 'This game did not include any displayable details.',
        title: 'No game details found',
      }),
    );
  };

  const renderGameNotFound = (): void => {
    renderedGame = undefined;
    setDialogLabel('Game Not Found');
    detailsContent.removeAttribute('aria-busy');
    detailsContent.replaceChildren(
      createEmptyState({
        message:
          'The requested game may have been removed or its link may be incorrect.',
        title: 'Game Not Found',
      }),
    );
    commentsSection.hidden = true;
  };

  const renderDetailsError = (slug: string): void => {
    renderedGame = undefined;
    setDialogLabel('Unable to load game details');
    detailsContent.removeAttribute('aria-busy');
    detailsContent.replaceChildren(
      createBlockErrorState({
        message: DETAILS_ERROR_MESSAGE,
        onRetry: (): void => {
          if (slug !== activeSlug) {
            return;
          }

          closeButton.focus({ preventScroll: true });
          void loadDetails(slug);
        },
        title: 'Unable to load game details',
      }),
    );
  };

  const renderGameDetails = (game: GameDetails): void => {
    renderedGame = game;
    detailsContent.removeAttribute('aria-busy');
    detailsContent.replaceChildren(createGameDetailsFragment(game));
    renderFavoriteState(
      favoriteMutation !== undefined &&
        favoriteMutation.slug === activeSlug &&
        favoriteMutation.email === activeSession?.email,
    );
    setDialogTitle();
  };

  const renderCommentsLoading = (): void => {
    commentsById.clear();
    commentsSection.hidden = false;
    commentsHeading.textContent = 'Comments';
    commentsContent.setAttribute('aria-busy', 'true');
    commentsContent.replaceChildren(
      createSkeletonState({
        itemCount: LATEST_COMMENTS_LIMIT,
        label: 'Loading latest comments',
        variant: 'rows',
      }),
    );
  };

  const renderCommentsError = (slug: string): void => {
    commentsContent.removeAttribute('aria-busy');
    commentsContent.replaceChildren(
      createBlockErrorState({
        message: COMMENTS_ERROR_MESSAGE,
        onRetry: (): void => {
          if (slug !== activeSlug) {
            return;
          }

          closeButton.focus({ preventScroll: true });
          void loadComments(slug);
        },
        title: 'Unable to load comments',
      }),
    );
  };

  const renderComments = (response: CommentsResponse): void => {
    const totalComments: number = Math.max(
      0,
      Math.trunc(response.meta.totalComments),
    );
    commentsHeading.textContent = `Comments (${totalComments})`;
    commentsContent.removeAttribute('aria-busy');

    if (response.data.length === 0) {
      commentsContent.replaceChildren(
        createEmptyState({
          message: 'Be the first player to share a thought about this game.',
          title: 'No comments yet',
        }),
      );
      return;
    }

    for (const comment of response.data) {
      commentsById.set(comment.commentId, comment);
    }
    commentsContent.replaceChildren(
      ...createCommentElements(response.data, avatarColorResolver),
    );
    for (const comment of response.data) {
      const mutation = likeMutations.get(comment.commentId);
      renderCommentLikeState(
        comment.commentId,
        mutation !== undefined &&
          mutation.slug === activeSlug &&
          mutation.email === activeSession?.email,
      );
    }
  };

  const loadDetails = async (slug: string): Promise<DetailsLoadOutcome> => {
    abortDetailsRequest();
    const request: AbortController = new AbortController();
    const requestVersion: number = detailsRequestVersion;
    detailsRequest = request;
    renderDetailsLoading();

    try {
      const response = await fetchGameDetails(slug, {
        signal: request.signal,
        userEmail: activeSession?.email,
      });
      if (!isCurrentDetailsRequest(request, requestVersion, slug)) {
        return 'stale';
      }

      if (!isGameDetailsPayload(response.data) || response.data.slug !== slug) {
        renderDetailsEmpty();
        return 'empty';
      }

      renderGameDetails(response.data);
      return 'ready';
    } catch (error: unknown) {
      if (
        !isCurrentDetailsRequest(request, requestVersion, slug) ||
        isApiAbortError(error)
      ) {
        return 'stale';
      }

      if (error instanceof ApiHttpError && error.status === 404) {
        abortCommentsRequest();
        renderGameNotFound();
        dispatchSnackbar({
          message: GAME_NOT_FOUND_MESSAGE,
          variant: 'error',
        });
        return 'not-found';
      }

      renderDetailsError(slug);
      dispatchSnackbar({
        message: DETAILS_ERROR_MESSAGE,
        variant: 'error',
      });
      return 'error';
    } finally {
      if (detailsRequest === request) {
        detailsRequest = undefined;
      }
    }
  };

  const loadComments = async (
    slug: string,
    detailsOutcome: Promise<DetailsLoadOutcome> = Promise.resolve('ready'),
  ): Promise<void> => {
    abortCommentsRequest();
    const request: AbortController = new AbortController();
    const requestVersion: number = commentsRequestVersion;
    commentsRequest = request;
    renderCommentsLoading();

    try {
      const response: CommentsResponse = await fetchGameComments(slug, {
        limit: LATEST_COMMENTS_LIMIT,
        signal: request.signal,
        sort: 'newest',
        userEmail: activeSession?.email,
      });
      if (!isCurrentCommentsRequest(request, requestVersion, slug)) {
        return;
      }
      if (!isCommentsResponsePayload(response)) {
        throw new TypeError('The comments response has an invalid shape.');
      }

      renderComments(response);
    } catch (error: unknown) {
      if (
        !isCurrentCommentsRequest(request, requestVersion, slug) ||
        isApiAbortError(error)
      ) {
        return;
      }

      if (error instanceof ApiHttpError && error.status === 404) {
        const outcome: DetailsLoadOutcome = await detailsOutcome;
        if (
          outcome === 'not-found' ||
          outcome === 'stale' ||
          !isCurrentCommentsRequest(request, requestVersion, slug)
        ) {
          return;
        }
      }

      renderCommentsError(slug);
      dispatchSnackbar({
        message: COMMENTS_ERROR_MESSAGE,
        variant: 'error',
      });
    } finally {
      if (commentsRequest === request) {
        commentsRequest = undefined;
      }
    }
  };

  const getActionSession = (signInMessage: string): AppSession | undefined => {
    const session: AppSession | undefined =
      gameActionsService?.getActiveSession();
    if (session === undefined) {
      requestAuthentication(signInMessage);
      return undefined;
    }

    return session;
  };

  const toggleFavorite = async (): Promise<void> => {
    const slug: string | undefined = activeSlug;
    const service: AuthenticatedGameActionsService | undefined =
      gameActionsService;
    if (
      slug === undefined ||
      service === undefined ||
      renderedGame === undefined
    ) {
      return;
    }

    const session: AppSession | undefined = getActionSession(
      FAVORITE_SIGN_IN_MESSAGE,
    );
    if (
      session === undefined ||
      (favoriteMutation?.slug === slug &&
        favoriteMutation.email === session.email)
    ) {
      return;
    }

    const mutation = {
      email: session.email,
      slug,
    };
    favoriteMutation = mutation;
    renderFavoriteState(true);

    try {
      const result: FavoriteGameResult = await service.toggleFavorite(slug);
      if (!isActiveMutationIdentity(slug, session.email)) {
        return;
      }

      if (renderedGame !== undefined) {
        renderedGame = {
          ...renderedGame,
          isLikedByCurrentUser: result.isFavorited,
          likesCount: result.likesCount,
        };
        renderFavoriteState(false);
      }
      dispatchSnackbar({
        message: result.isFavorited
          ? 'Game added to favorites.'
          : 'Game removed from favorites.',
        variant: 'success',
      });
    } catch (error: unknown) {
      if (!isActiveMutationIdentity(slug, session.email)) {
        return;
      }

      if (error instanceof AuthenticationRequiredError) {
        requestAuthentication(FAVORITE_SIGN_IN_MESSAGE);
        return;
      }

      const isAmbiguous: boolean = isAmbiguousMutationError(error);
      dispatchSnackbar({
        message: isAmbiguous
          ? FAVORITE_UNKNOWN_MESSAGE
          : FAVORITE_ERROR_MESSAGE,
        variant: 'error',
      });
      if (isAmbiguous) {
        void loadDetails(slug);
      }
    } finally {
      if (favoriteMutation === mutation) {
        favoriteMutation = undefined;
      }
      if (isActiveMutationIdentity(slug, session.email)) {
        renderFavoriteState(false);
      }
    }
  };

  const submitComment = async (): Promise<void> => {
    const slug: string | undefined = activeSlug;
    const service: AuthenticatedGameActionsService | undefined =
      gameActionsService;
    const composer: CommentComposerElements | undefined = commentComposer;
    if (slug === undefined || service === undefined || composer === undefined) {
      return;
    }

    const session: AppSession | undefined = getActionSession(
      'Sign in to post comments.',
    );
    if (
      session === undefined ||
      (commentSubmission?.slug === slug &&
        commentSubmission.email === session.email)
    ) {
      return;
    }

    const mutation = {
      email: session.email,
      slug,
    };
    const draft: string = composer.textarea.value;
    let feedback:
      | { readonly message: string; readonly tone: 'error' | 'status' }
      | undefined;
    let shouldRefreshComments: boolean = false;
    commentSubmission = mutation;
    updateCommentComposerState(composer, { isPending: true });

    try {
      await service.submitComment(slug, draft);
      if (!isActiveMutationIdentity(slug, session.email)) {
        return;
      }

      const activeComposer: CommentComposerElements | undefined =
        commentComposer;
      if (activeComposer !== undefined) {
        activeComposer.textarea.value = '';
        resizeCommentTextarea(activeComposer.textarea);
      }
      shouldRefreshComments = true;
      dispatchSnackbar({ message: 'Comment posted.', variant: 'success' });
    } catch (error: unknown) {
      if (!isActiveMutationIdentity(slug, session.email)) {
        return;
      }

      if (error instanceof AuthenticationRequiredError) {
        requestAuthentication('Sign in to post comments.');
        return;
      }

      let message: string = COMMENT_SUBMISSION_ERROR_MESSAGE;
      if (error instanceof CommentValidationError) {
        message = error.message;
      } else if (isAmbiguousMutationError(error)) {
        message = COMMENT_SUBMISSION_UNKNOWN_MESSAGE;
      }
      feedback = { message, tone: 'error' };
      dispatchSnackbar({ message: feedback.message, variant: 'error' });
    } finally {
      if (commentSubmission === mutation) {
        commentSubmission = undefined;
      }
      if (isActiveMutationIdentity(slug, session.email)) {
        const activeComposer: CommentComposerElements | undefined =
          commentComposer;
        if (activeComposer !== undefined) {
          updateCommentComposerState(activeComposer, {
            isPending: false,
            ...feedback,
          });
          if (feedback !== undefined) {
            activeComposer.textarea.focus({ preventScroll: true });
          }
        }
      }
    }

    if (
      shouldRefreshComments &&
      isActiveMutationIdentity(slug, session.email)
    ) {
      void loadComments(slug);
    }
  };

  const toggleCommentLike = async (commentId: string): Promise<void> => {
    const slug: string | undefined = activeSlug;
    const service: AuthenticatedGameActionsService | undefined =
      gameActionsService;
    if (
      slug === undefined ||
      service === undefined ||
      !commentsById.has(commentId)
    ) {
      return;
    }

    const session: AppSession | undefined = getActionSession(
      COMMENT_LIKE_SIGN_IN_MESSAGE,
    );
    const currentLikeMutation = likeMutations.get(commentId);
    if (
      session === undefined ||
      (currentLikeMutation?.slug === slug &&
        currentLikeMutation.email === session.email)
    ) {
      return;
    }

    const mutation = {
      email: session.email,
      slug,
    };
    likeMutations.set(commentId, mutation);
    renderCommentLikeState(commentId, true);

    try {
      const result: CommentLikeResult =
        await service.toggleCommentLike(commentId);
      if (!isActiveMutationIdentity(slug, session.email)) {
        return;
      }

      const comment: GameComment | undefined = commentsById.get(commentId);
      if (comment !== undefined) {
        commentsById.set(commentId, {
          ...comment,
          isLikedByCurrentUser: result.isLikedByCurrentUser,
          likesCount: result.likesCount,
        });
        renderCommentLikeState(commentId, false);
      }
      dispatchSnackbar({
        message: result.isLikedByCurrentUser
          ? 'Comment liked.'
          : 'Comment like removed.',
        variant: 'success',
      });
    } catch (error: unknown) {
      if (!isActiveMutationIdentity(slug, session.email)) {
        return;
      }

      if (error instanceof AuthenticationRequiredError) {
        requestAuthentication(COMMENT_LIKE_SIGN_IN_MESSAGE);
        return;
      }

      const isAmbiguous: boolean = isAmbiguousMutationError(error);
      dispatchSnackbar({
        message: isAmbiguous
          ? COMMENT_LIKE_UNKNOWN_MESSAGE
          : COMMENT_LIKE_ERROR_MESSAGE,
        variant: 'error',
      });
      if (isAmbiguous) {
        void loadComments(slug);
      }
    } finally {
      if (likeMutations.get(commentId) === mutation) {
        likeMutations.delete(commentId);
      }
      if (isActiveMutationIdentity(slug, session.email)) {
        renderCommentLikeState(commentId, false);
      }
    }
  };

  const restoreFocus = (): void => {
    if (returnFocusElement?.isConnected === true) {
      returnFocusElement.focus({ preventScroll: true });
      if (document.activeElement === returnFocusElement) {
        returnFocusElement = null;
        return;
      }
    }

    const mainContent: HTMLElement | null =
      document.querySelector<HTMLElement>('#main-content');
    if (mainContent !== null) {
      mainContent.tabIndex = -1;
      mainContent.focus({ preventScroll: true });
    }
    returnFocusElement = null;
  };

  const finishClose = (): void => {
    closeTimer = undefined;
    if (!dialog.open) {
      return;
    }

    dialog.close();
    dialog.classList.remove('game-details-dialog--closing');
    if (document.querySelector('dialog[open]') === null) {
      document.body.classList.remove('dialog-open');
      restoreFocus();
    } else {
      returnFocusElement = null;
    }
  };

  const closeDialog = (): void => {
    if (
      !dialog.open ||
      dialog.classList.contains('game-details-dialog--closing')
    ) {
      return;
    }

    if (openAnimationFrame !== undefined) {
      globalThis.cancelAnimationFrame(openAnimationFrame);
      openAnimationFrame = undefined;
    }

    dialog.classList.add('game-details-dialog--closing');
    dialog.classList.remove('game-details-dialog--visible');
    closeTimer = globalThis.setTimeout(
      finishClose,
      DIALOG_TRANSITION_DURATION_MS,
    );
  };

  const openDialog = (): void => {
    if (closeTimer !== undefined) {
      globalThis.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
    if (openAnimationFrame !== undefined) {
      globalThis.cancelAnimationFrame(openAnimationFrame);
      openAnimationFrame = undefined;
    }

    const wasOpen: boolean = dialog.open;
    dialog.classList.remove('game-details-dialog--closing');
    if (!wasOpen) {
      const activeElement: Element | null = document.activeElement;
      returnFocusElement =
        activeElement instanceof HTMLElement && activeElement !== document.body
          ? activeElement
          : null;
      dialog.showModal();
    }

    document.body.classList.add('dialog-open');
    openAnimationFrame = globalThis.requestAnimationFrame((): void => {
      dialog.classList.add('game-details-dialog--visible');
      if (!wasOpen) {
        closeButton.focus({ preventScroll: true });
      }
      openAnimationFrame = undefined;
    });
  };

  const openGame = (slug: string): void => {
    const activeElement: Element | null = document.activeElement;
    const shouldMoveFocusToClose: boolean =
      dialog.open &&
      activeElement !== null &&
      (detailsContent.contains(activeElement) ||
        commentsContent.contains(activeElement) ||
        commentComposerHost.contains(activeElement));
    if (slug !== activeSlug) {
      avatarColorResolver = createAvatarColorRegistry();
    }
    activeSlug = slug;
    dialog.dataset.gameSlug = slug;
    dialog.scrollTop = 0;
    commentsSection.hidden = false;
    renderCommentComposer();
    openDialog();
    if (shouldMoveFocusToClose) {
      closeButton.focus({ preventScroll: true });
    }
    const detailsOutcome: Promise<DetailsLoadOutcome> = loadDetails(slug);
    void loadComments(slug, detailsOutcome);
  };

  const deactivateGame = (): void => {
    activeSlug = undefined;
    renderedGame = undefined;
    commentsById.clear();
    commentComposer = undefined;
    commentComposerHost.replaceChildren();
    avatarColorResolver = createAvatarColorRegistry();
    delete dialog.dataset.gameSlug;
    abortDetailsRequest();
    abortCommentsRequest();
  };

  dialog.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (event.target.closest('[data-dialog-close]') !== null) {
        dispatchGameDetailsCloseRequest();
        return;
      }

      if (event.target.closest('[data-game-favorite]') !== null) {
        void toggleFavorite();
        return;
      }

      const commentLikeButton: HTMLButtonElement | null =
        event.target.closest<HTMLButtonElement>('[data-comment-like]');
      if (commentLikeButton !== null) {
        const { commentId } = commentLikeButton.dataset;
        if (commentId !== undefined) {
          void toggleCommentLike(commentId);
        }
        return;
      }

      if (event.target !== dialog) {
        return;
      }

      const bounds: DOMRect = dialog.getBoundingClientRect();
      const isInsideDialog: boolean =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      if (!isInsideDialog) {
        dispatchGameDetailsCloseRequest();
      }
    },
    { signal },
  );

  dialog.addEventListener(
    'submit',
    (event: SubmitEvent): void => {
      if (
        commentComposer === undefined ||
        event.target !== commentComposer.element
      ) {
        return;
      }

      event.preventDefault();
      void submitComment();
    },
    { signal },
  );

  dialog.addEventListener(
    'input',
    (event: Event): void => {
      if (
        commentComposer === undefined ||
        event.target !== commentComposer.textarea
      ) {
        return;
      }

      resizeCommentTextarea(commentComposer.textarea);
      updateCommentComposerState(commentComposer, { isPending: false });
    },
    { signal },
  );

  dialog.addEventListener(
    'keydown',
    (event: KeyboardEvent): void => {
      if (
        commentComposer === undefined ||
        event.target !== commentComposer.textarea ||
        event.key !== 'Enter' ||
        event.shiftKey ||
        event.isComposing
      ) {
        return;
      }

      event.preventDefault();
      commentComposer.element.requestSubmit();
    },
    { signal },
  );

  dialog.addEventListener(
    'cancel',
    (event: Event): void => {
      event.preventDefault();
      dispatchGameDetailsCloseRequest();
    },
    { signal },
  );

  return {
    destroy: (): void => {
      isDestroyed = true;
      deactivateGame();
      eventController.abort();
      if (closeTimer !== undefined) {
        globalThis.clearTimeout(closeTimer);
      }
      if (openAnimationFrame !== undefined) {
        globalThis.cancelAnimationFrame(openAnimationFrame);
      }
      if (dialog.open) {
        dialog.close();
      }
      dialog.classList.remove(
        'game-details-dialog--closing',
        'game-details-dialog--visible',
      );
      if (document.querySelector('dialog[open]') === null) {
        document.body.classList.remove('dialog-open');
      }
      returnFocusElement = null;
    },
    element: dialog,
    setGameActionsService: (service: AuthenticatedGameActionsService): void => {
      gameActionsService = service;
    },
    setSession: (session: AppSession | undefined): void => {
      if (areSessionsEqual(activeSession, session)) {
        return;
      }

      activeSession = session;
      renderCommentComposer();

      if (activeSlug === undefined || !dialog.open) {
        return;
      }

      const slug: string = activeSlug;
      const detailsOutcome: Promise<DetailsLoadOutcome> = loadDetails(slug);
      void loadComments(slug, detailsOutcome);
    },
    synchronize: (slug: string | undefined): void => {
      if (slug === undefined) {
        deactivateGame();
        closeDialog();
        return;
      }

      if (
        slug === activeSlug &&
        dialog.open &&
        !dialog.classList.contains('game-details-dialog--closing')
      ) {
        return;
      }

      openGame(slug);
    },
  };
};
