import {
  createBlockErrorState,
  createEmptyState,
  createSkeletonState,
} from '../../components/async-state/async-state';
import { createSectionHeading } from '../../components/section-heading/section-heading';
import { dispatchGameDetailsRequest } from '../../components/dialogs/game-details-events';
import { dispatchSnackbar } from '../../components/snackbar/snackbar-events';
import { isApiAbortError } from '../../services/api-client';
import { fetchFeaturedGames } from '../../services/minigames-api';
import type { GameSummary } from '../../types/api';
import { getAppPath } from '../../utils/paths';
import './new-games.scss';

const INITIAL_ACTIVE_GAME_INDEX: number = 2;
const CAROUSEL_TRANSITION_DURATION_MS: number = 480;
const CAROUSEL_ENTRY_DISTANCE_PX: number = 24;
const AUTOPLAY_INTERVAL_MS: number = 4000;
const SWIPE_THRESHOLD_PX: number = 48;
const CLICK_SLOP_PX: number = 8;
const LONG_PRESS_DURATION_MS: number = 500;
const SYNTHETIC_CLICK_SUPPRESSION_MS: number = 500;
const DESKTOP_LAYOUT_MEDIA_QUERY: string = '(min-width: 1280px)';
const heartIconPath: string = getAppPath('/assets/icons/heart.png');
const starIconPath: string = getAppPath('/assets/icons/star.png');
const likesFormatter: Intl.NumberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact',
});

type CarouselDirection = 'next' | 'previous';

interface CarouselPosition {
  readonly className: string;
  readonly offset: number;
}

export interface NewGamesSectionController {
  readonly destroy: () => void;
  readonly element: HTMLElement;
}

const carouselPositions: readonly CarouselPosition[] = [
  { className: 'game-card--active', offset: 0 },
  { className: 'game-card--previous', offset: -1 },
  { className: 'game-card--next', offset: 1 },
  { className: 'game-card--far-previous', offset: -2 },
  { className: 'game-card--far-next', offset: 2 },
];

const carouselPositionClassNames: readonly string[] = carouselPositions.map(
  (position: CarouselPosition): string => position.className,
);

const getLoopedIndex = (index: number, itemCount: number): number => {
  return (index + itemCount) % itemCount;
};

const createCarouselControls = (): HTMLElement => {
  const controls: HTMLDivElement = document.createElement('div');
  controls.className = 'new-games__controls';
  controls.innerHTML = `
    <button class="new-games__arrow new-games__arrow--previous" type="button" data-carousel-direction="previous" aria-label="Previous game">
      <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
    </button>
    <button class="new-games__arrow new-games__arrow--next" type="button" data-carousel-direction="next" aria-label="Next game">
      <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
    </button>
  `;

  return controls;
};

const createGameCard = (
  game: GameSummary,
  index: number,
): HTMLButtonElement => {
  const card: HTMLButtonElement = document.createElement('button');
  const image: HTMLImageElement = document.createElement('img');
  const info: HTMLSpanElement = document.createElement('span');
  const title: HTMLSpanElement = document.createElement('span');
  const meta: HTMLSpanElement = document.createElement('span');
  const rating: HTMLSpanElement = document.createElement('span');
  const ratingIcon: HTMLImageElement = document.createElement('img');
  const likes: HTMLSpanElement = document.createElement('span');
  const likesIcon: HTMLImageElement = document.createElement('img');
  const displayName: string = game.name.trim() || 'Untitled game';
  const displayRating: string = Number.isFinite(game.rating)
    ? game.rating.toFixed(1)
    : 'Not rated';
  const displayLikes: string = Number.isFinite(game.likesCount)
    ? likesFormatter.format(game.likesCount)
    : '0';

  card.className = 'game-card';
  card.type = 'button';
  card.dataset.gameIndex = String(index);
  card.dataset.gameSlug = game.slug;
  card.setAttribute('aria-label', `Open details for ${displayName}`);

  image.alt = displayName;
  image.className = 'game-card__image';
  image.decoding = 'async';
  image.draggable = false;
  image.src = getAppPath(game.cardImage);

  info.className = 'game-card__info';
  title.className = 'game-card__title';
  title.textContent = displayName;
  title.title = displayName;
  meta.className = 'game-card__meta';

  rating.setAttribute('aria-label', `Rated ${displayRating} out of 5`);
  rating.setAttribute('role', 'img');
  ratingIcon.alt = '';
  ratingIcon.ariaHidden = 'true';
  ratingIcon.className = 'game-card__meta-icon';
  ratingIcon.src = starIconPath;
  rating.append(ratingIcon, displayRating);

  likes.setAttribute('aria-label', `${displayLikes} likes`);
  likes.setAttribute('role', 'img');
  likesIcon.alt = '';
  likesIcon.ariaHidden = 'true';
  likesIcon.className = 'game-card__meta-icon';
  likesIcon.src = heartIconPath;
  likes.append(likesIcon, displayLikes);

  meta.append(rating, likes);
  info.append(title, meta);
  card.append(image, info);

  return card;
};

