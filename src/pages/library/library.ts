import type { RouteContext, RouteView } from '../../app/router';
import {
  isLibraryCategory,
  updateUrlState,
  type GameSort,
  type LibraryCategory,
} from '../../app/url-state';
import {
  createBlockErrorState,
  createEmptyState,
  createSkeletonState,
} from '../../components/async-state/async-state';
import { dispatchGameDetailsRequest } from '../../components/dialogs/game-details-events';
import { dispatchSnackbar } from '../../components/snackbar/snackbar-events';
import { isApiAbortError } from '../../services/api-client';
import {
  fetchCategories,
  fetchLibraryGames,
  type LibraryGamesQuery,
} from '../../services/minigames-api';
import type { GameCategory, GameSummary } from '../../types/api';
import { getAppPath } from '../../utils/paths';
import {
  createLibraryPagination,
  type LibraryPaginationController,
} from './library-pagination';
import './library.scss';

interface SortOption {
  readonly label: string;
  readonly value: GameSort;
}

interface CategoryOption {
  readonly isDefault: boolean;
  readonly label: string;
  readonly value: LibraryCategory;
}

interface FilterController {
  readonly element: HTMLElement;
  readonly renderCategories: (
    categories: readonly CategoryOption[],
    value: LibraryCategory,
  ) => void;
  readonly renderEmpty: () => void;
  readonly renderError: (onRetry: () => void) => void;
  readonly renderLoading: () => void;
  readonly setValue: (value: LibraryCategory) => void;
}

interface SortController {
  readonly element: HTMLElement;
  readonly setValue: (value: GameSort) => void;
}

const LIBRARY_PAGE_SIZE: number = 6;
const LIBRARY_ERROR_MESSAGE: string =
  'The game library is unavailable right now. Please try again.';
const CATEGORY_ERROR_MESSAGE: string =
  'Game categories could not be loaded. Please try again.';

const sortOptions: readonly SortOption[] = [
  { label: 'Rating ↓', value: 'rating-desc' },
  { label: 'Rating ↑', value: 'rating-asc' },
  { label: 'Name A→Z', value: 'name-asc' },
  { label: 'Name Z→A', value: 'name-desc' },
];

const heartIconPath: string = getAppPath('/assets/icons/heart.png');
const starIconPath: string = getAppPath('/assets/icons/star.png');
const likesFormatter: Intl.NumberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact',
});

const getCategoryOptions = (
  categories: readonly GameCategory[],
): readonly CategoryOption[] => {
  const categoryValues = new Set<LibraryCategory>();
  const options: CategoryOption[] = [];

  for (const category of categories) {
    if (
      !isLibraryCategory(category.slug) ||
      categoryValues.has(category.slug)
    ) {
      continue;
    }

    categoryValues.add(category.slug);
    options.push({
      isDefault: category.isDefault,
      label: category.label.trim() || category.slug,
      value: category.slug,
    });
  }

  return options;
};

const createFilterChips = (
  signal: AbortSignal,
  onSelect: (category: LibraryCategory) => void,
): FilterController => {
  const root: HTMLDivElement = document.createElement('div');
  let categories: readonly CategoryOption[] = [];
  root.className = 'library__filter-content';

  const setValue = (value: LibraryCategory): void => {
    const chips: NodeListOf<HTMLButtonElement> =
      root.querySelectorAll<HTMLButtonElement>('[data-category]');
    for (const chip of chips) {
      const isActive: boolean = chip.dataset.category === value;
      chip.classList.toggle('library-filters__chip--active', isActive);
      chip.ariaPressed = String(isActive);
    }
  };

  const renderCategories = (
    nextCategories: readonly CategoryOption[],
    value: LibraryCategory,
  ): void => {
    const filters: HTMLDivElement = document.createElement('div');
    filters.className = 'library-filters';
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', 'Game categories');
    categories = nextCategories;

    for (const category of categories) {
      const chip: HTMLButtonElement = document.createElement('button');
      chip.className = 'library-filters__chip';
      chip.type = 'button';
      chip.dataset.category = category.value;
      chip.ariaPressed = 'false';
      chip.textContent = category.label;
      filters.append(chip);
    }

    root.replaceChildren(filters);
    setValue(value);
  };

  root.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const selectedChip: HTMLButtonElement | null = event.target.closest(
        'button[data-category]',
      );
      const selectedCategory: CategoryOption | undefined = categories.find(
        (category: CategoryOption): boolean =>
          category.value === selectedChip?.dataset.category,
      );
      if (selectedCategory !== undefined) {
        onSelect(selectedCategory.value);
      }
    },
    { signal },
  );

  return {
    element: root,
    renderCategories,
    renderEmpty: (): void => {
      categories = [];
      root.replaceChildren(
        createEmptyState({
          message: 'Category filters will appear here when they are available.',
          title: 'No categories found',
        }),
      );
    },
    renderError: (onRetry: () => void): void => {
      categories = [];
      root.replaceChildren(
        createBlockErrorState({
          message: CATEGORY_ERROR_MESSAGE,
          onRetry,
          title: 'Unable to load categories',
        }),
      );
    },
    renderLoading: (): void => {
      categories = [];
      root.replaceChildren(
        createSkeletonState({
          itemCount: 1,
          label: 'Loading game categories',
          variant: 'rows',
        }),
      );
    },
    setValue,
  };
};

