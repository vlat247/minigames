import { createSectionHeading } from '../../components/section-heading/section-heading';
import {
  GAME_DETAILS_OPEN_EVENT,
  type GameDetailsRequestDetail,
} from '../../components/dialogs/game-details-events';
import { getAppPath } from '../../utils/paths';
import { featuredGames, type FeaturedGame } from './new-games-data';
import './new-games.scss';

const INITIAL_ACTIVE_GAME_INDEX: number = 2;
const CAROUSEL_TRANSITION_DURATION_MS: number = 480;
const CAROUSEL_ENTRY_DISTANCE_PX: number = 24;
const AUTOPLAY_INTERVAL_MS: number = 4000;
const SWIPE_THRESHOLD_PX: number = 48;

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
  { className: 'game-card--far-previous', offset: -2 },
  { className: 'game-card--previous', offset: -1 },
  { className: 'game-card--active', offset: 0 },
  { className: 'game-card--next', offset: 1 },
  { className: 'game-card--far-next', offset: 2 },
];

const carouselPositionClassNames: readonly string[] = carouselPositions.map(
  (position: CarouselPosition): string => position.className,
);

const getLoopedIndex = (index: number): number => {
  return (index + featuredGames.length) % featuredGames.length;
};

const createCarouselControls = (): HTMLElement => {
  const controls: HTMLDivElement = document.createElement('div');
  controls.className = 'new-games__controls';
  controls.innerHTML = `
    <button class="new-games__arrow" type="button" data-carousel-direction="previous" aria-label="Previous game">←</button>
    <button class="new-games__arrow" type="button" data-carousel-direction="next" aria-label="Next game">→</button>
  `;

  return controls;
};

const createGameCard = (
  game: FeaturedGame,
  index: number,
): HTMLButtonElement => {
  const card: HTMLButtonElement = document.createElement('button');
  card.className = 'game-card';
  card.type = 'button';
  card.dataset.gameIndex = String(index);
  card.setAttribute('aria-label', `Open details for ${game.name}`);
  card.innerHTML = `
    <img class="game-card__image" src="${getAppPath(game.image)}" alt="${game.name}" draggable="false" />
    <span class="game-card__info">
      <span class="game-card__title" title="${game.name}">${game.name}</span>
      <span class="game-card__meta">
        <span role="img" aria-label="Rated ${game.rating} out of 5"><span aria-hidden="true">★</span> ${game.rating}</span>
        <span role="img" aria-label="${game.likes} likes"><span aria-hidden="true">♥</span> ${game.likes}</span>
      </span>
    </span>
  `;

  return card;
};

