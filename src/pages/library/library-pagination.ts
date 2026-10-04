const DESKTOP_VISIBLE_PAGE_COUNT: number = 4;
const MOBILE_VISIBLE_PAGE_COUNT: number = 3;

type PageDirection = 'next' | 'previous';
type PaginationFocusTarget = PageDirection | 'current-page';

export interface LibraryPaginationState {
  readonly currentPage: number;
  readonly totalPages: number;
}

export interface LibraryPaginationController {
  readonly element: HTMLElement;
  readonly setBusy: (isBusy: boolean) => void;
  readonly setState: (state: LibraryPaginationState) => void;
}

interface VisiblePageWindow {
  readonly desktopPages: readonly number[];
  readonly mobilePages: ReadonlySet<number>;
}

const normalizePageNumber = (value: number): number => {
  return Number.isFinite(value)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Math.floor(value)))
    : 1;
};

const normalizeState = (
  state: LibraryPaginationState,
): LibraryPaginationState => {
  const totalPages: number = normalizePageNumber(state.totalPages);
  const currentPage: number = Math.min(
    normalizePageNumber(state.currentPage),
    totalPages,
  );

  return { currentPage, totalPages };
};

const createPageRange = (start: number, end: number): readonly number[] => {
  return Array.from(
    { length: end - start + 1 },
    (_value: unknown, index: number): number => start + index,
  );
};

const getMobileWindowStart = (
  currentPage: number,
  totalPages: number,
): number => {
  const maximumStart: number = Math.max(
    1,
    totalPages - MOBILE_VISIBLE_PAGE_COUNT + 1,
  );

  return Math.min(maximumStart, Math.max(1, currentPage - 1));
};

const getVisiblePageWindow = (
  state: LibraryPaginationState,
): VisiblePageWindow => {
  const mobileStart: number = getMobileWindowStart(
    state.currentPage,
    state.totalPages,
  );
  const mobileEnd: number = Math.min(
    state.totalPages,
    mobileStart + MOBILE_VISIBLE_PAGE_COUNT - 1,
  );
  let desktopStart: number = mobileStart;
  let desktopEnd: number = mobileEnd;

  if (desktopEnd < state.totalPages) {
    desktopEnd = Math.min(
      state.totalPages,
      desktopStart + DESKTOP_VISIBLE_PAGE_COUNT - 1,
    );
  } else {
    desktopStart = Math.max(1, desktopEnd - DESKTOP_VISIBLE_PAGE_COUNT + 1);
  }

  return {
    desktopPages: createPageRange(desktopStart, desktopEnd),
    mobilePages: new Set<number>(createPageRange(mobileStart, mobileEnd)),
  };
};

const createArrowButton = (direction: PageDirection): HTMLButtonElement => {
  const button: HTMLButtonElement = document.createElement('button');
  const icon: HTMLSpanElement = document.createElement('span');

  button.className =
    'library-pagination__button library-pagination__button--arrow';
  button.type = 'button';
  button.dataset.pageDirection = direction;
  button.setAttribute(
    'aria-label',
    direction === 'previous' ? 'Previous page' : 'Next page',
  );
  icon.className = 'material-symbols-rounded';
  icon.ariaHidden = 'true';
  icon.textContent =
    direction === 'previous' ? 'chevron_left' : 'chevron_right';
  button.append(icon);

  return button;
};

const createPageButton = (
  page: number,
  state: LibraryPaginationState,
  mobilePages: ReadonlySet<number>,
): HTMLButtonElement => {
  const button: HTMLButtonElement = document.createElement('button');
  const isCurrentPage: boolean = page === state.currentPage;

  button.className = 'library-pagination__button';
  button.type = 'button';
  button.dataset.page = String(page);
  button.textContent = String(page);
  button.setAttribute(
    'aria-label',
    isCurrentPage ? `Page ${page}, current page` : `Go to page ${page}`,
  );
  button.classList.toggle(
    'library-pagination__button--outside-mobile-window',
    !mobilePages.has(page),
  );
  button.classList.toggle('library-pagination__button--active', isCurrentPage);

  if (isCurrentPage) {
    button.setAttribute('aria-current', 'page');
  }

  return button;
};

