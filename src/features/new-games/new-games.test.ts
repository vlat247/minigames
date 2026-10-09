import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import {
  GAME_DETAILS_OPEN_EVENT,
  isGameDetailsRequestDetail,
  type GameDetailsRequestDetail,
} from '../../components/dialogs/game-details-events';
import type { SnackbarOptions } from '../../components/snackbar/snackbar';
import {
  SNACKBAR_SHOW_EVENT,
  isSnackbarRequestDetail,
} from '../../components/snackbar/snackbar-events';
import { ApiAbortError } from '../../services/api-client';
import { fetchFeaturedGames } from '../../services/minigames-api';
import type { GameSummary, GamesResponse } from '../../types/api';
import {
  createNewGamesSection,
  type NewGamesSectionController,
} from './new-games';

vi.mock('../../services/minigames-api', () => ({
  fetchFeaturedGames: vi.fn(),
}));

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: Value | PromiseLike<Value>) => void;
}

interface PromiseWithResolversConstructor extends PromiseConstructor {
  readonly withResolvers: <Value>() => Deferred<Value>;
}

interface AnimationRecord {
  readonly animation: TestAnimation;
  readonly element: HTMLElement;
  readonly keyframes: Keyframe[] | PropertyIndexedKeyframes | null;
  readonly options: number | KeyframeAnimationOptions | undefined;
}

interface PointerEventOptions {
  readonly button?: number;
  readonly clientX?: number;
  readonly clientY?: number;
  readonly isPrimary?: boolean;
  readonly pointerId: number;
}

const DESKTOP_MEDIA_QUERY: string = '(min-width: 1280px)';
const REDUCED_MOTION_MEDIA_QUERY: string = '(prefers-reduced-motion: reduce)';

const GAMES: readonly GameSummary[] = [
  {
    cardImage: '/assets/images/games/alpha.webp',
    category: 'Puzzle',
    likesCount: 1500,
    name: 'Alpha',
    price: 'Free',
    rating: 4.94,
    shortDescription: 'Alpha description',
    slug: 'alpha',
  },
  {
    cardImage: '/assets/images/games/beta.webp',
    category: 'Strategy',
    likesCount: 20,
    name: 'Beta',
    price: 'Free',
    rating: 4.2,
    shortDescription: 'Beta description',
    slug: 'beta',
  },
  {
    cardImage: '/assets/images/games/gamma.webp',
    category: 'Arcade',
    likesCount: 30,
    name: 'Gamma',
    price: 'Free',
    rating: 4.7,
    shortDescription: 'Gamma description',
    slug: 'gamma',
  },
  {
    cardImage: '/assets/images/games/delta.webp',
    category: 'Action',
    likesCount: 40,
    name: 'Delta',
    price: 'Free',
    rating: 4.5,
    shortDescription: 'Delta description',
    slug: 'delta',
  },
  {
    cardImage: '/assets/images/games/untitled.webp',
    category: 'Other',
    likesCount: Infinity,
    name: ' '.repeat(3),
    price: 'Free',
    rating: NaN,
    shortDescription: 'Fallback-value example',
    slug: 'untitled',
  },
];

class TestAnimation extends EventTarget {
  public cancel(): void {
    this.dispatchEvent(new Event('cancel'));
  }

  public finish(): void {
    this.dispatchEvent(new Event('finish'));
  }
}

class TestMediaQueryList extends EventTarget {
  private isMatch: boolean;

  public onchange: ((event: MediaQueryListEvent) => void) | null = null;

  public readonly media: string;

  public constructor(media: string, isMatch: boolean = false) {
    super();
    this.media = media;
    this.isMatch = isMatch;
    Object.defineProperty(this, 'matches', {
      configurable: true,
      get: (): boolean => this.isMatch,
    });
  }

  public addListener(listener: (event: MediaQueryListEvent) => void): void {
    this.addEventListener('change', listener as EventListener);
  }