const animateCardMovement = (
  cards: readonly HTMLButtonElement[],
  previousRects: ReadonlyMap<HTMLButtonElement, DOMRect>,
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
      card.animate(
        [
          {
            opacity: 0,
            transform: `translateX(${CAROUSEL_ENTRY_DISTANCE_PX}px) scale(0.96)`,
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
  const cards: HTMLButtonElement[] = featuredGames.map(
    (game: FeaturedGame, index: number): HTMLButtonElement =>
      createGameCard(game, index),
  );
  track.append(...cards);

  const controls: HTMLElement = createCarouselControls();
  const gameDetailsDialog: HTMLDialogElement | null = document.querySelector(
    '.game-details-dialog',
  );
  const status: HTMLParagraphElement = document.createElement('p');
  status.className = 'new-games__status';
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  let activeGameIndex: number = INITIAL_ACTIVE_GAME_INDEX;
  let activePointerId: number | undefined;
  let autoplayDeadline: number = 0;
  let autoplayRemainingMs: number = AUTOPLAY_INTERVAL_MS;
  let autoplayTimer: number | undefined;
  let clickSuppressionTimer: number | undefined;
  let pointerCaptureTarget: HTMLElement | undefined;
  let pointerCurrentX: number = 0;
  let pointerStartX: number = 0;

  const updateCardPositions = (shouldAnimate: boolean): void => {
    const previousRects = new Map<HTMLButtonElement, DOMRect>();
    if (shouldAnimate) {
      for (const card of cards) {
        if (card.ariaHidden !== 'true') {
          previousRects.set(card, card.getBoundingClientRect());
        }
      }
    }

    for (const card of cards) {
      card.classList.remove(...carouselPositionClassNames);
      card.ariaHidden = 'true';
      card.removeAttribute('aria-current');
    }

    for (const position of carouselPositions) {
      const cardIndex: number = getLoopedIndex(
        activeGameIndex + position.offset,
      );
      const card: HTMLButtonElement | undefined = cards[cardIndex];
      if (card === undefined) {
        continue;
      }

      card.classList.add(position.className);
      card.ariaHidden = 'false';
      if (position.offset === 0) {
        card.setAttribute('aria-current', 'true');
      }
    }

    const activeGame: FeaturedGame | undefined = featuredGames[activeGameIndex];
    if (activeGame !== undefined) {
      status.textContent = `Slide ${activeGameIndex + 1} of ${featuredGames.length}: ${activeGame.name}`;
    }

    if (shouldAnimate) {
      animateCardMovement(cards, previousRects);
    }
  };

  const moveCarousel = (direction: CarouselDirection): void => {
    activeGameIndex = getLoopedIndex(
      activeGameIndex + (direction === 'next' ? 1 : -1),
    );
    updateCardPositions(true);
  };

  const clearAutoplayTimer = (): void => {
    if (autoplayTimer === undefined) {
      return;
    }

    globalThis.clearTimeout(autoplayTimer);
    autoplayTimer = undefined;
  };

  const scheduleAutoplay = (delay: number): void => {
    clearAutoplayTimer();
    autoplayRemainingMs = delay;
    autoplayDeadline = globalThis.performance.now() + delay;
    autoplayTimer = globalThis.setTimeout((): void => {
      autoplayTimer = undefined;
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
    scheduleAutoplay(autoplayRemainingMs);
  };

  const restartAutoplay = (): void => {
    scheduleAutoplay(AUTOPLAY_INTERVAL_MS);
  };

  const finishPointerInteraction = (
    event: PointerEvent,
    isCancelled: boolean,
  ): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    if (pointerCaptureTarget?.hasPointerCapture(event.pointerId) === true) {
      pointerCaptureTarget.releasePointerCapture(event.pointerId);
    }
    pointerCaptureTarget = undefined;
    track.classList.remove('new-games__track--dragging');
    track.style.removeProperty('--carousel-drag-offset');
    activePointerId = undefined;

    if (isCancelled) {
      resumeAutoplay();
      return;
    }

    const swipeDistance: number = pointerCurrentX - pointerStartX;
    if (Math.abs(swipeDistance) < SWIPE_THRESHOLD_PX) {
      resumeAutoplay();
      return;
    }

    moveCarousel(swipeDistance < 0 ? 'next' : 'previous');
    if (clickSuppressionTimer !== undefined) {
      globalThis.clearTimeout(clickSuppressionTimer);
    }
    track.dataset.suppressCardClick = 'true';
    clickSuppressionTimer = globalThis.setTimeout((): void => {
      delete track.dataset.suppressCardClick;
      clickSuppressionTimer = undefined;
    }, 0);
    restartAutoplay();
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
      );
      restartAutoplay();
    },
    { signal },
  );

  track.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (
        track.dataset.suppressCardClick === 'true' ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const card: HTMLButtonElement | null = event.target.closest(
        'button[data-game-index]',
      );
      if (card === null) {
        return;
      }

      const gameIndex: number = Number(card.dataset.gameIndex);
      const game: FeaturedGame | undefined = featuredGames[gameIndex];
      if (game === undefined) {
        return;
      }

      const detail: GameDetailsRequestDetail = { slug: game.slug };
      if (gameDetailsDialog !== null) {
        pauseAutoplay();
      }
      document.dispatchEvent(
        new CustomEvent<GameDetailsRequestDetail>(GAME_DETAILS_OPEN_EVENT, {
          detail,
        }),
      );
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
      moveCarousel(event.key === 'ArrowLeft' ? 'previous' : 'next');
      restartAutoplay();
    },
    { signal },
  );

  track.addEventListener(
    'pointerdown',
    (event: PointerEvent): void => {
      if (!event.isPrimary || event.button !== 0) {
        return;
      }

      activePointerId = event.pointerId;
      pointerStartX = event.clientX;
      pointerCurrentX = event.clientX;
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
      pointerCurrentX = event.clientX;
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

  gameDetailsDialog?.addEventListener('close', restartAutoplay, { signal });

  updateCardPositions(false);

  section.append(
    createSectionHeading({
      controls,
      id: 'new-games-title',
      title: 'New Games',
    }),
    status,
    track,
  );

  scheduleAutoplay(AUTOPLAY_INTERVAL_MS);

  return {
    destroy: (): void => {
      eventController.abort();
      clearAutoplayTimer();
      if (clickSuppressionTimer !== undefined) {
        globalThis.clearTimeout(clickSuppressionTimer);
      }
      for (const card of cards) {
        for (const animation of card.getAnimations()) {
          animation.cancel();
        }
      }
    },
    element: section,
  };
};