const createSortControl = (
  signal: AbortSignal,
  onSelect: (sort: GameSort) => void,
): SortController => {
  const sort: HTMLDivElement = document.createElement('div');
  sort.className = 'library-sort';
  sort.innerHTML = `
    <button
      class="library-sort__trigger"
      type="button"
      aria-haspopup="listbox"
      aria-expanded="false"
      aria-controls="library-sort-options"
    >
      <span>Sort by: <strong data-sort-label>Rating ↓</strong></span>
      <span class="material-symbols-rounded library-sort__arrow" aria-hidden="true">keyboard_arrow_down</span>
    </button>
    <ul class="library-sort__options" id="library-sort-options" role="listbox" aria-label="Sort games" hidden>
      ${sortOptions
        .map(
          (option: SortOption): string => `
            <li role="presentation">
              <button
                class="library-sort__option"
                type="button"
                role="option"
                data-sort-value="${option.value}"
                aria-selected="false"
              >
                <span class="library-sort__check" aria-hidden="true">✓</span>
                ${option.label}
              </button>
            </li>
          `,
        )
        .join('')}
    </ul>
  `;

  const trigger: HTMLButtonElement | null = sort.querySelector(
    '.library-sort__trigger',
  );
  const options: HTMLUListElement | null = sort.querySelector(
    '.library-sort__options',
  );
  const label: HTMLElement | null = sort.querySelector('[data-sort-label]');

  if (trigger === null || options === null || label === null) {
    return { element: sort, setValue: (): void => undefined };
  }

  const optionButtons: NodeListOf<HTMLButtonElement> =
    options.querySelectorAll<HTMLButtonElement>('[data-sort-value]');

  const setOpen = (
    isOpen: boolean,
    shouldFocusOption: boolean = false,
  ): void => {
    trigger.ariaExpanded = String(isOpen);
    options.hidden = !isOpen;
    sort.classList.toggle('library-sort--open', isOpen);

    if (isOpen && shouldFocusOption) {
      options
        .querySelector<HTMLButtonElement>('[aria-selected="true"]')
        ?.focus();
    }
  };

  const setValue = (value: GameSort): void => {
    const selectedOption: SortOption =
      sortOptions.find(
        (option: SortOption): boolean => option.value === value,
      ) ?? sortOptions[0];
    for (const optionButton of optionButtons) {
      const isSelected: boolean =
        optionButton.dataset.sortValue === selectedOption.value;
      optionButton.classList.toggle('library-sort__option--active', isSelected);
      optionButton.ariaSelected = String(isSelected);
    }

    label.textContent = selectedOption.label;
  };

  const selectOption = (selectedButton: HTMLButtonElement): void => {
    const selectedOption: SortOption | undefined = sortOptions.find(
      (option: SortOption): boolean =>
        option.value === selectedButton.dataset.sortValue,
    );
    if (selectedOption === undefined) {
      return;
    }

    onSelect(selectedOption.value);
    setOpen(false);
    trigger.focus();
  };

  trigger.addEventListener(
    'click',
    (): void => {
      setOpen(trigger.ariaExpanded !== 'true');
    },
    { signal },
  );

  trigger.addEventListener(
    'keydown',
    (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && trigger.ariaExpanded === 'true') {
        setOpen(false);
        return;
      }

      if (event.key !== 'ArrowDown') {
        return;
      }

      event.preventDefault();
      setOpen(true, true);
    },
    { signal },
  );

  options.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const optionButton: HTMLButtonElement | null = event.target.closest(
        'button[data-sort-value]',
      );
      if (optionButton !== null) {
        selectOption(optionButton);
      }
    },
    { signal },
  );

  options.addEventListener(
    'keydown',
    (event: KeyboardEvent): void => {
      const optionButtonList: HTMLButtonElement[] = [...optionButtons];
      const activeElement: HTMLButtonElement | null =
        document.activeElement instanceof HTMLButtonElement
          ? document.activeElement
          : null;
      const activeIndex: number =
        activeElement === null ? -1 : optionButtonList.indexOf(activeElement);
      let nextIndex: number | undefined;

      switch (event.key) {
        case 'ArrowDown': {
          nextIndex = (activeIndex + 1) % optionButtons.length;
          break;
        }
        case 'ArrowUp': {
          nextIndex =
            (activeIndex - 1 + optionButtons.length) % optionButtons.length;
          break;
        }
        case 'End': {
          nextIndex = optionButtons.length - 1;
          break;
        }
        case 'Escape': {
          setOpen(false);
          trigger.focus();
          return;
        }
        case 'Home': {
          nextIndex = 0;
          break;
        }
        default: {
          return;
        }
      }

      if (nextIndex === undefined) {
        return;
      }

      event.preventDefault();
      optionButtons[nextIndex]?.focus();
    },
    { signal },
  );

  document.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!(event.target instanceof Node) || sort.contains(event.target)) {
        return;
      }

      setOpen(false);
    },
    { signal },
  );

  sort.addEventListener(
    'focusout',
    (event: FocusEvent): void => {
      if (
        !(event.relatedTarget instanceof Node) ||
        !sort.contains(event.relatedTarget)
      ) {
        setOpen(false);
      }
    },
    { signal },
  );

  return { element: sort, setValue };
};