export const createLibraryPagination = (
  signal: AbortSignal,
  onSelect: (page: number) => void,
): LibraryPaginationController => {
  const pagination: HTMLElement = document.createElement('nav');
  const previousButton: HTMLButtonElement = createArrowButton('previous');
  const nextButton: HTMLButtonElement = createArrowButton('next');
  let isBusy: boolean = false;
  let pendingFocusTarget: PaginationFocusTarget | undefined;
  let state: LibraryPaginationState = { currentPage: 1, totalPages: 1 };

  pagination.className = 'library-pagination';
  pagination.setAttribute('aria-label', 'Library pages');
  pagination.setAttribute('aria-busy', 'false');

  const updateDisabledStates = (): void => {
    previousButton.disabled = isBusy || state.currentPage <= 1;
    nextButton.disabled = isBusy || state.currentPage >= state.totalPages;

    const pageButtons: NodeListOf<HTMLButtonElement> =
      pagination.querySelectorAll<HTMLButtonElement>('[data-page]');
    for (const pageButton of pageButtons) {
      pageButton.disabled = isBusy;
    }
  };

  const captureFocusTarget = (): void => {
    const focusedElement: Element | null = document.activeElement;
    if (
      !(focusedElement instanceof HTMLButtonElement) ||
      !pagination.contains(focusedElement)
    ) {
      return;
    }

    pendingFocusTarget =
      focusedElement.dataset.pageDirection === 'previous' ||
      focusedElement.dataset.pageDirection === 'next'
        ? focusedElement.dataset.pageDirection
        : 'current-page';
  };

  const restoreFocusTarget = (): void => {
    if (pendingFocusTarget === undefined) {
      return;
    }

    const activeElement: Element | null = document.activeElement;
    if (
      activeElement !== null &&
      activeElement !== document.body &&
      activeElement !== document.documentElement &&
      !pagination.contains(activeElement)
    ) {
      pendingFocusTarget = undefined;
      return;
    }

    let focusTarget: HTMLButtonElement | null;
    if (pendingFocusTarget === 'previous' && !previousButton.disabled) {
      focusTarget = previousButton;
    } else if (pendingFocusTarget === 'next' && !nextButton.disabled) {
      focusTarget = nextButton;
    } else {
      focusTarget = pagination.querySelector<HTMLButtonElement>(
        '[aria-current="page"]',
      );
    }

    if (focusTarget === null || focusTarget.disabled) {
      return;
    }

    pendingFocusTarget = undefined;
    focusTarget.focus();
  };

  const render = (): void => {
    captureFocusTarget();
    const visibleWindow: VisiblePageWindow = getVisiblePageWindow(state);
    const pageButtons: readonly HTMLButtonElement[] =
      visibleWindow.desktopPages.map((page: number): HTMLButtonElement =>
        createPageButton(page, state, visibleWindow.mobilePages),
      );

    pagination.replaceChildren(previousButton, ...pageButtons, nextButton);
    updateDisabledStates();
    restoreFocusTarget();
  };

  pagination.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const button: HTMLButtonElement | null = event.target.closest('button');
      if (button === null || button.disabled || !pagination.contains(button)) {
        return;
      }

      let selectedPage: number | undefined;
      if (button.dataset.page !== undefined) {
        selectedPage = Number(button.dataset.page);
      } else if (button.dataset.pageDirection === 'previous') {
        selectedPage = state.currentPage - 1;
      } else if (button.dataset.pageDirection === 'next') {
        selectedPage = state.currentPage + 1;
      }

      if (
        selectedPage === undefined ||
        !Number.isSafeInteger(selectedPage) ||
        selectedPage < 1 ||
        selectedPage > state.totalPages ||
        selectedPage === state.currentPage
      ) {
        return;
      }

      onSelect(selectedPage);
    },
    { signal },
  );

  render();

  return {
    element: pagination,
    setBusy: (isNextBusy: boolean): void => {
      if (isNextBusy) {
        captureFocusTarget();
      }
      isBusy = isNextBusy;
      pagination.setAttribute('aria-busy', String(isBusy));
      updateDisabledStates();
      if (!isBusy) {
        restoreFocusTarget();
      }
    },
    setState: (nextState: LibraryPaginationState): void => {
      state = normalizeState(nextState);
      render();
    },
  };
};