  public removeListener(listener: (event: MediaQueryListEvent) => void): void {
    this.removeEventListener('change', listener as EventListener);
  }

  public setMatches(isMatch: boolean): void {
    if (this.isMatch === isMatch) {
      return;
    }

    this.isMatch = isMatch;
    const event: MediaQueryListEvent = new Event(
      'change',
    ) as MediaQueryListEvent;
    Object.defineProperties(event, {
      matches: { value: isMatch },
      media: { value: this.media },
    });
    this.dispatchEvent(event);
    this.onchange?.(event);
  }
}

const controllers: NewGamesSectionController[] = [];
const fetchFeaturedGamesMock: Mock<typeof fetchFeaturedGames> =
  vi.mocked(fetchFeaturedGames);
const animationRecords: AnimationRecord[] = [];
const capturedPointers = new Map<HTMLElement, Set<number>>();
const eventControllers: AbortController[] = [];
const gameDetailsRequests: GameDetailsRequestDetail[] = [];
const mediaQueries = new Map<string, TestMediaQueryList>();
const snackbarRequests: SnackbarOptions[] = [];

const createDeferred = <Value>(): Deferred<Value> => {
  const promiseConstructor = Promise as PromiseWithResolversConstructor;
  return promiseConstructor.withResolvers<Value>();
};

const createGamesResponse = (
  games: readonly GameSummary[] = GAMES,
): GamesResponse => ({
  data: games,
  meta: {
    appliedFilter: { featured: true },
    limit: games.length,
    page: 1,
    totalItems: games.length,
    totalPages: games.length === 0 ? 0 : 1,
  },
});

const flushAsyncWork = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const getRequiredElement = <ElementType extends Element>(
  root: ParentNode,
  selector: string,
): ElementType => {
  const element: ElementType | null = root.querySelector<ElementType>(selector);
  if (element === null) {
    throw new Error(`Expected an element matching "${selector}".`);
  }

  return element;
};

const getCards = (root: ParentNode): readonly HTMLButtonElement[] => {
  return [...root.querySelectorAll<HTMLButtonElement>('[data-game-index]')];
};

const getActiveCard = (root: ParentNode): HTMLButtonElement => {
  return getRequiredElement<HTMLButtonElement>(root, '[aria-current="true"]');
};

const getMediaQuery = (query: string): TestMediaQueryList => {
  let mediaQuery: TestMediaQueryList | undefined = mediaQueries.get(query);
  if (mediaQuery === undefined) {
    mediaQuery = new TestMediaQueryList(query);
    mediaQueries.set(query, mediaQuery);
  }

  return mediaQuery;
};

const installBrowserApiShims = (): void => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string): MediaQueryList => {
      return getMediaQuery(query) as unknown as MediaQueryList;
    }),
  );

  Object.defineProperties(HTMLElement.prototype, {
    animate: {
      configurable: true,
      value: function animate(
        this: HTMLElement,
        keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
        options?: number | KeyframeAnimationOptions,
      ): Animation {
        const animation = new TestAnimation();
        animationRecords.push({ animation, element: this, keyframes, options });
        return animation as unknown as Animation;
      },
    },
    getAnimations: {
      configurable: true,
      value: function getAnimations(this: HTMLElement): Animation[] {
        return animationRecords
          .filter((record: AnimationRecord): boolean => record.element === this)
          .map(
            (record: AnimationRecord): Animation =>
              record.animation as unknown as Animation,
          );
      },
    },
    hasPointerCapture: {
      configurable: true,
      value: function hasPointerCapture(
        this: HTMLElement,
        pointerId: number,
      ): boolean {
        return capturedPointers.get(this)?.has(pointerId) === true;
      },
    },
    releasePointerCapture: {
      configurable: true,
      value: function releasePointerCapture(
        this: HTMLElement,
        pointerId: number,
      ): void {
        capturedPointers.get(this)?.delete(pointerId);
      },
    },
    setPointerCapture: {
      configurable: true,
      value: function setPointerCapture(
        this: HTMLElement,
        pointerId: number,
      ): void {
        const pointerIds: Set<number> =
          capturedPointers.get(this) ?? new Set<number>();
        pointerIds.add(pointerId);
        capturedPointers.set(this, pointerIds);
      },
    },
  });

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function getBoundingClientRect(this: HTMLElement): DOMRect {
      const index: number = Number(this.dataset.gameIndex ?? 0);
      const left: number = index * 120;
      return {
        bottom: 80,
        height: 80,
        left,
        right: left + 100,
        toJSON: (): Record<string, number> => ({
          height: 80,
          left,
          top: 0,
          width: 100,
        }),
        top: 0,
        width: 100,
        x: left,
        y: 0,
      };
    },
  );
};