const animateCardMovement = (
  cards: readonly HTMLButtonElement[],
  previousRects: ReadonlyMap<HTMLButtonElement, DOMRect>,
  direction: CarouselDirection,
): void => {
  if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  for (const card of cards) {
    if (card.ariaHidden === 'true') {
      continue;
    }

    const nextRect: DOMRect = card.getBoundingClientRect();
    const previousRect: DOMRect | undefined = previousRects.get(card);

    if (previousRect === undefined) {
      const entryDistance: number =
        direction === 'next'
          ? CAROUSEL_ENTRY_DISTANCE_PX
          : -CAROUSEL_ENTRY_DISTANCE_PX;
      card.animate(
        [
          {
            opacity: 0,
            transform: `translateX(${entryDistance}px) scale(0.96)`,
            transformOrigin: 'top left',
          },
          {
            opacity: 1,
            transform: 'translateX(0) scale(1)',
            transformOrigin: 'top left',
          },
        ],
        {
          duration: CAROUSEL_TRANSITION_DURATION_MS,
          easing: 'ease',
        },
      );
      continue;
    }

    const translateX: number = previousRect.left - nextRect.left;
    const scaleX: number = previousRect.width / nextRect.width;
    const scaleY: number = previousRect.height / nextRect.height;
    card.animate(
      [
        {
          transform: `translateX(${translateX}px) scale(${scaleX}, ${scaleY})`,
          transformOrigin: 'top left',
        },
        {
          transform: 'translateX(0) scale(1, 1)',
          transformOrigin: 'top left',
        },
      ],
      {
        duration: CAROUSEL_TRANSITION_DURATION_MS,
        easing: 'ease',
      },
    );
  }
};

