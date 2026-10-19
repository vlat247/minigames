import './async-state.scss';

const MAX_SKELETON_ITEMS: number = 12;

export type SkeletonVariant = 'cards' | 'details' | 'rows';

export interface SkeletonStateOptions {
  readonly itemCount?: number;
  readonly label?: string;
  readonly variant?: SkeletonVariant;
}

export interface BlockErrorStateOptions {
  readonly message?: string;
  readonly onRetry: () => void;
  readonly retryLabel?: string;
  readonly title?: string;
}

export interface EmptyStateOptions {
  readonly message?: string;
  readonly title?: string;
}

const defaultSkeletonItemCounts: Readonly<Record<SkeletonVariant, number>> = {
  cards: 3,
  details: 1,
  rows: 5,
};

const createStateRoot = (modifier: string): HTMLDivElement => {
  const state: HTMLDivElement = document.createElement('div');
  state.className = `async-state async-state--${modifier}`;
  state.dataset.asyncState = modifier;

  return state;
};

const createSkeletonBlock = (modifier: string): HTMLSpanElement => {
  const block: HTMLSpanElement = document.createElement('span');
  block.className = `async-state__skeleton-block async-state__skeleton-block--${modifier}`;

  return block;
};

const createCardSkeleton = (): HTMLDivElement => {
  const item: HTMLDivElement = document.createElement('div');
  const body: HTMLDivElement = document.createElement('div');
  item.className =
    'async-state__skeleton-item async-state__skeleton-item--card';
  body.className = 'async-state__skeleton-body';
  body.append(
    createSkeletonBlock('title'),
    createSkeletonBlock('line'),
    createSkeletonBlock('line-short'),
  );
  item.append(createSkeletonBlock('media'), body);

  return item;
};

const createRowSkeleton = (): HTMLDivElement => {
  const item: HTMLDivElement = document.createElement('div');
  const text: HTMLDivElement = document.createElement('div');
  item.className = 'async-state__skeleton-item async-state__skeleton-item--row';
  text.className = 'async-state__skeleton-text';
  text.append(createSkeletonBlock('line'), createSkeletonBlock('line-short'));
  item.append(
    createSkeletonBlock('avatar'),
    text,
    createSkeletonBlock('value'),
  );

  return item;
};

const createDetailsSkeleton = (): HTMLDivElement => {
  const item: HTMLDivElement = document.createElement('div');
  const body: HTMLDivElement = document.createElement('div');
  item.className =
    'async-state__skeleton-item async-state__skeleton-item--details';
  body.className = 'async-state__skeleton-body';
  body.append(
    createSkeletonBlock('title'),
    createSkeletonBlock('line'),
    createSkeletonBlock('line'),
    createSkeletonBlock('line-short'),
  );
  item.append(createSkeletonBlock('hero'), body);

  return item;
};

const createSkeletonItem = (variant: SkeletonVariant): HTMLDivElement => {
  switch (variant) {
    case 'cards': {
      return createCardSkeleton();
    }
    case 'details': {
      return createDetailsSkeleton();
    }
    case 'rows': {
      return createRowSkeleton();
    }
  }
};

const normalizeItemCount = (
  requestedCount: number | undefined,
  variant: SkeletonVariant,
): number => {
  return requestedCount === undefined || !Number.isFinite(requestedCount)
    ? defaultSkeletonItemCounts[variant]
    : Math.min(MAX_SKELETON_ITEMS, Math.max(1, Math.floor(requestedCount)));
};

export const createSkeletonState = (
  options: SkeletonStateOptions = {},
): HTMLDivElement => {
  const variant: SkeletonVariant = options.variant ?? 'cards';
  const state: HTMLDivElement = createStateRoot('loading');
  const status: HTMLSpanElement = document.createElement('span');
  const skeleton: HTMLDivElement = document.createElement('div');
  const itemCount: number = normalizeItemCount(options.itemCount, variant);

  state.setAttribute('role', 'status');
  state.setAttribute('aria-live', 'polite');
  state.setAttribute('aria-busy', 'true');
  status.className = 'async-state__visually-hidden';
  status.textContent = options.label ?? 'Loading content';
  skeleton.className = `async-state__skeleton async-state__skeleton--${variant}`;
  skeleton.setAttribute('aria-hidden', 'true');

  for (let index: number = 0; index < itemCount; index += 1) {
    skeleton.append(createSkeletonItem(variant));
  }

  state.append(status, skeleton);

  return state;
};

export const createBlockErrorState = (
  options: BlockErrorStateOptions,
): HTMLDivElement => {
  const state: HTMLDivElement = createStateRoot('error');
  const content: HTMLDivElement = document.createElement('div');
  const title: HTMLParagraphElement = document.createElement('p');
  const message: HTMLParagraphElement = document.createElement('p');
  const retryButton: HTMLButtonElement = document.createElement('button');

  state.setAttribute('role', 'alert');
  state.setAttribute('aria-atomic', 'true');
  content.className = 'async-state__content';
  title.className = 'async-state__title';
  title.textContent = options.title ?? "We couldn't load this section";
  message.className = 'async-state__message';
  message.textContent =
    options.message ?? 'Check your connection, then try again.';
  retryButton.className = 'btn btn--primary async-state__retry';
  retryButton.type = 'button';
  retryButton.textContent = options.retryLabel ?? 'Try again';
  retryButton.addEventListener('click', options.onRetry);
  content.append(title, message, retryButton);
  state.append(content);

  return state;
};

export const createEmptyState = (
  options: EmptyStateOptions = {},
): HTMLDivElement => {
  const state: HTMLDivElement = createStateRoot('empty');
  const content: HTMLDivElement = document.createElement('div');
  const title: HTMLParagraphElement = document.createElement('p');
  const message: HTMLParagraphElement = document.createElement('p');

  state.setAttribute('role', 'status');
  state.setAttribute('aria-live', 'polite');
  state.setAttribute('aria-atomic', 'true');
  content.className = 'async-state__content';
  title.className = 'async-state__title';
  title.textContent = options.title ?? 'Nothing to show';
  message.className = 'async-state__message';
  message.textContent =
    options.message ?? 'No items match the current criteria.';
  content.append(title, message);
  state.append(content);

  return state;
};