const mountSection = (
  dialog?: HTMLDialogElement,
): NewGamesSectionController => {
  if (dialog !== undefined) {
    dialog.className = 'game-details-dialog';
    document.body.append(dialog);
  }

  const controller: NewGamesSectionController = createNewGamesSection();
  controllers.push(controller);
  document.body.append(controller.element);
  return controller;
};

const dispatchPointerEvent = (
  target: Element,
  type: string,
  options: PointerEventOptions,
): PointerEvent => {
  const event: MouseEvent = new MouseEvent(type, {
    bubbles: true,
    button: options.button ?? 0,
    cancelable: true,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
  });
  Object.defineProperties(event, {
    isPrimary: { value: options.isPrimary ?? true },
    pointerId: { value: options.pointerId },
  });
  target.dispatchEvent(event);

  return event as PointerEvent;
};

const setDocumentVisibility = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  vi.useFakeTimers();
  animationRecords.length = 0;
  capturedPointers.clear();
  gameDetailsRequests.length = 0;
  mediaQueries.clear();
  snackbarRequests.length = 0;
  installBrowserApiShims();
  setDocumentVisibility('visible');

  const eventController = new AbortController();
  eventControllers.push(eventController);

  document.addEventListener(
    GAME_DETAILS_OPEN_EVENT,
    (event: Event): void => {
      if (
        event instanceof CustomEvent &&
        isGameDetailsRequestDetail(event.detail)
      ) {
        gameDetailsRequests.push(event.detail);
      }
    },
    { signal: eventController.signal },
  );
  document.addEventListener(
    SNACKBAR_SHOW_EVENT,
    (event: Event): void => {
      if (
        event instanceof CustomEvent &&
        isSnackbarRequestDetail(event.detail)
      ) {
        snackbarRequests.push(event.detail);
      }
    },
    { signal: eventController.signal },
  );
});

afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.destroy();
  }
  for (const controller of eventControllers.splice(0)) {
    controller.abort();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations');
  Reflect.deleteProperty(HTMLElement.prototype, 'hasPointerCapture');
  Reflect.deleteProperty(HTMLElement.prototype, 'releasePointerCapture');
  Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
});