export const createNewGamesSection = (): NewGamesSectionController => {
  const section: HTMLElement = document.createElement('section');
  const eventController: AbortController = new AbortController();
  const { signal } = eventController;
  section.className = 'new-games';
  section.setAttribute('aria-labelledby', 'new-games-title');

  const track: HTMLDivElement = document.createElement('div');
  track.className = 'new-games__track';
  track.setAttribute('role', 'region');
  track.setAttribute('aria-roledescription', 'carousel');
  track.setAttribute('aria-label', 'New games preview');

  const controls: HTMLElement = createCarouselControls();
  const controlButtons: NodeListOf<HTMLButtonElement> =
    controls.querySelectorAll('button[data-carousel-direction]');
  const content: HTMLDivElement = document.createElement('div');
  const desktopLayoutMedia: MediaQueryList = globalThis.matchMedia(
    DESKTOP_LAYOUT_MEDIA_QUERY,
  );
  const gameDetailsDialog: HTMLDialogElement | null = document.querySelector(
    '.game-details-dialog',
  );
  const outgoingCards = new Set<HTMLButtonElement>();
  const status: HTMLParagraphElement = document.createElement('p');
  content.className = 'new-games__content';
  status.className = 'new-games__status';
  status.setAttribute('aria-live', 'off');
  status.setAttribute('aria-atomic', 'true');
  let activeGameIndex: number = 0;
  let activePointerId: number | undefined;
  let autoplayDeadline: number = 0;
  let autoplayRemainingMs: number = AUTOPLAY_INTERVAL_MS;
  let autoplayTimer: number | undefined;
  let cards: HTMLButtonElement[] = [];
  let clickSuppressionTimer: number | undefined;
  let games: readonly GameSummary[] = [];
  let isDestroyed: boolean = false;
  let isFocusWithin: boolean = false;
  let isPointerHovering: boolean = false;
  let pointerCaptureTarget: HTMLElement | undefined;
  let pointerCurrentX: number = 0;
  let pointerMaximumDistance: number = 0;
  let pointerStartX: number = 0;
  let pointerStartY: number = 0;
  let pointerStartedAt: number = 0;
  let requestController: AbortController | undefined;
  let requestSequence: number = 0;

  const cancelCarouselAnimations = (): void => {
    for (const card of cards) {
      for (const animation of card.getAnimations()) {
        animation.cancel();
      }
    }

    for (const outgoingCard of outgoingCards) {
      for (const animation of outgoingCard.getAnimations()) {
        animation.cancel();
      }
      outgoingCard.remove();
    }
    outgoingCards.clear();
  };

  const animateOutgoingCard = (
    card: HTMLButtonElement,
    rect: DOMRect,
    direction: CarouselDirection,
  ): void => {
    if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const outgoingCard: HTMLButtonElement = card.cloneNode(
      true,
    ) as HTMLButtonElement;
    outgoingCard.classList.add('game-card--outgoing');
    outgoingCard.removeAttribute('aria-current');
    delete outgoingCard.dataset.gameIndex;
    outgoingCard.ariaHidden = 'true';
    outgoingCard.tabIndex = -1;
    outgoingCard.style.top = `${rect.top}px`;
    outgoingCard.style.left = `${rect.left}px`;
    outgoingCard.style.width = `${rect.width}px`;
    outgoingCard.style.height = `${rect.height}px`;
    document.body.append(outgoingCard);
    outgoingCards.add(outgoingCard);

    const exitDistance: number =
      direction === 'next'
        ? -CAROUSEL_ENTRY_DISTANCE_PX
        : CAROUSEL_ENTRY_DISTANCE_PX;
    const animation: Animation = outgoingCard.animate(
      [
        {
          opacity: 1,
          transform: 'translateX(0) scale(1)',
          transformOrigin: 'top left',
        },
        {
          opacity: 0,
          transform: `translateX(${exitDistance}px) scale(0.96)`,
          transformOrigin: 'top left',
        },
      ],
      {
        duration: CAROUSEL_TRANSITION_DURATION_MS,
        easing: 'ease',
      },
    );
    const removeOutgoingCard = (): void => {
      outgoingCards.delete(outgoingCard);
      outgoingCard.remove();
    };
    animation.addEventListener('finish', removeOutgoingCard, { once: true });
    animation.addEventListener('cancel', removeOutgoingCard, { once: true });
  };

  const synchronizeCardAccessibility = (): void => {
    const visibleRadius: number = desktopLayoutMedia.matches ? 2 : 1;
    const positionedIndexes = new Set<number>();

    for (const card of cards) {
      card.ariaHidden = 'true';
      card.tabIndex = -1;
    }

    for (const position of carouselPositions) {
      if (games.length === 0) {
        break;
      }

      const cardIndex: number = getLoopedIndex(
        activeGameIndex + position.offset,
        games.length,
      );
      const card: HTMLButtonElement | undefined = cards[cardIndex];
      if (card === undefined || positionedIndexes.has(cardIndex)) {
        continue;
      }
      positionedIndexes.add(cardIndex);

      if (Math.abs(position.offset) <= visibleRadius) {
        card.ariaHidden = 'false';
      }
      if (position.offset === 0) {
        card.tabIndex = 0;
      }
    }
  };

  const updateCardPositions = (
    direction?: CarouselDirection,
    outgoingCard?: HTMLButtonElement,
    shouldAnnounceSlide: boolean = false,
  ): void => {
    cancelCarouselAnimations();
    const previousRects = new Map<HTMLButtonElement, DOMRect>();
    const positionedIndexes = new Set<number>();
    if (direction !== undefined) {
      for (const card of cards) {
        if (card.ariaHidden !== 'true') {
          previousRects.set(card, card.getBoundingClientRect());
        }
      }
    }

    for (const card of cards) {
      card.classList.remove(...carouselPositionClassNames);
      card.removeAttribute('aria-current');
    }

    for (const position of carouselPositions) {
      if (games.length === 0) {
        break;
      }

      const cardIndex: number = getLoopedIndex(
        activeGameIndex + position.offset,
        games.length,
      );
      const card: HTMLButtonElement | undefined = cards[cardIndex];
      if (card === undefined || positionedIndexes.has(cardIndex)) {
        continue;
      }
      positionedIndexes.add(cardIndex);

      card.classList.add(position.className);
      if (position.offset === 0) {
        card.setAttribute('aria-current', 'true');
      }
    }
    synchronizeCardAccessibility();

    const activeGame: GameSummary | undefined = games[activeGameIndex];
    if (activeGame !== undefined) {
      status.setAttribute('aria-live', shouldAnnounceSlide ? 'polite' : 'off');
      status.textContent = `Slide ${activeGameIndex + 1} of ${games.length}: ${activeGame.name}`;
    }

    if (direction === undefined) {
      return;
    }

    const outgoingRect: DOMRect | undefined =
      outgoingCard === undefined ? undefined : previousRects.get(outgoingCard);
    if (outgoingCard !== undefined && outgoingRect !== undefined) {
      animateOutgoingCard(outgoingCard, outgoingRect, direction);
    }
    animateCardMovement(cards, previousRects, direction);
  };

  const moveCarousel = (
    direction: CarouselDirection,
    shouldFocusActiveCard: boolean = false,
    shouldAnnounceSlide: boolean = false,
  ): void => {
    if (games.length <= 1) {
      return;
    }

    const visibleRadius: number = desktopLayoutMedia.matches ? 2 : 1;
    const outgoingOffset: number =
      direction === 'next' ? -visibleRadius : visibleRadius;
    const outgoingCard: HTMLButtonElement | undefined =
      cards[getLoopedIndex(activeGameIndex + outgoingOffset, games.length)];
    activeGameIndex = getLoopedIndex(
      activeGameIndex + (direction === 'next' ? 1 : -1),
      games.length,
    );
    updateCardPositions(direction, outgoingCard, shouldAnnounceSlide);

    if (shouldFocusActiveCard) {
      cards[activeGameIndex]?.focus({ preventScroll: true });
    }
  };

  const clearAutoplayTimer = (): void => {
    if (autoplayTimer === undefined) {
      return;
    }

    globalThis.clearTimeout(autoplayTimer);
    autoplayTimer = undefined;
  };

  const canAutoplay = (): boolean => {
    return (
      !isDestroyed &&
      games.length > 1 &&
      activePointerId === undefined &&
      !isFocusWithin &&
      !isPointerHovering &&
      document.visibilityState !== 'hidden' &&
      gameDetailsDialog?.open !== true
    );
  };

  const scheduleAutoplay = (delay: number): void => {
    clearAutoplayTimer();
    autoplayRemainingMs = delay;
    if (!canAutoplay()) {
      return;
    }

    autoplayDeadline = globalThis.performance.now() + delay;
    autoplayTimer = globalThis.setTimeout((): void => {
      autoplayTimer = undefined;
      if (!canAutoplay()) {
        return;
      }

      moveCarousel('next');
      scheduleAutoplay(AUTOPLAY_INTERVAL_MS);
    }, delay);
  };

  const pauseAutoplay = (): void => {
    if (autoplayTimer === undefined) {
      return;
    }

    autoplayRemainingMs = Math.max(
      autoplayDeadline - globalThis.performance.now(),
      0,
    );
    clearAutoplayTimer();
  };

  const resumeAutoplay = (): void => {
    if (autoplayTimer !== undefined || !canAutoplay()) {
      return;
    }

    scheduleAutoplay(autoplayRemainingMs);
  };

  const restartAutoplay = (): void => {
    autoplayRemainingMs = AUTOPLAY_INTERVAL_MS;
    scheduleAutoplay(AUTOPLAY_INTERVAL_MS);
  };

  const clearCardClickSuppression = (): void => {
    if (clickSuppressionTimer !== undefined) {
      globalThis.clearTimeout(clickSuppressionTimer);
    }

    clickSuppressionTimer = undefined;
    delete track.dataset.suppressCardClick;
  };

  const suppressNextCardClick = (): void => {
    clearCardClickSuppression();
    track.dataset.suppressCardClick = 'true';
    clickSuppressionTimer = globalThis.setTimeout(
      clearCardClickSuppression,
      SYNTHETIC_CLICK_SUPPRESSION_MS,
    );
  };

  const clearPointerInteraction = (shouldReleaseCapture: boolean): void => {
    const pointerId: number | undefined = activePointerId;
    const captureTarget: HTMLElement | undefined = pointerCaptureTarget;
    activePointerId = undefined;
    pointerCaptureTarget = undefined;
    pointerCurrentX = 0;
    pointerMaximumDistance = 0;
    pointerStartX = 0;
    pointerStartY = 0;
    pointerStartedAt = 0;
    track.classList.remove('new-games__track--dragging');
    track.style.removeProperty('--carousel-drag-offset');

    if (
      shouldReleaseCapture &&
      pointerId !== undefined &&
      captureTarget?.hasPointerCapture(pointerId) === true
    ) {
      captureTarget.releasePointerCapture(pointerId);
    }
  };

  const cancelPointerInteraction = (shouldReleaseCapture: boolean): void => {
    if (activePointerId === undefined) {
      return;
    }

    clearPointerInteraction(shouldReleaseCapture);
    resumeAutoplay();
  };

  const finishPointerInteraction = (
    event: PointerEvent,
    isCancelled: boolean,
  ): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    const swipeDistance: number = pointerCurrentX - pointerStartX;
    const maximumPointerDistance: number = pointerMaximumDistance;
    const pressDuration: number =
      globalThis.performance.now() - pointerStartedAt;
    clearPointerInteraction(true);

    if (isCancelled) {
      resumeAutoplay();
      return;
    }

    if (Math.abs(swipeDistance) < SWIPE_THRESHOLD_PX) {
      if (
        maximumPointerDistance > CLICK_SLOP_PX ||
        pressDuration >= LONG_PRESS_DURATION_MS
      ) {
        suppressNextCardClick();
      }
      resumeAutoplay();
      return;
    }

    moveCarousel(swipeDistance < 0 ? 'next' : 'previous', false, true);
    suppressNextCardClick();
    restartAutoplay();
  };

  const setCarouselControlsEnabled = (isEnabled: boolean): void => {
    for (const button of controlButtons) {
      button.disabled = !isEnabled;
    }
  };

  const resetCarousel = (): void => {
    clearAutoplayTimer();
    clearCardClickSuppression();
    clearPointerInteraction(true);
    cancelCarouselAnimations();
    autoplayRemainingMs = AUTOPLAY_INTERVAL_MS;
    activeGameIndex = 0;
    games = [];
    cards = [];
    status.textContent = '';
    track.replaceChildren();
  };

  const renderLoadingState = (): void => {
    resetCarousel();
    setCarouselControlsEnabled(false);
    content.replaceChildren(
      createSkeletonState({
        itemCount: 5,
        label: 'Loading new games',
        variant: 'cards',
      }),
    );
  };

  const renderErrorState = (): void => {
    setCarouselControlsEnabled(false);
    content.replaceChildren(
      createBlockErrorState({
        message: 'Check your connection, then try loading the games again.',
        onRetry: (): void => {
          void loadFeaturedGames();
        },
        title: "We couldn't load the new games",
      }),
    );
  };

  const renderEmptyState = (): void => {
    setCarouselControlsEnabled(false);
    content.replaceChildren(
      createEmptyState({
        message: 'Featured games will appear here when they are available.',
        title: 'No new games yet',
      }),
    );
  };

  const renderGames = (nextGames: readonly GameSummary[]): void => {
    games = nextGames;
    cards = games.map((game: GameSummary, index: number): HTMLButtonElement =>
      createGameCard(game, index),
    );
    activeGameIndex = Math.min(INITIAL_ACTIVE_GAME_INDEX, games.length - 1);
    track.replaceChildren(...cards);
    content.replaceChildren(status, track);
    setCarouselControlsEnabled(games.length > 1);
    updateCardPositions();
    restartAutoplay();
  };

  const loadFeaturedGames = async (): Promise<void> => {
    requestController?.abort();
    const currentRequestController: AbortController = new AbortController();
    const currentRequestSequence: number = requestSequence + 1;
    requestController = currentRequestController;
    requestSequence = currentRequestSequence;
    renderLoadingState();

    try {
      const response = await fetchFeaturedGames({
        signal: currentRequestController.signal,
      });
      if (
        currentRequestSequence !== requestSequence ||
        isDestroyed ||
        currentRequestController.signal.aborted
      ) {
        return;
      }

      requestController = undefined;
      if (response.data.length === 0) {
        renderEmptyState();
        return;
      }

      renderGames(response.data);
    } catch (error: unknown) {
      if (
        currentRequestSequence !== requestSequence ||
        isDestroyed ||
        currentRequestController.signal.aborted ||
        isApiAbortError(error)
      ) {
        return;
      }

      requestController = undefined;
      renderErrorState();
      dispatchSnackbar({
        message: 'New games could not be loaded. Please try again.',
        variant: 'error',
      });
    }
  };

  controls.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const directionButton: HTMLButtonElement | null = event.target.closest(
        'button[data-carousel-direction]',
      );
      if (directionButton === null) {
        return;
      }

      moveCarousel(
        directionButton.dataset.carouselDirection === 'previous'
          ? 'previous'
          : 'next',
        false,
        true,
      );
      restartAutoplay();
    },
    { signal },
  );

  track.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (track.dataset.suppressCardClick === 'true') {
        event.preventDefault();
        clearCardClickSuppression();
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      const card: HTMLButtonElement | null = event.target.closest(
        'button[data-game-index]',
      );
      if (card === null) {
        return;
      }

      const gameSlug: string | undefined = card.dataset.gameSlug;
      if (gameSlug === undefined || gameSlug.length === 0) {
        return;
      }

      if (gameDetailsDialog !== null) {
        pauseAutoplay();
      }
      dispatchGameDetailsRequest(gameSlug);
    },
    { signal },
  );

  track.addEventListener(
    'keydown',
    (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();
      moveCarousel(event.key === 'ArrowLeft' ? 'previous' : 'next', true, true);
      restartAutoplay();
    },
    { signal },
  );

  section.addEventListener(
    'focusin',
    (): void => {
      isFocusWithin = true;
      pauseAutoplay();
    },
    { signal },
  );

  section.addEventListener(
    'focusout',
    (event: FocusEvent): void => {
      if (
        event.relatedTarget instanceof Node &&
        section.contains(event.relatedTarget)
      ) {
        return;
      }

      isFocusWithin = false;
      resumeAutoplay();
    },
    { signal },
  );

  track.addEventListener(
    'pointerenter',
    (): void => {
      isPointerHovering = true;
      pauseAutoplay();
    },
    { signal },
  );

  track.addEventListener(
    'pointerleave',
    (): void => {
      isPointerHovering = false;
      resumeAutoplay();
    },
    { signal },
  );

  track.addEventListener(
    'pointerdown',
    (event: PointerEvent): void => {
      if (
        activePointerId !== undefined ||
        !event.isPrimary ||
        event.button !== 0
      ) {
        return;
      }

      activePointerId = event.pointerId;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      pointerCurrentX = event.clientX;
      pointerMaximumDistance = 0;
      pointerStartedAt = globalThis.performance.now();
      track.classList.add('new-games__track--dragging');
      const pressedCard: HTMLButtonElement | null =
        event.target instanceof Element
          ? event.target.closest('button[data-game-index]')
          : null;
      pointerCaptureTarget = pressedCard ?? track;
      pointerCaptureTarget.setPointerCapture(event.pointerId);
      pauseAutoplay();
    },
    { signal },
  );

  track.addEventListener(
    'pointermove',
    (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      pointerCurrentX = event.clientX;
      pointerMaximumDistance = Math.max(
        pointerMaximumDistance,
        Math.hypot(
          event.clientX - pointerStartX,
          event.clientY - pointerStartY,
        ),
      );
      track.style.setProperty(
        '--carousel-drag-offset',
        `${pointerCurrentX - pointerStartX}px`,
      );
    },
    { signal },
  );

  track.addEventListener(
    'pointerup',
    (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      pointerCurrentX = event.clientX;
      pointerMaximumDistance = Math.max(
        pointerMaximumDistance,
        Math.hypot(
          event.clientX - pointerStartX,
          event.clientY - pointerStartY,
        ),
      );
      finishPointerInteraction(event, false);
    },
    { signal },
  );

  track.addEventListener(
    'pointercancel',
    (event: PointerEvent): void => {
      finishPointerInteraction(event, true);
    },
    { signal },
  );

  track.addEventListener(
    'lostpointercapture',
    (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      cancelPointerInteraction(false);
    },
    { signal },
  );

  globalThis.addEventListener(
    'blur',
    (): void => {
      cancelPointerInteraction(true);
    },
    { signal },
  );

  document.addEventListener(
    'visibilitychange',
    (): void => {
      if (document.visibilityState === 'hidden') {
        pauseAutoplay();
        return;
      }

      resumeAutoplay();
    },
    { signal },
  );

  desktopLayoutMedia.addEventListener(
    'change',
    (): void => {
      synchronizeCardAccessibility();
    },
    { signal },
  );

  gameDetailsDialog?.addEventListener('close', resumeAutoplay, { signal });

  section.append(
    createSectionHeading({
      controls,
      id: 'new-games-title',
      title: 'New Games',
    }),
    content,
  );

  void loadFeaturedGames();

  return {
    destroy: (): void => {
      isDestroyed = true;
      requestSequence += 1;
      requestController?.abort();
      requestController = undefined;
      eventController.abort();
      clearPointerInteraction(true);
      clearAutoplayTimer();
      clearCardClickSuppression();
      cancelCarouselAnimations();
    },
    element: section,
  };
};
