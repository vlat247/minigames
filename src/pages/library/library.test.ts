import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import type { RouteContext, RouteView } from '../../app/router';
import {
  DEFAULT_LIBRARY_CATEGORY,
  DEFAULT_LIBRARY_PAGE,
  DEFAULT_LIBRARY_SORT,
  type GameSort,
  type LibraryCategory,
} from '../../app/url-state';
import {
  GAME_DETAILS_OPEN_EVENT,
  isGameDetailsRequestDetail,
  type GameDetailsRequestDetail,
} from '../../components/dialogs/game-details-events';
import {
  SNACKBAR_SHOW_EVENT,
  isSnackbarRequestDetail,
} from '../../components/snackbar/snackbar-events';
import type { SnackbarOptions } from '../../components/snackbar/snackbar';
import { ApiAbortError } from '../../services/api-client';
import {
  fetchCategories,
  fetchLibraryGames,
} from '../../services/minigames-api';
import type {
  CategoriesResponse,
  GameCategory,
  GamesResponse,
  GameSummary,
} from '../../types/api';
import { libraryPage } from './library';

vi.mock('../../services/minigames-api', () => ({
  fetchCategories: vi.fn(),
  fetchLibraryGames: vi.fn(),
}));

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: Value | PromiseLike<Value>) => void;
}

interface PromiseWithResolversConstructor extends PromiseConstructor {
  readonly withResolvers: <Value>() => Deferred<Value>;
}

interface ContextOptions {
  readonly category?: LibraryCategory;
  readonly navigationType?: RouteContext['navigationType'];
  readonly page?: number;
  readonly sort?: GameSort;
  readonly sourceUrl?: string;
}

interface LibraryFixture {
  readonly context: RouteContext;
  readonly navigate: Mock<RouteContext['navigate']>;
  readonly root: HTMLElement;
  readonly view: RouteView;
}

const DEFAULT_CATEGORIES: readonly GameCategory[] = [
  { isDefault: true, label: 'All Games', slug: 'all' },
  { isDefault: false, label: 'Puzzle', slug: 'puzzle' },
  { isDefault: false, label: 'Arcade', slug: 'arcade' },
];

const DEFAULT_GAME: GameSummary = {
  cardImage: '/assets/images/games/tiny-gardens.webp',
  category: 'puzzle',
  likesCount: 1200,
  name: 'Tiny Gardens',
  price: 'Free',
  rating: 4.8,
  shortDescription: 'Arrange a peaceful pocket garden.',
  slug: 'tiny-gardens',
};

const activeViews: RouteView[] = [];
const eventControllers: AbortController[] = [];
const fetchCategoriesMock = vi.mocked(fetchCategories);
const fetchLibraryGamesMock = vi.mocked(fetchLibraryGames);

const createDeferred = <Value>(): Deferred<Value> => {
  const promiseConstructor = Promise as PromiseWithResolversConstructor;
  return promiseConstructor.withResolvers<Value>();
};

const createCategoriesResponse = (
  categories: readonly GameCategory[] = DEFAULT_CATEGORIES,
): CategoriesResponse => ({
  data: categories,
  meta: {
    description: 'Available game categories',
    totalItems: categories.length,
  },
});

const createGamesResponse = (
  games: readonly GameSummary[] = [DEFAULT_GAME],
  options: {
    readonly category?: string;
    readonly page?: number;
    readonly sort?: GameSort;
    readonly totalPages?: number;
  } = {},
): GamesResponse => ({
  data: games,
  meta: {
    appliedFilter: {
      category: options.category ?? DEFAULT_LIBRARY_CATEGORY,
      sort: options.sort ?? DEFAULT_LIBRARY_SORT,
    },
    limit: 6,
    page: options.page ?? DEFAULT_LIBRARY_PAGE,
    totalItems: games.length,
    totalPages: options.totalPages ?? 1,
  },
});

