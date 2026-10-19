import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSnackbar } from './snackbar';
import {
  dispatchSnackbar,
  isSnackbarRequestDetail,
  SNACKBAR_SHOW_EVENT,
} from './snackbar-events';

const EXIT_TRANSITION_MS = 180;

afterEach(() => {
  vi.useRealTimers();
});

describe('snackbar', () => {
  it('renders accessible success, warning, and error notifications as text', () => {
    const snackbar = createSnackbar();
    document.body.append(snackbar.element);

    expect(snackbar.element.getAttribute('role')).toBe('region');
    expect(snackbar.element.getAttribute('aria-label')).toBe('Notifications');

    snackbar.show({
      message: '<strong>Saved</strong>',
      variant: 'success',
    });

    expect(snackbar.element.getAttribute('aria-live')).toBe('polite');
    expect(
      snackbar.element.querySelector('.snackbar__label')?.textContent,
    ).toBe('Success');
    expect(
      snackbar.element.querySelector('.snackbar__message')?.textContent,
    ).toBe('<strong>Saved</strong>');
    expect(snackbar.element.querySelector('strong')).toBeNull();

    snackbar.show({ message: 'Sign in to continue', variant: 'warning' });

    expect(snackbar.element.getAttribute('aria-live')).toBe('polite');
    expect(
      snackbar.element.querySelector('.snackbar__label')?.textContent,
    ).toBe('Warning');
    expect(snackbar.element.querySelector('.snackbar')?.classList).toContain(
      'snackbar--warning',
    );

    snackbar.show({ message: 'Request failed', variant: 'error' });

    expect(snackbar.element.getAttribute('aria-live')).toBe('assertive');
    expect(
      snackbar.element.querySelector('.snackbar__label')?.textContent,
    ).toBe('Error');
    expect(snackbar.element.querySelectorAll('.snackbar')).toHaveLength(1);
  });

  it('dispatches and validates supported notification requests', () => {
    const listener = vi.fn<(event: Event) => void>();
    document.addEventListener(SNACKBAR_SHOW_EVENT, listener);

    dispatchSnackbar({
      dismissible: false,
      durationMs: 2400,
      message: 'Authentication required',
      variant: 'warning',
    });

    expect(listener).toHaveBeenCalledTimes(1);
    const [event] = listener.mock.calls[0] ?? [];
    expect(event).toBeInstanceOf(CustomEvent);
    expect(
      isSnackbarRequestDetail((event as CustomEvent<unknown>).detail),
    ).toBe(true);
    expect(
      [
        null,
        {},
        { message: ' ', variant: 'warning' },
        { message: 'Nope', variant: 'info' },
        { dismissible: 'yes', message: 'Nope', variant: 'error' },
        {
          durationMs: Infinity,
          message: 'Nope',
          variant: 'error',
        },
      ].every((detail: unknown): boolean => !isSnackbarRequestDetail(detail)),
    ).toBe(true);

    document.removeEventListener(SNACKBAR_SHOW_EVENT, listener);
  });

  it('clamps short durations and removes a notification after its exit', () => {
    vi.useFakeTimers();
    const snackbar = createSnackbar();
    document.body.append(snackbar.element);
    snackbar.show({
      durationMs: 10,
      message: 'Brief update',
      variant: 'success',
    });

    vi.advanceTimersByTime(20);
    expect(
      snackbar.element
        .querySelector('.snackbar')
        ?.classList.contains('snackbar--visible'),
    ).toBe(true);

    vi.advanceTimersByTime(979);
    expect(snackbar.element.querySelector('.snackbar')).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(
      snackbar.element
        .querySelector('.snackbar')
        ?.classList.contains('snackbar--visible'),
    ).toBe(false);
    vi.advanceTimersByTime(EXIT_TRANSITION_MS);
    expect(snackbar.element.querySelector('.snackbar')).toBeNull();
  });

  it.each([
    { durationMs: NaN, expectedDuration: 5000 },
    { durationMs: 50_000, expectedDuration: 30_000 },
  ])(
    'normalizes a $durationMs duration to $expectedDuration ms',
    ({ durationMs, expectedDuration }) => {
      vi.useFakeTimers();
      const snackbar = createSnackbar();
      snackbar.show({
        durationMs,
        message: 'Timed notification',
        variant: 'success',
      });

      vi.advanceTimersByTime(expectedDuration - 1);
      expect(snackbar.element.querySelector('.snackbar')).not.toBeNull();
      vi.advanceTimersByTime(1 + EXIT_TRANSITION_MS);
      expect(snackbar.element.querySelector('.snackbar')).toBeNull();
    },
  );

  it('supports delegated manual dismissal and ignores repeated dismissals', () => {
    vi.useFakeTimers();
    const snackbar = createSnackbar();
    snackbar.show({ message: 'Dismiss me', variant: 'error' });
    const closeButton = snackbar.element.querySelector<HTMLButtonElement>(
      '[data-snackbar-dismiss]',
    );

    expect(closeButton).not.toBeNull();
    closeButton?.click();
    snackbar.dismiss();
    vi.advanceTimersByTime(EXIT_TRANSITION_MS);

    expect(snackbar.element.querySelector('.snackbar')).toBeNull();
    snackbar.dismiss();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replaces active content, supports non-dismissible notices, and cleans up', () => {
    vi.useFakeTimers();
    const snackbar = createSnackbar();
    snackbar.show({ message: 'First', variant: 'success' });
    snackbar.show({
      dismissible: false,
      message: 'Second',
      variant: 'error',
    });

    expect(snackbar.element.querySelectorAll('.snackbar')).toHaveLength(1);
    expect(snackbar.element.textContent).toContain('Second');
    expect(snackbar.element.textContent).not.toContain('First');
    expect(
      snackbar.element.querySelector('[data-snackbar-dismiss]'),
    ).toBeNull();

    snackbar.destroy();

    expect(snackbar.element.childElementCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    snackbar.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
});
