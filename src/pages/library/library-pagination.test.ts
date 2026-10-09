import { describe, expect, it, vi } from 'vitest';

import {
  createLibraryPagination,
  type LibraryPaginationController,
} from './library-pagination';

interface PaginationFixture {
  readonly abortController: AbortController;
  readonly controller: LibraryPaginationController;
  readonly onSelect: ReturnType<typeof vi.fn>;
}

const createFixture = (): PaginationFixture => {
  const abortController = new AbortController();
  const onSelect = vi.fn();
  const controller = createLibraryPagination(abortController.signal, onSelect);

  document.body.append(controller.element);

  return { abortController, controller, onSelect };
};

const getRequiredButton = (
  element: HTMLElement,
  selector: string,
): HTMLButtonElement => {
  const button = element.querySelector<HTMLButtonElement>(selector);

  if (button === null) {
    throw new Error(`Expected a button matching "${selector}".`);
  }

  return button;
};

const getRenderedPages = (element: HTMLElement): readonly number[] => {
  return Array.from(
    element.querySelectorAll<HTMLButtonElement>('[data-page]'),
    (button: HTMLButtonElement): number => Number(button.dataset.page),
  );
};

describe('createLibraryPagination', () => {
  it('renders an accessible single-page state by default', () => {
    const { controller } = createFixture();
    const previousButton = getRequiredButton(
      controller.element,
      '[data-page-direction="previous"]',
    );
    const nextButton = getRequiredButton(
      controller.element,
      '[data-page-direction="next"]',
    );
    const currentPageButton = getRequiredButton(
      controller.element,
      '[data-page="1"]',
    );

    expect(controller.element.tagName).toBe('NAV');
    expect(controller.element.getAttribute('aria-label')).toBe('Library pages');
    expect(controller.element.getAttribute('aria-busy')).toBe('false');
    expect(getRenderedPages(controller.element)).toEqual([1]);
    expect(previousButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(true);
    expect(currentPageButton.getAttribute('aria-current')).toBe('page');
    expect(currentPageButton.getAttribute('aria-label')).toBe(
      'Page 1, current page',
    );
    expect(
      currentPageButton.classList.contains(
        'library-pagination__button--active',
      ),
    ).toBe(true);
  });

  it('renders a sliding desktop window and marks its mobile overflow page', () => {
    const { controller } = createFixture();

    controller.setState({ currentPage: 5, totalPages: 10 });

    expect(getRenderedPages(controller.element)).toEqual([4, 5, 6, 7]);
    expect(
      Array.from(
        controller.element.querySelectorAll<HTMLButtonElement>(
          '.library-pagination__button--outside-mobile-window',
        ),
        (button: HTMLButtonElement): number => Number(button.dataset.page),
      ),
    ).toEqual([7]);
    expect(
      getRequiredButton(controller.element, '[data-page="5"]').getAttribute(
        'aria-current',
      ),
    ).toBe('page');

    controller.setState({ currentPage: 10, totalPages: 10 });

    expect(getRenderedPages(controller.element)).toEqual([7, 8, 9, 10]);
    expect(
      getRequiredButton(
        controller.element,
        '[data-page="7"]',
      ).classList.contains('library-pagination__button--outside-mobile-window'),
    ).toBe(true);
  });

  it('selects pages from arrows and number buttons without mutating state', () => {
    const { controller, onSelect } = createFixture();

    controller.setState({ currentPage: 3, totalPages: 5 });

    const nextIcon = controller.element.querySelector<HTMLElement>(
      ':scope [data-page-direction="next"] .material-symbols-rounded',
    );
    if (nextIcon === null) {
      throw new Error('Expected the next-page icon.');
    }

    nextIcon.click();
    getRequiredButton(
      controller.element,
      '[data-page-direction="previous"]',
    ).click();
    getRequiredButton(controller.element, '[data-page="5"]').click();
    getRequiredButton(controller.element, '[data-page="3"]').click();

    expect(onSelect.mock.calls).toEqual([[4], [2], [5]]);
    expect(
      getRequiredButton(controller.element, '[aria-current="page"]').dataset
        .page,
    ).toBe('3');
  });

  it('disables every control while busy and restores boundary states', () => {
    const { controller, onSelect } = createFixture();

    controller.setState({ currentPage: 1, totalPages: 4 });
    controller.setBusy(true);

    expect(controller.element.getAttribute('aria-busy')).toBe('true');
    for (const button of controller.element.querySelectorAll('button')) {
      expect(button.disabled).toBe(true);
    }

    getRequiredButton(
      controller.element,
      '[data-page-direction="next"]',
    ).click();
    expect(onSelect).not.toHaveBeenCalled();

    controller.setBusy(false);

    expect(controller.element.getAttribute('aria-busy')).toBe('false');
    expect(
      getRequiredButton(controller.element, '[data-page-direction="previous"]')
        .disabled,
    ).toBe(true);
    expect(
      getRequiredButton(controller.element, '[data-page-direction="next"]')
        .disabled,
    ).toBe(false);
    for (const button of controller.element.querySelectorAll<HTMLButtonElement>(
      '[data-page]',
    )) {
      expect(button.disabled).toBe(false);
    }
  });

  it('normalizes fractional and out-of-range state values', () => {
    const { controller } = createFixture();

    controller.setState({ currentPage: 99, totalPages: 2.9 });

    expect(getRenderedPages(controller.element)).toEqual([1, 2]);
    expect(
      getRequiredButton(controller.element, '[aria-current="page"]').dataset
        .page,
    ).toBe('2');

    controller.setState({ currentPage: NaN, totalPages: 0 });

    expect(getRenderedPages(controller.element)).toEqual([1]);
    expect(
      getRequiredButton(controller.element, '[aria-current="page"]').dataset
        .page,
    ).toBe('1');
  });

  it('restores focus to the equivalent control after rerendering', () => {
    const { controller } = createFixture();

    controller.setState({ currentPage: 3, totalPages: 10 });
    getRequiredButton(controller.element, '[aria-current="page"]').focus();

    controller.setState({ currentPage: 6, totalPages: 10 });

    expect(document.activeElement).toBe(
      getRequiredButton(controller.element, '[data-page="6"]'),
    );

    const nextButton = getRequiredButton(
      controller.element,
      '[data-page-direction="next"]',
    );
    nextButton.focus();
    controller.setState({ currentPage: 7, totalPages: 10 });

    expect(document.activeElement).toBe(nextButton);
  });

  it('removes its click listener when the provided signal aborts', () => {
    const { abortController, controller, onSelect } = createFixture();

    controller.setState({ currentPage: 1, totalPages: 3 });
    abortController.abort();
    getRequiredButton(
      controller.element,
      '[data-page-direction="next"]',
    ).click();

    expect(onSelect).not.toHaveBeenCalled();
  });
});