const getCategoryLabel = (category: string): string => {
  const normalizedCategory: string = category.trim();
  return normalizedCategory.length === 0
    ? 'Other'
    : `${normalizedCategory.charAt(0).toUpperCase()}${normalizedCategory.slice(1)}`;
};

const createPrice = (price: string, modifier: string): HTMLElement => {
  const priceElement: HTMLElement = document.createElement('strong');
  const isFree: boolean = price.trim().toLowerCase() === 'free';
  priceElement.className = `library-card__price library-card__price--${modifier}`;
  priceElement.classList.toggle('library-card__price--free', isFree);
  priceElement.textContent = price;
  return priceElement;
};

const createStat = (
  iconPath: string,
  label: string,
  value: string,
): HTMLSpanElement => {
  const stat: HTMLSpanElement = document.createElement('span');
  const icon: HTMLImageElement = document.createElement('img');
  stat.setAttribute('role', 'img');
  stat.setAttribute('aria-label', label);
  icon.className = 'library-card__stat-icon';
  icon.src = iconPath;
  icon.alt = '';
  icon.ariaHidden = 'true';
  stat.append(icon, value);
  return stat;
};

const createGameCard = (game: GameSummary): HTMLElement => {
  const card: HTMLElement = document.createElement('article');
  const image: HTMLImageElement = document.createElement('img');
  const content: HTMLDivElement = document.createElement('div');
  const heading: HTMLDivElement = document.createElement('div');
  const titleGroup: HTMLDivElement = document.createElement('div');
  const title: HTMLHeadingElement = document.createElement('h2');
  const category: HTMLSpanElement = document.createElement('span');
  const description: HTMLParagraphElement = document.createElement('p');
  const footer: HTMLDivElement = document.createElement('div');
  const stats: HTMLDivElement = document.createElement('div');
  const detailsButton: HTMLButtonElement = document.createElement('button');
  const displayName: string = game.name.trim() || 'Untitled game';
  const displayRating: string = Number.isFinite(game.rating)
    ? game.rating.toFixed(1)
    : 'Not rated';
  const displayLikes: string = Number.isFinite(game.likesCount)
    ? likesFormatter.format(game.likesCount)
    : '0';

  card.className = 'library-card';
  image.className = 'library-card__image';
  image.src = getAppPath(game.cardImage);
  image.alt = `${displayName} game artwork`;
  image.decoding = 'async';
  image.loading = 'lazy';
  content.className = 'library-card__content';
  heading.className = 'library-card__heading';
  titleGroup.className = 'library-card__title-group';
  title.className = 'library-card__title';
  title.textContent = displayName;
  category.className = 'library-card__category';
  category.textContent = getCategoryLabel(game.category);
  description.className = 'library-card__description';
  description.textContent = game.shortDescription;
  footer.className = 'library-card__footer';
  stats.className = 'library-card__stats';
  stats.append(
    createStat(starIconPath, `Rated ${displayRating} out of 5`, displayRating),
    createStat(heartIconPath, `${displayLikes} likes`, displayLikes),
  );
  detailsButton.className = 'btn btn--primary library-card__details';
  detailsButton.type = 'button';
  detailsButton.dataset.gameSlug = game.slug;
  detailsButton.setAttribute('aria-label', `View details for ${displayName}`);
  detailsButton.textContent = 'Details';

  titleGroup.append(title, category);
  heading.append(titleGroup, createPrice(game.price, 'desktop'));
  footer.append(stats, createPrice(game.price, 'mobile'), detailsButton);
  content.append(heading, description, footer);
  card.append(image, content);
  return card;
};

