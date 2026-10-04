import type { RouteContext, RouteView } from '../../app/router';
import {
  updateUrlState,
  type GameSort,
  type LibraryCategory,
} from '../../app/url-state';
import { dispatchGameDetailsRequest } from '../../components/dialogs/game-details-events';
import { getAppPath } from '../../utils/paths';
import './library.scss';

interface LibraryGame {
  readonly category: string;
  readonly description: string;
  readonly image: string;
  readonly likes: string;
  readonly name: string;
  readonly price: string;
  readonly rating: number;
  readonly slug: string;
}

interface SortOption {
  readonly label: string;
  readonly value: GameSort;
}

interface CategoryOption {
  readonly label: string;
  readonly value: LibraryCategory;
}

interface FilterController {
  readonly element: HTMLElement;
  readonly setValue: (value: LibraryCategory) => void;
}

interface SortController {
  readonly element: HTMLElement;
  readonly setValue: (value: GameSort) => void;
}

interface PaginationController {
  readonly element: HTMLElement;
  readonly setPage: (page: number) => void;
}

const categories: readonly CategoryOption[] = [
  { label: 'All Games', value: 'all' },
  { label: 'Puzzle', value: 'puzzle' },
  { label: 'Card', value: 'card' },
  { label: 'Match', value: 'match' },
  { label: 'Farm', value: 'farm' },
  { label: 'Strategy', value: 'strategy' },
  { label: 'Arcade', value: 'arcade' },
];

const sortOptions: readonly SortOption[] = [
  { label: 'Rating ↓', value: 'rating-desc' },
  { label: 'Rating ↑', value: 'rating-asc' },
  { label: 'Name A→Z', value: 'name-asc' },
  { label: 'Name Z→A', value: 'name-desc' },
];

const heartIconPath: string = getAppPath('/assets/icons/heart.png');
const starIconPath: string = getAppPath('/assets/icons/star.png');

const games: readonly LibraryGame[] = [
  {
    category: 'Strategy',
    description:
      'Cozy Italian Vacation Cafe 🏖️ No timers, No stress 😌 cook traditional dishes 🍝 upgrade and customize 🏠 just drink Prosecco 🥂 relax and grow your dream cafe ✨',
    image: 'vacation-cafe-simulator-card.jpg',
    likes: '28.7K',
    name: 'Vacation Cafe Simulator',
    price: 'Free',
    rating: 4.8,
    slug: 'vacation-cafe-simulator',
  },
  {
    category: 'Puzzle',
    description:
      "Organize 2000+ potions on shelves after the witch's cats have knocked them over, using clues around an enchanted cellar. Learn strange symbols and decipher cryptic notes.",
    image: 'shelve-the-potions-card.jpg',
    likes: '21.3K',
    name: 'Shelve the Potions!',
    price: 'Free',
    rating: 4.7,
    slug: 'shelve-the-potions',
  },
  {
    category: 'Farm',
    description:
      'A cozy woodland survival game about a mouse restoring their childhood burrow. Explore, gather resources, craft, knit warm sweaters, bake pies and meet the locals.',
    image: 'winter-burrow-card.jpg',
    likes: '32.4K',
    name: 'Winter Burrow',
    price: 'Free',
    rating: 4.9,
    slug: 'winter-burrow',
  },
  {
    category: 'Strategy',
    description:
      'A multiplayer life simulation game crafted for creativity, freedom, and peace. Build your dream home, explore hobbies, and forge warm connections with friends in a cozy town.',
    image: 'heartopia-card.jpg',
    likes: '46.8K',
    name: 'Heartopia',
    price: '$1.99',
    rating: 4.6,
    slug: 'heartopia',
  },
  {
    category: 'Puzzle',
    description:
      'Run a cozy cat post office. Sort and deliver parcels from the daily boat. At night, the moon reveals hidden truths about packages. Clear a strange backlog and unlock new destinations.',
    image: 'cat-mail-co-card.jpg',
    likes: '38.2K',
    name: 'Cat Mail Co.',
    price: 'Free',
    rating: 4.9,
    slug: 'cat-mail-co',
  },
  {
    category: 'Strategy',
    description:
      'A free-to-play fantasy life sim adventure where you can craft, explore, and create the life and home of your dreams in a vibrant, heartwarming world.',
    image: 'palia-card.jpg',
    likes: '89.5K',
    name: 'Palia',
    price: 'Free',
    rating: 4.8,
    slug: 'palia',
  },
];

const createFilterChips = (
  signal: AbortSignal,
  onSelect: (category: LibraryCategory) => void,
): FilterController => {
  const filters: HTMLDivElement = document.createElement('div');
  filters.className = 'library-filters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Game categories');
  filters.innerHTML = categories
    .map(
      (category: CategoryOption): string => `
        <button
          class="library-filters__chip"
          type="button"
          data-category="${category.value}"
          aria-pressed="false"
        >
          ${category.label}
        </button>
      `,
    )
    .join('');

  const setValue = (value: LibraryCategory): void => {
    const chips: NodeListOf<HTMLButtonElement> =
      filters.querySelectorAll<HTMLButtonElement>('[data-category]');
    for (const chip of chips) {
      const isActive: boolean = chip.dataset.category === value;
      chip.classList.toggle('library-filters__chip--active', isActive);
      chip.ariaPressed = String(isActive);
    }
  };

  filters.addEventListener(
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

  return { element: filters, setValue };
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
      if (optionButton === null) {
        return;
      }

      selectOption(optionButton);
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

  return { element: sort, setValue };
};