describe('createNewGamesSection', () => {
  it('renders loading and then a complete accessible carousel with safe fallbacks', async () => {
    const request = createDeferred<GamesResponse>();
    fetchFeaturedGamesMock.mockReturnValue(request.promise);

    const controller: NewGamesSectionController = mountSection();
    const previousButton = getRequiredElement<HTMLButtonElement>(
      controller.element,
      '[data-carousel-direction="previous"]',
    );
    const nextButton = getRequiredElement<HTMLButtonElement>(
      controller.element,
      '[data-carousel-direction="next"]',
    );

    expect(controller.element.getAttribute('aria-labelledby')).toBe(
      'new-games-title',
    );
    expect(
      controller.element.querySelector('[data-async-state="loading"]'),
    ).not.toBeNull();
    expect(
      controller.element.querySelectorAll('.async-state__skeleton-item'),
    ).toHaveLength(5);
    expect(previousButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(true);
    expect(fetchFeaturedGamesMock).toHaveBeenCalledOnce();
    expect(fetchFeaturedGamesMock.mock.calls[0]?.[0]?.signal).toBeInstanceOf(
      AbortSignal,
    );

    request.resolve(createGamesResponse());
    await flushAsyncWork();

    const cards: readonly HTMLButtonElement[] = getCards(controller.element);
    const status = getRequiredElement<HTMLParagraphElement>(
      controller.element,
      '.new-games__status',
    );
    expect(
      getRequiredElement<HTMLElement>(
        controller.element,
        '.new-games__track',
      ).getAttribute('aria-label'),
    ).toBe('New games preview');
    expect(cards).toHaveLength(5);
    expect(previousButton.disabled).toBe(false);
    expect(nextButton.disabled).toBe(false);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('gamma');
    expect(status.textContent).toBe('Slide 3 of 5: Gamma');
    expect(status.getAttribute('aria-live')).toBe('off');
    expect(
      cards.map((card: HTMLButtonElement): string | null =>
        card.getAttribute('aria-hidden'),
      ),
    ).toEqual(['true', 'false', 'false', 'false', 'true']);
    expect(
      cards.map((card: HTMLButtonElement): number => card.tabIndex),
    ).toEqual([-1, -1, 0, -1, -1]);

    const alphaCard: HTMLButtonElement = cards[0] as HTMLButtonElement;
    expect(alphaCard.getAttribute('aria-label')).toBe('Open details for Alpha');
    expect(alphaCard.querySelector('.game-card__title')?.textContent).toBe(
      'Alpha',
    );
    expect(
      alphaCard.querySelector('[aria-label="Rated 4.9 out of 5"]'),
    ).not.toBeNull();
    expect(alphaCard.querySelector('[aria-label="1.5K likes"]')).not.toBeNull();
    expect(alphaCard.querySelector('img')?.getAttribute('draggable')).toBe(
      'false',
    );

    const fallbackCard: HTMLButtonElement = cards[4] as HTMLButtonElement;
    expect(fallbackCard.getAttribute('aria-label')).toBe(
      'Open details for Untitled game',
    );
    expect(fallbackCard.querySelector('.game-card__title')?.textContent).toBe(
      'Untitled game',
    );
    expect(
      fallbackCard.querySelector('[aria-label="Rated Not rated out of 5"]'),
    ).not.toBeNull();
    expect(fallbackCard.querySelector('[aria-label="0 likes"]')).not.toBeNull();
  });

  it('moves in both directions, wraps, announces changes, and animates cards', async () => {
    fetchFeaturedGamesMock.mockResolvedValue(createGamesResponse());
    const controller: NewGamesSectionController = mountSection();
    await flushAsyncWork();

    const nextIcon = getRequiredElement<HTMLElement>(
      controller.element,
      '[data-carousel-direction="next"] .material-symbols-rounded',
    );
    const previousButton = getRequiredElement<HTMLButtonElement>(
      controller.element,
      '[data-carousel-direction="previous"]',
    );
    const controls = getRequiredElement<HTMLElement>(
      controller.element,
      '.new-games__controls',
    );
    const status = getRequiredElement<HTMLParagraphElement>(
      controller.element,
      '.new-games__status',
    );

    controls.click();
    const textTarget: Text = document.createTextNode('not a control');
    controls.append(textTarget);
    textTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('gamma');

    nextIcon.click();
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('delta');
    expect(status.textContent).toBe('Slide 4 of 5: Delta');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(animationRecords.length).toBeGreaterThan(1);
    expect(document.body.querySelector('.game-card--outgoing')).not.toBeNull();

    const outgoingAnimation: TestAnimation | undefined = animationRecords.find(
      (record: AnimationRecord): boolean =>
        record.element.classList.contains('game-card--outgoing'),
    )?.animation;
    outgoingAnimation?.finish();
    expect(document.body.querySelector('.game-card--outgoing')).toBeNull();

    nextIcon.click();
    nextIcon.click();
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('alpha');
    previousButton.click();
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('untitled');
  });

  it('supports keyboard navigation and keeps focus on the newly active card', async () => {
    fetchFeaturedGamesMock.mockResolvedValue(createGamesResponse());
    const controller: NewGamesSectionController = mountSection();
    await flushAsyncWork();

    const track = getRequiredElement<HTMLDivElement>(
      controller.element,
      '.new-games__track',
    );
    const ignoredEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Home',
    });
    track.dispatchEvent(ignoredEvent);
    expect(ignoredEvent.defaultPrevented).toBe(false);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('gamma');

    const leftEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowLeft',
    });
    track.dispatchEvent(leftEvent);

    const betaCard: HTMLButtonElement = getActiveCard(controller.element);
    expect(leftEvent.defaultPrevented).toBe(true);
    expect(betaCard.dataset.gameSlug).toBe('beta');
    expect(document.activeElement).toBe(betaCard);

    const rightEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowRight',
    });
    betaCard.dispatchEvent(rightEvent);
    expect(rightEvent.defaultPrevented).toBe(true);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('gamma');
    expect(document.activeElement).toBe(getActiveCard(controller.element));
  });

  it('updates the accessible card window when the desktop breakpoint changes', async () => {
    fetchFeaturedGamesMock.mockResolvedValue(createGamesResponse());
    const controller: NewGamesSectionController = mountSection();
    await flushAsyncWork();

    const cards: readonly HTMLButtonElement[] = getCards(controller.element);
    getMediaQuery(DESKTOP_MEDIA_QUERY).setMatches(true);
    expect(
      cards.every(
        (card: HTMLButtonElement): boolean =>
          card.getAttribute('aria-hidden') === 'false',
      ),
    ).toBe(true);

    getMediaQuery(DESKTOP_MEDIA_QUERY).setMatches(false);
    expect(cards[0]?.getAttribute('aria-hidden')).toBe('true');
    expect(cards[2]?.getAttribute('aria-hidden')).toBe('false');
    expect(cards[4]?.getAttribute('aria-hidden')).toBe('true');
  });

  it('dispatches card requests and pauses autoplay while a details dialog is active', async () => {
    fetchFeaturedGamesMock.mockResolvedValue(createGamesResponse());
    const dialog: HTMLDialogElement = document.createElement('dialog');
    const controller: NewGamesSectionController = mountSection(dialog);
    await flushAsyncWork();

    const track = getRequiredElement<HTMLDivElement>(
      controller.element,
      '.new-games__track',
    );
    track.click();
    const textTarget: Text = document.createTextNode('not a card');
    track.append(textTarget);
    textTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(gameDetailsRequests).toHaveLength(0);

    vi.advanceTimersByTime(1000);
    const activeCard: HTMLButtonElement = getActiveCard(controller.element);
    const activeTitle = getRequiredElement<HTMLElement>(
      activeCard,
      '.game-card__title',
    );
    activeTitle.click();

    expect(gameDetailsRequests).toEqual([{ slug: 'gamma' }]);
    dialog.setAttribute('open', '');
    vi.advanceTimersByTime(10_000);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('gamma');

    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
    vi.advanceTimersByTime(2999);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('gamma');
    vi.advanceTimersByTime(1);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('delta');

    activeCard.dataset.gameSlug = '';
    activeCard.click();
    expect(gameDetailsRequests).toHaveLength(1);
  });

  it('preserves the autoplay remainder across hover, focus, and visibility pauses', async () => {
    fetchFeaturedGamesMock.mockResolvedValue(createGamesResponse());
    const controller: NewGamesSectionController = mountSection();
    await flushAsyncWork();

    const track = getRequiredElement<HTMLDivElement>(
      controller.element,
      '.new-games__track',
    );
    vi.advanceTimersByTime(1000);
    track.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(5000);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('gamma');

    track.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(2999);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('gamma');
    vi.advanceTimersByTime(1);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('delta');

    controller.element.dispatchEvent(
      new FocusEvent('focusin', { bubbles: true }),
    );
    controller.element.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: getActiveCard(controller.element),
      }),
    );
    vi.advanceTimersByTime(5000);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('delta');

    controller.element.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: document.body,
      }),
    );
    vi.advanceTimersByTime(3999);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('delta');
    vi.advanceTimersByTime(1);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('untitled');

    vi.advanceTimersByTime(500);
    setDocumentVisibility('hidden');
    vi.advanceTimersByTime(5000);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('untitled');
    setDocumentVisibility('visible');
    vi.advanceTimersByTime(3499);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('untitled');
    vi.advanceTimersByTime(1);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('alpha');
  });

  it('turns a horizontal pointer swipe into one move and suppresses its synthetic click', async () => {
    fetchFeaturedGamesMock.mockResolvedValue(createGamesResponse());
    const controller: NewGamesSectionController = mountSection();
    await flushAsyncWork();

    const track = getRequiredElement<HTMLDivElement>(
      controller.element,
      '.new-games__track',
    );
    const pressedCard: HTMLButtonElement = getActiveCard(controller.element);
    dispatchPointerEvent(pressedCard, 'pointerdown', {
      clientX: 100,
      clientY: 20,
      pointerId: 7,
    });
    expect(track.classList.contains('new-games__track--dragging')).toBe(true);
    expect(pressedCard.hasPointerCapture(7)).toBe(true);

    dispatchPointerEvent(track, 'pointermove', {
      clientX: 35,
      clientY: 24,
      pointerId: 7,
    });
    expect(track.style.getPropertyValue('--carousel-drag-offset')).toBe(
      '-65px',
    );
    dispatchPointerEvent(track, 'pointerup', {
      clientX: 35,
      clientY: 24,
      pointerId: 7,
    });

    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('delta');
    expect(track.classList.contains('new-games__track--dragging')).toBe(false);
    expect(track.style.getPropertyValue('--carousel-drag-offset')).toBe('');
    expect(pressedCard.hasPointerCapture(7)).toBe(false);
    expect(track.dataset.suppressCardClick).toBe('true');

    const suppressedClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    pressedCard.dispatchEvent(suppressedClick);
    expect(suppressedClick.defaultPrevented).toBe(true);
    expect(gameDetailsRequests).toHaveLength(0);
    expect(track.dataset.suppressCardClick).toBeUndefined();

    pressedCard.click();
    expect(gameDetailsRequests).toEqual([{ slug: 'gamma' }]);
  });

  it('cancels invalid pointer gestures and suppresses drag or long-press clicks without moving', async () => {
    fetchFeaturedGamesMock.mockResolvedValue(createGamesResponse());
    const controller: NewGamesSectionController = mountSection();
    await flushAsyncWork();

    const track = getRequiredElement<HTMLDivElement>(
      controller.element,
      '.new-games__track',
    );
    const card: HTMLButtonElement = getActiveCard(controller.element);
    dispatchPointerEvent(card, 'pointerdown', {
      button: 2,
      pointerId: 1,
    });
    dispatchPointerEvent(card, 'pointerdown', {
      isPrimary: false,
      pointerId: 2,
    });
    expect(track.classList.contains('new-games__track--dragging')).toBe(false);

    dispatchPointerEvent(card, 'pointerdown', {
      clientX: 10,
      pointerId: 3,
    });
    dispatchPointerEvent(track, 'pointerdown', {
      clientX: 20,
      pointerId: 4,
    });
    dispatchPointerEvent(track, 'pointermove', {
      clientX: 100,
      pointerId: 4,
    });
    dispatchPointerEvent(track, 'pointerup', {
      clientX: 100,
      pointerId: 4,
    });
    expect(track.classList.contains('new-games__track--dragging')).toBe(true);
    dispatchPointerEvent(track, 'pointercancel', { pointerId: 4 });
    expect(track.style.getPropertyValue('--carousel-drag-offset')).toBe('');
    dispatchPointerEvent(track, 'pointercancel', { pointerId: 3 });
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('gamma');
    expect(card.hasPointerCapture(3)).toBe(false);

    dispatchPointerEvent(card, 'pointerdown', {
      clientX: 10,
      pointerId: 5,
    });
    dispatchPointerEvent(track, 'pointermove', {
      clientX: 20,
      clientY: 1,
      pointerId: 5,
    });
    dispatchPointerEvent(track, 'pointerup', {
      clientX: 20,
      clientY: 1,
      pointerId: 5,
    });
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('gamma');
    expect(track.dataset.suppressCardClick).toBe('true');
    vi.advanceTimersByTime(500);
    expect(track.dataset.suppressCardClick).toBeUndefined();

    dispatchPointerEvent(card, 'pointerdown', {
      clientX: 20,
      pointerId: 6,
    });
    vi.advanceTimersByTime(500);
    dispatchPointerEvent(track, 'pointerup', {
      clientX: 20,
      pointerId: 6,
    });
    expect(track.dataset.suppressCardClick).toBe('true');

    dispatchPointerEvent(card, 'pointerdown', { pointerId: 8 });
    dispatchPointerEvent(track, 'lostpointercapture', { pointerId: 9 });
    expect(track.classList.contains('new-games__track--dragging')).toBe(true);
    dispatchPointerEvent(track, 'lostpointercapture', { pointerId: 8 });
    expect(track.classList.contains('new-games__track--dragging')).toBe(false);

    dispatchPointerEvent(card, 'pointerdown', { pointerId: 10 });
    globalThis.dispatchEvent(new Event('blur'));
    expect(track.classList.contains('new-games__track--dragging')).toBe(false);
    expect(card.hasPointerCapture(10)).toBe(false);
    globalThis.dispatchEvent(new Event('blur'));
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('gamma');
  });

  it('renders the empty state and keeps a one-game carousel stationary', async () => {
    fetchFeaturedGamesMock.mockResolvedValueOnce(createGamesResponse([]));
    const emptyController: NewGamesSectionController = mountSection();
    await flushAsyncWork();

    expect(
      emptyController.element.querySelector('[data-async-state="empty"]')
        ?.textContent,
    ).toContain('No new games yet');
    expect(
      getRequiredElement<HTMLButtonElement>(
        emptyController.element,
        '[data-carousel-direction="next"]',
      ).disabled,
    ).toBe(true);

    fetchFeaturedGamesMock.mockResolvedValueOnce(
      createGamesResponse([GAMES[0] as GameSummary]),
    );
    const singleController: NewGamesSectionController = mountSection();
    await flushAsyncWork();
    const nextButton = getRequiredElement<HTMLButtonElement>(
      singleController.element,
      '[data-carousel-direction="next"]',
    );
    expect(nextButton.disabled).toBe(true);
    nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(20_000);
    expect(getActiveCard(singleController.element).dataset.gameSlug).toBe(
      'alpha',
    );
  });

  it('shows an error and snackbar, then replaces them after a successful retry', async () => {
    fetchFeaturedGamesMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(createGamesResponse());
    const controller: NewGamesSectionController = mountSection();
    await flushAsyncWork();

    const errorState = getRequiredElement<HTMLElement>(
      controller.element,
      '[data-async-state="error"]',
    );
    expect(errorState.textContent).toContain("We couldn't load the new games");
    expect(errorState.textContent).toContain(
      'Check your connection, then try loading the games again.',
    );
    expect(snackbarRequests).toEqual([
      {
        message: 'New games could not be loaded. Please try again.',
        variant: 'error',
      },
    ]);

    getRequiredElement<HTMLButtonElement>(errorState, 'button').click();
    expect(
      controller.element.querySelector('[data-async-state="loading"]'),
    ).not.toBeNull();
    await flushAsyncWork();
    expect(getCards(controller.element)).toHaveLength(GAMES.length);
    expect(fetchFeaturedGamesMock).toHaveBeenCalledTimes(2);
  });

  it('silently leaves the loading state in place for an aborted API request', async () => {
    fetchFeaturedGamesMock.mockRejectedValue(
      new ApiAbortError('/api/games?featured=true', new DOMException()),
    );
    const controller: NewGamesSectionController = mountSection();
    await flushAsyncWork();

    expect(
      controller.element.querySelector('[data-async-state="loading"]'),
    ).not.toBeNull();
    expect(
      controller.element.querySelector('[data-async-state="error"]'),
    ).toBeNull();
    expect(snackbarRequests).toHaveLength(0);
  });

  it('aborts and ignores an earlier retry when retry is requested twice', async () => {
    const staleRequest = createDeferred<GamesResponse>();
    const currentRequest = createDeferred<GamesResponse>();
    fetchFeaturedGamesMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(staleRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);
    const controller: NewGamesSectionController = mountSection();
    await flushAsyncWork();

    const retryButton = getRequiredElement<HTMLButtonElement>(
      controller.element,
      '[data-async-state="error"] button',
    );
    retryButton.click();
    retryButton.click();
    const staleSignal: AbortSignal | undefined =
      fetchFeaturedGamesMock.mock.calls[1]?.[0]?.signal;
    expect(staleSignal?.aborted).toBe(true);
    expect(fetchFeaturedGamesMock).toHaveBeenCalledTimes(3);

    staleRequest.resolve(createGamesResponse([GAMES[0] as GameSummary]));
    await flushAsyncWork();
    expect(
      controller.element.querySelector('[data-async-state="loading"]'),
    ).not.toBeNull();

    currentRequest.resolve(createGamesResponse(GAMES.slice(0, 2)));
    await flushAsyncWork();
    expect(getCards(controller.element)).toHaveLength(2);
    expect(getActiveCard(controller.element).dataset.gameSlug).toBe('beta');
  });

  it('uses reduced motion and destroys pending work and active interactions cleanly', async () => {
    getMediaQuery(REDUCED_MOTION_MEDIA_QUERY).setMatches(true);
    fetchFeaturedGamesMock.mockResolvedValueOnce(createGamesResponse());
    const loadedController: NewGamesSectionController = mountSection();
    await flushAsyncWork();

    const loadedTrack = getRequiredElement<HTMLDivElement>(
      loadedController.element,
      '.new-games__track',
    );
    const loadedCard: HTMLButtonElement = getActiveCard(
      loadedController.element,
    );
    getRequiredElement<HTMLButtonElement>(
      loadedController.element,
      '[data-carousel-direction="next"]',
    ).click();
    expect(animationRecords).toHaveLength(0);

    dispatchPointerEvent(loadedCard, 'pointerdown', { pointerId: 25 });
    expect(loadedCard.hasPointerCapture(25)).toBe(true);
    const slugBeforeDestroy: string | undefined = getActiveCard(
      loadedController.element,
    ).dataset.gameSlug;
    loadedController.destroy();
    expect(loadedTrack.classList.contains('new-games__track--dragging')).toBe(
      false,
    );
    expect(loadedCard.hasPointerCapture(25)).toBe(false);
    vi.advanceTimersByTime(20_000);
    loadedTrack.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'ArrowRight',
      }),
    );
    expect(getActiveCard(loadedController.element).dataset.gameSlug).toBe(
      slugBeforeDestroy,
    );

    const pendingRequest = createDeferred<GamesResponse>();
    fetchFeaturedGamesMock.mockReturnValueOnce(pendingRequest.promise);
    const pendingController: NewGamesSectionController = mountSection();
    const pendingSignal: AbortSignal | undefined =
      fetchFeaturedGamesMock.mock.calls.at(-1)?.[0]?.signal;
    pendingController.destroy();
    expect(pendingSignal?.aborted).toBe(true);
    pendingRequest.resolve(createGamesResponse());
    await flushAsyncWork();
    expect(getCards(pendingController.element)).toHaveLength(0);
    expect(
      pendingController.element.querySelector('[data-async-state="loading"]'),
    ).not.toBeNull();
  });
});