const createLibraryQuery = (context: RouteContext): LibraryGamesQuery => {
  return {
    category: context.state.category,
    limit: LIBRARY_PAGE_SIZE,
    page: context.state.page,
    sort: context.state.sort,
  };
};

const getLibraryQueryKey = (query: LibraryGamesQuery): string => {
  return `${query.category}:${query.sort}:${query.page}:${query.limit}`;
};

const getLibraryQueryScopeKey = (query: LibraryGamesQuery): string => {
  return `${query.category}:${query.sort}`;
};

export const libraryPage = (initialContext: RouteContext): RouteView => {
  const eventController: AbortController = new AbortController();
  const { signal } = eventController;
  let shouldUseApiDefaultCategory: boolean = !isLibraryCategory(
    initialContext.sourceUrl.searchParams.get('category'),
  );
  let categoriesRequest: AbortController | undefined;
  let categoriesRequestVersion: number = 0;
  let context: RouteContext = initialContext;
  let gamesRequest: AbortController | undefined;
  let gamesRequestVersion: number = 0;
  let isDestroyed: boolean = false;
  let knownPaginationScopeKey: string | undefined;
  let knownTotalPages: number = 1;
  let loadedQueryKey: string | undefined;
  const section: HTMLElement = document.createElement('section');
  section.className = 'library';
  section.setAttribute('aria-labelledby', 'library-title');
  section.innerHTML = `
    <div class="library__inner">
      <header class="library__heading">
        <h1 id="library-title">Game Library</h1>
        <p>Browse our collection of casual mini-games</p>
      </header>
      <div class="library__controls"></div>
      <div class="library__games" role="region" aria-label="Available games"></div>
    </div>
  `;

  const inner: HTMLElement | null = section.querySelector('.library__inner');
  const controls: HTMLElement | null =
    section.querySelector('.library__controls');
  const gamesContainer: HTMLElement | null =
    section.querySelector('.library__games');
  const filters: FilterController = createFilterChips(
    signal,
    (category: LibraryCategory): void => {
      if (category !== context.state.category) {
        context.navigate(updateUrlState(context.url, { category, page: 1 }));
      }
    },
  );
  const sort: SortController = createSortControl(
    signal,
    (sortValue: GameSort): void => {
      if (sortValue !== context.state.sort) {
        context.navigate(
          updateUrlState(context.url, { page: 1, sort: sortValue }),
        );
      }
    },
  );
  const pagination: LibraryPaginationController = createLibraryPagination(
    signal,
    (page: number): void => {
      if (page !== context.state.page) {
        context.navigate(updateUrlState(context.url, { page }));
      }
    },
  );

  controls?.append(filters.element, sort.element);
  inner?.append(pagination.element);

  const renderGamesLoading = (): void => {
    gamesContainer?.setAttribute('aria-busy', 'true');
    gamesContainer?.replaceChildren(
      createSkeletonState({
        itemCount: LIBRARY_PAGE_SIZE,
        label: 'Loading games',
        variant: 'cards',
      }),
    );
    pagination.setBusy(true);
  };

  const renderGamesError = (query: LibraryGamesQuery): void => {
    gamesContainer?.removeAttribute('aria-busy');
    gamesContainer?.replaceChildren(
      createBlockErrorState({
        message: LIBRARY_ERROR_MESSAGE,
        onRetry: (): void => {
          void loadGames(query);
        },
        title: 'Unable to load the game library',
      }),
    );
    pagination.setBusy(false);
  };

  const renderGames = (games: readonly GameSummary[]): void => {
    gamesContainer?.removeAttribute('aria-busy');
    gamesContainer?.replaceChildren(
      ...(games.length === 0
        ? [
            createEmptyState({
              message:
                'No games are available for the selected filters and page.',
              title: 'Data Not Found',
            }),
          ]
        : games.map((game: GameSummary): HTMLElement => createGameCard(game))),
    );
  };

  const loadGames = async (query: LibraryGamesQuery): Promise<void> => {
    gamesRequest?.abort();
    const request: AbortController = new AbortController();
    const requestVersion: number = gamesRequestVersion + 1;
    gamesRequest = request;
    gamesRequestVersion = requestVersion;
    renderGamesLoading();

    try {
      const response = await fetchLibraryGames(query, {
        signal: request.signal,
      });
      if (
        requestVersion !== gamesRequestVersion ||
        isDestroyed ||
        request.signal.aborted
      ) {
        return;
      }

      knownPaginationScopeKey = getLibraryQueryScopeKey(query);
      knownTotalPages = Math.max(1, response.meta.totalPages);
      if (response.data.length === 0 && query.page !== 1) {
        context.navigate(updateUrlState(context.url, { page: 1 }), {
          replace: true,
        });
        return;
      }

      const isEmpty: boolean = response.data.length === 0;
      renderGames(response.data);
      pagination.setState({
        currentPage: isEmpty ? 1 : response.meta.page,
        totalPages: knownTotalPages,
      });
      pagination.setBusy(false);
    } catch (error: unknown) {
      if (
        requestVersion !== gamesRequestVersion ||
        isDestroyed ||
        request.signal.aborted ||
        isApiAbortError(error)
      ) {
        return;
      }

      renderGamesError(query);
      dispatchSnackbar({
        message: LIBRARY_ERROR_MESSAGE,
        variant: 'error',
      });
    } finally {
      if (gamesRequest === request) {
        gamesRequest = undefined;
      }
    }
  };

  const loadCategories = async (): Promise<void> => {
    categoriesRequest?.abort();
    const request: AbortController = new AbortController();
    const requestVersion: number = categoriesRequestVersion + 1;
    categoriesRequest = request;
    categoriesRequestVersion = requestVersion;
    filters.renderLoading();

    try {
      const response = await fetchCategories({ signal: request.signal });
      if (
        requestVersion !== categoriesRequestVersion ||
        isDestroyed ||
        request.signal.aborted
      ) {
        return;
      }

      const categoryOptions: readonly CategoryOption[] = getCategoryOptions(
        response.data,
      );
      const defaultCategory: CategoryOption | undefined =
        categoryOptions.find(
          (category: CategoryOption): boolean => category.isDefault,
        ) ?? categoryOptions[0];
      if (defaultCategory === undefined) {
        filters.renderEmpty();
        return;
      }

      const activeCategory: CategoryOption = shouldUseApiDefaultCategory
        ? defaultCategory
        : (categoryOptions.find(
            (category: CategoryOption): boolean =>
              category.value === context.state.category,
          ) ?? defaultCategory);
      filters.renderCategories(categoryOptions, activeCategory.value);

      if (activeCategory.value !== context.state.category) {
        context.navigate(
          updateUrlState(context.url, {
            category: activeCategory.value,
            page: 1,
          }),
          { replace: true },
        );
      }
    } catch (error: unknown) {
      if (
        requestVersion !== categoriesRequestVersion ||
        isDestroyed ||
        request.signal.aborted ||
        isApiAbortError(error)
      ) {
        return;
      }

      filters.renderError((): void => {
        void loadCategories();
      });
      dispatchSnackbar({
        message: CATEGORY_ERROR_MESSAGE,
        variant: 'error',
      });
    } finally {
      if (categoriesRequest === request) {
        categoriesRequest = undefined;
      }
    }
  };

  gamesContainer?.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const detailsButton: HTMLButtonElement | null = event.target.closest(
        'button[data-game-slug]',
      );
      const slug: string | undefined = detailsButton?.dataset.gameSlug;
      if (slug !== undefined && slug.length > 0) {
        dispatchGameDetailsRequest(slug);
      }
    },
    { signal },
  );

  const synchronize = (nextContext: RouteContext): void => {
    if (nextContext.state.category !== context.state.category) {
      shouldUseApiDefaultCategory = false;
    }
    context = nextContext;
    filters.setValue(context.state.category);
    sort.setValue(context.state.sort);

    const query: LibraryGamesQuery = createLibraryQuery(context);
    const queryKey: string = getLibraryQueryKey(query);
    const queryScopeKey: string = getLibraryQueryScopeKey(query);
    pagination.setState({
      currentPage: query.page,
      totalPages:
        queryScopeKey === knownPaginationScopeKey
          ? Math.max(query.page, knownTotalPages)
          : query.page,
    });
    if (queryKey === loadedQueryKey) {
      return;
    }

    loadedQueryKey = queryKey;
    void loadGames(query);
  };

  synchronize(initialContext);
  void loadCategories();

  return {
    content: section,
    dispose: (): void => {
      isDestroyed = true;
      categoriesRequestVersion += 1;
      gamesRequestVersion += 1;
      categoriesRequest?.abort();
      gamesRequest?.abort();
      categoriesRequest = undefined;
      gamesRequest = undefined;
      eventController.abort();
    },
    update: synchronize,
  };
};
