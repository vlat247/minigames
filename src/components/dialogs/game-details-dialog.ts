import {
  createBlockErrorState,
  createEmptyState,
  createSkeletonState,
} from '../async-state/async-state';
import { dispatchSnackbar } from '../snackbar/snackbar-events';
import { ApiHttpError, isApiAbortError } from '../../services/api-client';
import {
  fetchGameComments,
  fetchGameDetails,
} from '../../services/minigames-api';
import type { CommentsResponse, GameDetails } from '../../types/api';
import {
  createCommentElements,
  createGameDetailsFragment,
  GAME_DETAILS_TITLE_ID,
  isCommentsResponsePayload,
  isGameDetailsPayload,
} from './game-details-content';
import { dispatchGameDetailsCloseRequest } from './game-details-events';
import './game-details-dialog.scss';

const DIALOG_TRANSITION_DURATION_MS: number = 240;
const LATEST_COMMENTS_LIMIT: number = 3;
const DETAILS_ERROR_MESSAGE: string =
  'Game details are unavailable right now. Please try again.';
const COMMENTS_ERROR_MESSAGE: string =
  'The latest comments are unavailable right now. Please try again.';
const GAME_NOT_FOUND_MESSAGE: string = 'We could not find the requested game.';
const GAME_COMMENTS_TITLE_ID: string = 'game-comments-title';

type DetailsLoadOutcome = 'empty' | 'error' | 'not-found' | 'ready' | 'stale';

export interface GameDetailsDialogController {
  readonly destroy: () => void;
  readonly element: HTMLDialogElement;
  readonly synchronize: (slug: string | undefined) => void;
}

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

  let activeSlug: string | undefined;
  let closeTimer: number | undefined;
  let commentsRequest: AbortController | undefined;
  let commentsRequestVersion: number = 0;
  let detailsRequest: AbortController | undefined;
  let detailsRequestVersion: number = 0;
  let isDestroyed: boolean = false;
  let openAnimationFrame: number | undefined;
  let returnFocusElement: HTMLElement | null = null;

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
    detailsContent.removeAttribute('aria-busy');
    detailsContent.replaceChildren(createGameDetailsFragment(game));
    setDialogTitle();
  };

  const renderCommentsLoading = (): void => {
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

    commentsContent.replaceChildren(...createCommentElements(response.data));
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
        commentsContent.contains(activeElement));
    activeSlug = slug;
    dialog.dataset.gameSlug = slug;
    dialog.scrollTop = 0;
    commentsSection.hidden = false;
    openDialog();
    if (shouldMoveFocusToClose) {
      closeButton.focus({ preventScroll: true });
    }
    const detailsOutcome: Promise<DetailsLoadOutcome> = loadDetails(slug);
    void loadComments(slug, detailsOutcome);
  };

  const deactivateGame = (): void => {
    activeSlug = undefined;
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