const createGameCard = (game: LibraryGame): HTMLElement => {
  const card: HTMLElement = document.createElement('article');
  const imagePath: string = getAppPath(`/assets/images/games/${game.image}`);
  card.className = 'library-card';
  card.innerHTML = `
    <img class="library-card__image" src="${imagePath}" alt="${game.name} game artwork" />
    <div class="library-card__content">
      <div class="library-card__heading">
        <div class="library-card__title-group">
          <h2 class="library-card__title">${game.name}</h2>
          <span class="library-card__category">${game.category}</span>
        </div>
        <strong class="library-card__price library-card__price--desktop${game.price === 'Free' ? ' library-card__price--free' : ''}">${game.price}</strong>
      </div>
      <p class="library-card__description">${game.description}</p>
      <div class="library-card__footer">
        <div class="library-card__stats">
          <span role="img" aria-label="Rated ${game.rating} out of 5"><img class="library-card__stat-icon" src="${starIconPath}" alt="" aria-hidden="true" />${game.rating}</span>
          <span role="img" aria-label="${game.likes} likes"><img class="library-card__stat-icon" src="${heartIconPath}" alt="" aria-hidden="true" />${game.likes}</span>
        </div>
        <strong class="library-card__price library-card__price--mobile${game.price === 'Free' ? ' library-card__price--free' : ''}">${game.price}</strong>
        <button class="btn btn--primary library-card__details" type="button" data-game-slug="${game.slug}">Details</button>
      </div>
    </div>
  `;

  return card;
};

const createPagination = (
  signal: AbortSignal,
  onSelect: (page: number) => void,
): PaginationController => {
  const totalPages: number = 4;
  let currentPage: number = 1;
  const pagination: HTMLElement = document.createElement('nav');
  pagination.className = 'library-pagination';
  pagination.setAttribute('aria-label', 'Library pages');
  pagination.innerHTML = `
    <button class="library-pagination__button library-pagination__button--arrow" type="button" data-page-direction="previous" aria-label="Previous page">
      <span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>
    </button>
    ${Array.from(
      { length: totalPages },
      (_value: unknown, index: number): string => `
        <button class="library-pagination__button" type="button" data-page="${index + 1}" aria-label="Page ${index + 1}">${index + 1}</button>
      `,
    ).join('')}
    <button class="library-pagination__button library-pagination__button--arrow" type="button" data-page-direction="next" aria-label="Next page">
      <span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>
    </button>
  `;

  const previousButton: HTMLButtonElement | null = pagination.querySelector(
    '[data-page-direction="previous"]',
  );
  const nextButton: HTMLButtonElement | null = pagination.querySelector(
    '[data-page-direction="next"]',
  );
  const pageButtons: NodeListOf<HTMLButtonElement> =
    pagination.querySelectorAll<HTMLButtonElement>('[data-page]');

  const updateState = (): void => {
    if (previousButton !== null) {
      previousButton.disabled = currentPage <= 1;
    }
    if (nextButton !== null) {
      nextButton.disabled = currentPage >= totalPages;
    }

    const mobileWindowStart: number = currentPage <= 2 ? 1 : 2;
    const mobileWindowEnd: number = mobileWindowStart + 2;

    for (const pageButton of pageButtons) {
      const page: number = Number(pageButton.dataset.page);
      const isActive: boolean = page === currentPage;
      pageButton.classList.toggle(
        'library-pagination__button--active',
        isActive,
      );
      pageButton.classList.toggle(
        'library-pagination__button--outside-mobile-window',
        page < mobileWindowStart || page > mobileWindowEnd,
      );
      pageButton.toggleAttribute('aria-current', isActive);
      if (isActive) {
        pageButton.ariaCurrent = 'page';
      }
    }
  };

  pagination.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const button: HTMLButtonElement | null = event.target.closest('button');
      if (button === null || button.disabled) {
        return;
      }

      if (button.dataset.page !== undefined) {
        onSelect(Number(button.dataset.page));
      } else if (button.dataset.pageDirection === 'previous') {
        onSelect(Math.max(1, currentPage - 1));
      } else if (button.dataset.pageDirection === 'next') {
        onSelect(Math.min(totalPages, currentPage + 1));
      }
    },
    { signal },
  );

  return {
    element: pagination,
    setPage: (page: number): void => {
      currentPage = page;
      updateState();
    },
  };
};

export const libraryPage = (initialContext: RouteContext): RouteView => {
  const eventController: AbortController = new AbortController();
  const { signal } = eventController;
  let context: RouteContext = initialContext;
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
  const pagination: PaginationController = createPagination(
    signal,
    (page: number): void => {
      if (page !== context.state.page) {
        context.navigate(updateUrlState(context.url, { page }));
      }
    },
  );

  controls?.append(filters.element, sort.element);
  gamesContainer?.append(
    ...games.map((game: LibraryGame): HTMLElement => createGameCard(game)),
  );
  section.querySelector('.library__inner')?.append(pagination.element);

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
      if (slug !== undefined) {
        dispatchGameDetailsRequest(slug);
      }
    },
    { signal },
  );

  const synchronize = (nextContext: RouteContext): void => {
    context = nextContext;
    filters.setValue(context.state.category);
    sort.setValue(context.state.sort);
    pagination.setPage(context.state.page);
  };

  synchronize(initialContext);

  return {
    content: section,
    dispose: (): void => {
      eventController.abort();
    },
    update: synchronize,
  };
};
