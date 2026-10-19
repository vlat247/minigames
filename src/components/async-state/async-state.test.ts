import { describe, expect, it, vi } from 'vitest';

import {
  createBlockErrorState,
  createEmptyState,
  createSkeletonState,
  type SkeletonVariant,
} from './async-state';

describe('async state components', () => {
  it.each([
    { expectedCount: 3, itemModifier: 'card', variant: 'cards' },
    { expectedCount: 1, itemModifier: 'details', variant: 'details' },
    { expectedCount: 5, itemModifier: 'row', variant: 'rows' },
  ] satisfies readonly {
    readonly expectedCount: number;
    readonly itemModifier: string;
    readonly variant: SkeletonVariant;
  }[])(
    'renders the default $variant skeleton',
    ({ expectedCount, itemModifier, variant }) => {
      const state = createSkeletonState({ variant });

      expect(state.dataset.asyncState).toBe('loading');
      expect(state.getAttribute('role')).toBe('status');
      expect(state.getAttribute('aria-busy')).toBe('true');
      expect(state.textContent).toContain('Loading content');
      expect(
        state.querySelectorAll('.async-state__skeleton-item'),
      ).toHaveLength(expectedCount);
      expect(
        state.querySelector(`.async-state__skeleton--${variant}`),
      ).not.toBeNull();
      expect(
        state.querySelector(`.async-state__skeleton-item--${itemModifier}`),
      ).not.toBeNull();
    },
  );

  it.each([
    { expectedCount: 1, itemCount: -5 },
    { expectedCount: 2, itemCount: 2.9 },
    { expectedCount: 12, itemCount: 99 },
    { expectedCount: 3, itemCount: Infinity },
  ])(
    'normalizes a requested skeleton count of $itemCount',
    ({ expectedCount, itemCount }) => {
      const state = createSkeletonState({
        itemCount,
        label: 'Loading test records',
      });

      expect(state.textContent).toContain('Loading test records');
      expect(
        state.querySelectorAll('.async-state__skeleton-item'),
      ).toHaveLength(expectedCount);
    },
  );

  it('renders an actionable error state with defaults', () => {
    const onRetry = vi.fn();
    const state = createBlockErrorState({ onRetry });
    const retry = state.querySelector<HTMLButtonElement>('button');

    expect(state.dataset.asyncState).toBe('error');
    expect(state.getAttribute('role')).toBe('alert');
    expect(state.textContent).toContain("We couldn't load this section");
    expect(state.textContent).toContain('Check your connection');
    expect(retry?.textContent).toBe('Try again');

    retry?.click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders custom error and empty-state copy', () => {
    const onRetry = vi.fn();
    const error = createBlockErrorState({
      message: 'The scores are temporarily unavailable.',
      onRetry,
      retryLabel: 'Reload scores',
      title: 'Scores unavailable',
    });
    const empty = createEmptyState({
      message: 'Change the filters and try again.',
      title: 'No matching games',
    });

    expect(error.textContent).toContain('Scores unavailable');
    expect(error.textContent).toContain(
      'The scores are temporarily unavailable.',
    );
    expect(error.querySelector('button')?.textContent).toBe('Reload scores');
    expect(empty.dataset.asyncState).toBe('empty');
    expect(empty.getAttribute('role')).toBe('status');
    expect(empty.textContent).toContain('No matching games');
    expect(empty.textContent).toContain('Change the filters and try again.');
  });

  it('uses accessible default empty-state copy', () => {
    const empty = createEmptyState();

    expect(empty.getAttribute('aria-live')).toBe('polite');
    expect(empty.getAttribute('aria-atomic')).toBe('true');
    expect(empty.textContent).toContain('Nothing to show');
    expect(empty.textContent).toContain('No items match the current criteria.');
  });
});