const createRouteContext = (
  options: ContextOptions = {},
  navigate: Mock<RouteContext['navigate']> = vi.fn<RouteContext['navigate']>(),
): RouteContext => {
  const category: LibraryCategory =
    options.category ?? DEFAULT_LIBRARY_CATEGORY;
  const page: number = options.page ?? DEFAULT_LIBRARY_PAGE;
  const sort: GameSort = options.sort ?? DEFAULT_LIBRARY_SORT;
  const url = new URL(
    options.sourceUrl ??
      `http://localhost/library?category=${category}&sort=${sort}&page=${page}`,
  );

  return {
    historyState: {},
    isFallback: false,
    navigate,
    navigationType: options.navigationType ?? 'initial',
    path: '/library',
    routePath: '/library',
    sourceUrl: new URL(url),
    state: {
      auth: undefined,
      category,
      game: undefined,
      page,
      sort,
    },
    url,
  };
};

const createFixture = (options: ContextOptions = {}): LibraryFixture => {
  const navigate = vi.fn<RouteContext['navigate']>();
  const context = createRouteContext(options, navigate);
  const view = libraryPage(context);

  if (!(view.content instanceof HTMLElement)) {
    throw new TypeError('Expected the library view to contain an element.');
  }

  const root = view.content;
  activeViews.push(view);
  document.body.append(root);
  return { context, navigate, root, view };
};

const getRequiredElement = <ElementType extends Element>(
  root: ParentNode,
  selector: string,
): ElementType => {
  const element = root.querySelector<ElementType>(selector);
  if (element === null) {
    throw new Error(`Expected an element matching "${selector}".`);
  }

  return element;
};

const getNavigationUrl = (navigate: Mock<RouteContext['navigate']>): URL => {
  const destination: string | URL | undefined = navigate.mock.lastCall?.[0];
  if (destination === undefined) {
    throw new Error('Expected navigation to have a destination.');
  }

  return destination instanceof URL
    ? destination
    : new URL(destination, 'http://localhost');
};

const pressKey = (element: Element, key: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
  });
  element.dispatchEvent(event);
  return event;
};

const listenForGameDetails = (): readonly GameDetailsRequestDetail[] => {
  const requests: GameDetailsRequestDetail[] = [];
  const controller = new AbortController();
  eventControllers.push(controller);
  document.addEventListener(
    GAME_DETAILS_OPEN_EVENT,
    (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (isGameDetailsRequestDetail(detail)) {
        requests.push(detail);
      }
    },
    { signal: controller.signal },
  );
  return requests;
};

const listenForSnackbars = (): readonly SnackbarOptions[] => {
  const messages: SnackbarOptions[] = [];
  const controller = new AbortController();
  eventControllers.push(controller);
  document.addEventListener(
    SNACKBAR_SHOW_EVENT,
    (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (isSnackbarRequestDetail(detail)) {
        messages.push(detail);
      }
    },
    { signal: controller.signal },
  );
  return messages;
};

const waitForGameCards = async (
  root: HTMLElement,
  expectedCount: number = 1,
): Promise<void> => {
  await vi.waitFor(() => {
    expect(root.querySelectorAll('.library-card')).toHaveLength(expectedCount);
  });
};

const waitForCategoryChips = async (
  root: HTMLElement,
  expectedCount: number = DEFAULT_CATEGORIES.length,
): Promise<void> => {
  await vi.waitFor(() => {
    expect(root.querySelectorAll('[data-category]')).toHaveLength(
      expectedCount,
    );
  });
};

beforeEach(() => {
  fetchCategoriesMock.mockReset();
  fetchLibraryGamesMock.mockReset();
  fetchCategoriesMock.mockResolvedValue(createCategoriesResponse());
  fetchLibraryGamesMock.mockResolvedValue(createGamesResponse());
});

afterEach(() => {
  for (const view of activeViews.splice(0)) {
    view.dispose?.();
  }
  for (const controller of eventControllers.splice(0)) {
    controller.abort();
  }
});

describe('libraryPage', () => {
  it('renders accessible loading states and requests the exact URL-backed query', async () => {
    const categoriesRequest = createDeferred<CategoriesResponse>();
    const gamesRequest = createDeferred<GamesResponse>();
    fetchCategoriesMock.mockReturnValue(categoriesRequest.promise);
    fetchLibraryGamesMock.mockReturnValue(gamesRequest.promise);

    const { root } = createFixture({
      category: 'farm',
      page: 3,
      sort: 'name-desc',
    });

    expect(root.getAttribute('aria-labelledby')).toBe('library-title');
    expect(root.querySelector('h1')?.textContent).toBe('Game Library');
    expect(
      getRequiredElement(root, '.library__games').getAttribute('aria-label'),
    ).toBe('Available games');
    expect(fetchLibraryGamesMock).toHaveBeenCalledWith(
      { category: 'farm', limit: 6, page: 3, sort: 'name-desc' },
      { signal: expect.any(AbortSignal) },
    );
    expect(fetchCategoriesMock).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
    });

    const gamesRegion = getRequiredElement<HTMLElement>(
      root,
      '.library__games',
    );
    expect(gamesRegion.getAttribute('aria-busy')).toBe('true');
    expect(
      gamesRegion.querySelectorAll('.async-state__skeleton-item--card'),
    ).toHaveLength(6);
    expect(
      root.querySelectorAll(
        ':scope .library__filter-content .async-state__skeleton-item--row',
      ),
    ).toHaveLength(1);
    expect(
      getRequiredElement(root, '.library-pagination').getAttribute('aria-busy'),
    ).toBe('true');
    for (const button of root.querySelectorAll<HTMLButtonElement>(
      ':scope .library-pagination button',
    )) {
      expect(button.disabled).toBe(true);
    }

    categoriesRequest.resolve(createCategoriesResponse());
    gamesRequest.resolve(
      createGamesResponse([DEFAULT_GAME], {
        category: 'farm',
        page: 3,
        sort: 'name-desc',
        totalPages: 5,
      }),
    );
    await waitForCategoryChips(root);
    await waitForGameCards(root);
  });

  it('normalizes supported categories, removes duplicates, and applies the API default', async () => {
    fetchCategoriesMock.mockResolvedValue(
      createCategoriesResponse([
        { isDefault: true, label: ' '.repeat(3), slug: 'arcade' },
        { isDefault: false, label: 'Duplicate Arcade', slug: 'arcade' },
        { isDefault: false, label: '  Puzzle Games  ', slug: 'puzzle' },
        { isDefault: true, label: 'Unknown', slug: 'unknown-api-category' },
      ]),
    );

    const { navigate, root } = createFixture({
      category: 'all',
      page: 4,
      sourceUrl:
        'http://localhost/library?category=unsupported&sort=rating-desc&page=4',
    });

    await waitForCategoryChips(root, 2);
    const chips = [
      ...root.querySelectorAll<HTMLButtonElement>('[data-category]'),
    ];
    expect(
      chips.map((chip: HTMLButtonElement) => ({
        label: chip.textContent,
        slug: chip.dataset.category,
      })),
    ).toEqual([
      { label: 'arcade', slug: 'arcade' },
      { label: 'Puzzle Games', slug: 'puzzle' },
    ]);
    expect(chips[0]?.ariaPressed).toBe('true');
    expect(chips[1]?.ariaPressed).toBe('false');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(getNavigationUrl(navigate).searchParams.get('category')).toBe(
      'arcade',
    );
    expect(getNavigationUrl(navigate).searchParams.get('page')).toBe('1');
    expect(navigate.mock.lastCall?.[1]).toEqual({ replace: true });
  });

  it('preserves a valid explicit category and falls back when the API omits it', async () => {
    fetchCategoriesMock.mockResolvedValue(
      createCategoriesResponse([
        { isDefault: true, label: 'All', slug: 'all' },
        { isDefault: false, label: 'Puzzle', slug: 'puzzle' },
      ]),
    );

    const explicit = createFixture({ category: 'puzzle' });
    await waitForCategoryChips(explicit.root, 2);
    expect(explicit.navigate).not.toHaveBeenCalled();
    expect(
      getRequiredElement<HTMLButtonElement>(
        explicit.root,
        '[data-category="puzzle"]',
      ).ariaPressed,
    ).toBe('true');

    const missing = createFixture({ category: 'strategy' });
    await waitForCategoryChips(missing.root, 2);
    expect(missing.navigate).toHaveBeenCalledTimes(1);
    expect(
      getNavigationUrl(missing.navigate).searchParams.get('category'),
    ).toBe('all');
    expect(missing.navigate.mock.lastCall?.[1]).toEqual({ replace: true });
  });

  it('renders game cards with safe content, formatted stats, and defensive fallbacks', async () => {
    const fallbackGame: GameSummary = {
      cardImage: '/assets/images/games/mystery.webp',
      category: ' '.repeat(3),
      likesCount: NaN,
      name: ' '.repeat(3),
      price: ' FREE ',
      rating: NaN,
      shortDescription: '<strong>Not HTML</strong>',
      slug: '',
    };
    fetchLibraryGamesMock.mockResolvedValue(
      createGamesResponse([DEFAULT_GAME, fallbackGame]),
    );
    const detailsRequests = listenForGameDetails();
    const { root } = createFixture();

    await waitForGameCards(root, 2);
    const cards = [...root.querySelectorAll<HTMLElement>('.library-card')];
    const firstCard = cards[0];
    const fallbackCard = cards[1];
    if (firstCard === undefined || fallbackCard === undefined) {
      throw new Error('Expected both game cards to be rendered.');
    }

    expect(firstCard.querySelector('.library-card__title')?.textContent).toBe(
      'Tiny Gardens',
    );
    expect(
      firstCard.querySelector('.library-card__category')?.textContent,
    ).toBe('Puzzle');
    expect(
      firstCard.querySelector('[aria-label="Rated 4.8 out of 5"]')?.textContent,
    ).toContain('4.8');
    expect(firstCard.querySelector('[aria-label="1.2K likes"]')).not.toBeNull();
    expect(
      firstCard.querySelectorAll('.library-card__price--free'),
    ).toHaveLength(2);
    expect(
      getRequiredElement<HTMLImageElement>(firstCard, '.library-card__image')
        .alt,
    ).toBe('Tiny Gardens game artwork');

    expect(
      fallbackCard.querySelector('.library-card__title')?.textContent,
    ).toBe('Untitled game');
    expect(
      fallbackCard.querySelector('.library-card__category')?.textContent,
    ).toBe('Other');
    expect(
      fallbackCard.querySelector('[aria-label="Rated Not rated out of 5"]'),
    ).not.toBeNull();
    expect(fallbackCard.querySelector('[aria-label="0 likes"]')).not.toBeNull();
    expect(
      fallbackCard.querySelector('.library-card__description')?.textContent,
    ).toBe('<strong>Not HTML</strong>');
    expect(
      fallbackCard.querySelector(':scope .library-card__description strong'),
    ).toBe(null);
    expect(
      getRequiredElement<HTMLButtonElement>(
        fallbackCard,
        '.library-card__details',
      ).getAttribute('aria-label'),
    ).toBe('View details for Untitled game');

    getRequiredElement<HTMLButtonElement>(
      firstCard,
      '.library-card__details',
    ).click();
    getRequiredElement<HTMLButtonElement>(
      fallbackCard,
      '.library-card__details',
    ).click();
    expect(detailsRequests).toEqual([{ slug: 'tiny-gardens' }]);
  });

  it('navigates from category chips, resets the page, and reflects route updates', async () => {
    fetchLibraryGamesMock.mockImplementation(async (query) =>
      createGamesResponse([DEFAULT_GAME], {
        category: query.category,
        page: query.page,
        sort: query.sort,
        totalPages: 5,
      }),
    );
    const { context, navigate, root, view } = createFixture({ page: 4 });
    await waitForCategoryChips(root);
    await waitForGameCards(root);

    getRequiredElement<HTMLButtonElement>(
      root,
      '[data-category="all"]',
    ).click();
    expect(navigate).not.toHaveBeenCalled();

    getRequiredElement<HTMLButtonElement>(
      root,
      '[data-category="puzzle"]',
    ).click();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(getNavigationUrl(navigate).searchParams.get('category')).toBe(
      'puzzle',
    );
    expect(getNavigationUrl(navigate).searchParams.get('page')).toBe('1');

    const nextContext = createRouteContext(
      {
        category: 'puzzle',
        navigationType: 'push',
        page: 1,
        sort: context.state.sort,
      },
      navigate,
    );
    view.update?.(nextContext);
    await vi.waitFor(() => {
      expect(fetchLibraryGamesMock).toHaveBeenCalledTimes(2);
    });
    expect(
      getRequiredElement<HTMLButtonElement>(root, '[data-category="puzzle"]')
        .ariaPressed,
    ).toBe('true');
    expect(
      getRequiredElement<HTMLButtonElement>(root, '[data-category="all"]')
        .ariaPressed,
    ).toBe('false');

    view.update?.(nextContext);
    expect(fetchLibraryGamesMock).toHaveBeenCalledTimes(2);
  });

  it('opens the sort menu, selects with the mouse, and synchronizes its value', async () => {
    const { navigate, root, view } = createFixture({
      category: 'arcade',
      page: 4,
    });
    await waitForGameCards(root);
    const trigger = getRequiredElement<HTMLButtonElement>(
      root,
      '.library-sort__trigger',
    );
    const options = getRequiredElement<HTMLUListElement>(
      root,
      '.library-sort__options',
    );

    trigger.click();
    expect(trigger.ariaExpanded).toBe('true');
    expect(options.hidden).toBe(false);
    getRequiredElement<HTMLElement>(
      root,
      '[data-sort-value="name-asc"] .library-sort__check',
    ).click();

    expect(trigger.ariaExpanded).toBe('false');
    expect(options.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(getNavigationUrl(navigate).searchParams.get('sort')).toBe(
      'name-asc',
    );
    expect(getNavigationUrl(navigate).searchParams.get('page')).toBe('1');

    const updatedContext = createRouteContext(
      { category: 'arcade', page: 1, sort: 'name-asc' },
      navigate,
    );
    view.update?.(updatedContext);
    await vi.waitFor(() => {
      expect(fetchLibraryGamesMock).toHaveBeenCalledTimes(2);
    });
    expect(root.querySelector('[data-sort-label]')?.textContent).toBe(
      'Name A→Z',
    );
    expect(
      getRequiredElement<HTMLButtonElement>(
        root,
        '[data-sort-value="name-asc"]',
      ).ariaSelected,
    ).toBe('true');

    navigate.mockClear();
    trigger.click();
    getRequiredElement<HTMLButtonElement>(
      root,
      '[data-sort-value="name-asc"]',
    ).click();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('supports sort keyboard navigation and closes on Escape, outside click, and focus loss', async () => {
    const { root } = createFixture({ sort: 'rating-asc' });
    await waitForGameCards(root);
    const trigger = getRequiredElement<HTMLButtonElement>(
      root,
      '.library-sort__trigger',
    );
    const options = getRequiredElement<HTMLUListElement>(
      root,
      '.library-sort__options',
    );
    const selected = getRequiredElement<HTMLButtonElement>(
      root,
      '[data-sort-value="rating-asc"]',
    );

    const openEvent = pressKey(trigger, 'ArrowDown');
    expect(openEvent.defaultPrevented).toBe(true);
    expect(trigger.ariaExpanded).toBe('true');
    expect(document.activeElement).toBe(selected);

    pressKey(selected, 'ArrowDown');
    expect(document.activeElement).toBe(
      getRequiredElement(root, '[data-sort-value="name-asc"]'),
    );
    pressKey(getRequiredElement(root, '[data-sort-value="name-asc"]'), 'End');
    expect(document.activeElement).toBe(
      getRequiredElement(root, '[data-sort-value="name-desc"]'),
    );
    pressKey(getRequiredElement(root, '[data-sort-value="name-desc"]'), 'Home');
    expect(document.activeElement).toBe(
      getRequiredElement(root, '[data-sort-value="rating-desc"]'),
    );
    pressKey(
      getRequiredElement(root, '[data-sort-value="rating-desc"]'),
      'ArrowUp',
    );
    expect(document.activeElement).toBe(
      getRequiredElement(root, '[data-sort-value="name-desc"]'),
    );
    pressKey(
      getRequiredElement(root, '[data-sort-value="name-desc"]'),
      'Escape',
    );
    expect(trigger.ariaExpanded).toBe('false');
    expect(options.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    document.body.click();
    expect(trigger.ariaExpanded).toBe('false');

    trigger.click();
    trigger.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: document.body,
      }),
    );
    expect(trigger.ariaExpanded).toBe('false');

    trigger.click();
    pressKey(trigger, 'Escape');
    expect(trigger.ariaExpanded).toBe('false');
  });

  it('navigates with pagination controls and updates the active page from routing', async () => {
    fetchLibraryGamesMock.mockImplementation(async (query) =>
      createGamesResponse([DEFAULT_GAME], {
        category: query.category,
        page: query.page,
        sort: query.sort,
        totalPages: 7,
      }),
    );
    const { navigate, root, view } = createFixture({ page: 3 });
    await waitForGameCards(root);
    await vi.waitFor(() => {
      expect(
        getRequiredElement(root, '[aria-current="page"]').textContent,
      ).toBe('3');
    });

    getRequiredElement<HTMLButtonElement>(
      root,
      '[data-page-direction="next"]',
    ).click();
    expect(getNavigationUrl(navigate).searchParams.get('page')).toBe('4');

    getRequiredElement<HTMLButtonElement>(root, '[data-page="2"]').click();
    expect(getNavigationUrl(navigate).searchParams.get('page')).toBe('2');

    const nextContext = createRouteContext({ page: 4 }, navigate);
    view.update?.(nextContext);
    await vi.waitFor(() => {
      expect(
        getRequiredElement(root, '[aria-current="page"]').textContent,
      ).toBe('4');
      expect(
        getRequiredElement<HTMLElement>(
          root,
          '.library-pagination',
        ).getAttribute('aria-busy'),
      ).toBe('false');
    });
  });

  it('renders empty states when categories and first-page games are absent', async () => {
    fetchCategoriesMock.mockResolvedValue(createCategoriesResponse([]));
    fetchLibraryGamesMock.mockResolvedValue(createGamesResponse([]));
    const { navigate, root } = createFixture();

    await vi.waitFor(() => {
      expect(
        root.querySelector(
          ':scope .library__filter-content .async-state--empty',
        ),
      ).not.toBeNull();
      expect(
        root.querySelector(':scope .library__games .async-state--empty'),
      ).not.toBeNull();
    });
    expect(root.textContent).toContain('No categories found');
    expect(root.textContent).toContain('Data Not Found');
    expect(root.textContent).toContain(
      'No games are available for the selected filters and page.',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(
      getRequiredElement(root, '.library-pagination').getAttribute('aria-busy'),
    ).toBe('false');
  });

  it('renders errors, announces them, and retries both failed requests', async () => {
    fetchCategoriesMock
      .mockRejectedValueOnce(new Error('categories unavailable'))
      .mockResolvedValueOnce(createCategoriesResponse());
    fetchLibraryGamesMock
      .mockRejectedValueOnce(new Error('games unavailable'))
      .mockResolvedValueOnce(createGamesResponse());
    const snackbarMessages = listenForSnackbars();
    const { root } = createFixture();

    await vi.waitFor(() => {
      expect(root.querySelectorAll('.async-state--error')).toHaveLength(2);
      expect(snackbarMessages).toHaveLength(2);
    });
    expect(snackbarMessages).toEqual(
      expect.arrayContaining([
        {
          message:
            'The game library is unavailable right now. Please try again.',
          variant: 'error',
        },
        {
          message: 'Game categories could not be loaded. Please try again.',
          variant: 'error',
        },
      ]),
    );
    expect(
      getRequiredElement(root, '.library-pagination').getAttribute('aria-busy'),
    ).toBe('false');

    getRequiredElement<HTMLButtonElement>(
      root,
      '.library__filter-content .async-state__retry',
    ).click();
    getRequiredElement<HTMLButtonElement>(
      root,
      '.library__games .async-state__retry',
    ).click();
    await waitForCategoryChips(root);
    await waitForGameCards(root);
    expect(fetchCategoriesMock).toHaveBeenCalledTimes(2);
    expect(fetchLibraryGamesMock).toHaveBeenCalledTimes(2);
    expect(root.querySelector('.async-state--error')).toBeNull();
  });

  it('silently ignores API cancellation errors', async () => {
    fetchCategoriesMock.mockRejectedValue(
      new ApiAbortError('/api/categories', new DOMException('Cancelled')),
    );
    fetchLibraryGamesMock.mockRejectedValue(
      new ApiAbortError('/api/games', new DOMException('Cancelled')),
    );
    const snackbarMessages = listenForSnackbars();
    const { root } = createFixture();

    await vi.waitFor(() => {
      expect(fetchCategoriesMock).toHaveBeenCalledTimes(1);
      expect(fetchLibraryGamesMock).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();

    expect(root.querySelectorAll('.async-state--loading')).toHaveLength(2);
    expect(root.querySelector('.async-state--error')).toBeNull();
    expect(snackbarMessages).toHaveLength(0);
  });

  it('corrects a non-first page that returns no games with replace navigation', async () => {
    fetchLibraryGamesMock.mockResolvedValue(
      createGamesResponse([], { page: 9, totalPages: 3 }),
    );
    const { navigate, root } = createFixture({ page: 9 });

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledTimes(1);
    });
    expect(getNavigationUrl(navigate).searchParams.get('page')).toBe('1');
    expect(navigate.mock.lastCall?.[1]).toEqual({ replace: true });
    expect(
      getRequiredElement(root, '.library__games').getAttribute('aria-busy'),
    ).toBe('true');
  });

  it('aborts superseded game loads and ignores their stale results', async () => {
    const firstRequest = createDeferred<GamesResponse>();
    const secondRequest = createDeferred<GamesResponse>();
    fetchLibraryGamesMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    const snackbarMessages = listenForSnackbars();
    const { navigate, root, view } = createFixture();
    const firstSignal = fetchLibraryGamesMock.mock.calls[0]?.[1]?.signal;

    view.update?.(
      createRouteContext(
        { category: 'puzzle', navigationType: 'push' },
        navigate,
      ),
    );
    expect(firstSignal?.aborted).toBe(true);
    expect(fetchLibraryGamesMock).toHaveBeenCalledTimes(2);

    firstRequest.resolve(
      createGamesResponse([
        { ...DEFAULT_GAME, name: 'Stale Result', slug: 'stale-result' },
      ]),
    );
    secondRequest.resolve(
      createGamesResponse([
        { ...DEFAULT_GAME, name: 'Fresh Result', slug: 'fresh-result' },
      ]),
    );

    await waitForGameCards(root);
    expect(root.textContent).toContain('Fresh Result');
    expect(root.textContent).not.toContain('Stale Result');
    expect(snackbarMessages).toHaveLength(0);
  });

  it('aborts pending work and removes interactions when disposed', async () => {
    const categoriesRequest = createDeferred<CategoriesResponse>();
    const gamesRequest = createDeferred<GamesResponse>();
    fetchCategoriesMock.mockReturnValue(categoriesRequest.promise);
    fetchLibraryGamesMock.mockReturnValue(gamesRequest.promise);
    const detailsRequests = listenForGameDetails();
    const snackbarMessages = listenForSnackbars();
    const { navigate, root, view } = createFixture();
    const categoriesSignal = fetchCategoriesMock.mock.calls[0]?.[0]?.signal;
    const gamesSignal = fetchLibraryGamesMock.mock.calls[0]?.[1]?.signal;
    const sortTrigger = getRequiredElement<HTMLButtonElement>(
      root,
      '.library-sort__trigger',
    );

    view.dispose?.();
    expect(categoriesSignal?.aborted).toBe(true);
    expect(gamesSignal?.aborted).toBe(true);

    sortTrigger.click();
    expect(sortTrigger.ariaExpanded).toBe('false');
    categoriesRequest.resolve(createCategoriesResponse());
    gamesRequest.resolve(createGamesResponse());
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-category]')).toBeNull();
    expect(root.querySelector('.library-card')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(detailsRequests).toHaveLength(0);
    expect(snackbarMessages).toHaveLength(0);
  });
});
