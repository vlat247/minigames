import './snackbar.scss';

const DEFAULT_DURATION_MS: number = 5000;
const MINIMUM_DURATION_MS: number = 1000;
const MAXIMUM_DURATION_MS: number = 30_000;
const EXIT_TRANSITION_MS: number = 180;

export type SnackbarVariant = 'error' | 'success';

export interface SnackbarOptions {
  readonly dismissible?: boolean;
  readonly durationMs?: number;
  readonly message: string;
  readonly variant: SnackbarVariant;
}

export interface SnackbarController {
  readonly destroy: () => void;
  readonly dismiss: () => void;
  readonly element: HTMLElement;
  readonly show: (options: SnackbarOptions) => void;
}

const variantLabels: Readonly<Record<SnackbarVariant, string>> = {
  error: 'Error',
  success: 'Success',
};

const normalizeDuration = (durationMs: number | undefined): number => {
  return durationMs === undefined || !Number.isFinite(durationMs)
    ? DEFAULT_DURATION_MS
    : Math.min(
        MAXIMUM_DURATION_MS,
        Math.max(MINIMUM_DURATION_MS, Math.floor(durationMs)),
      );
};

export const createSnackbar = (): SnackbarController => {
  const region: HTMLDivElement = document.createElement('div');
  const eventController: AbortController = new AbortController();
  const { signal } = eventController;
  let autoDismissTimer: number | undefined;
  let exitTimer: number | undefined;
  let showAnimationFrame: number | undefined;
  let notification: HTMLDivElement | undefined;

  region.className = 'snackbar-region';
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', 'Notifications');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');

  const clearTimers = (): void => {
    if (autoDismissTimer !== undefined) {
      globalThis.clearTimeout(autoDismissTimer);
      autoDismissTimer = undefined;
    }
    if (exitTimer !== undefined) {
      globalThis.clearTimeout(exitTimer);
      exitTimer = undefined;
    }
    if (showAnimationFrame === undefined) {
      return;
    }

    globalThis.cancelAnimationFrame(showAnimationFrame);
    showAnimationFrame = undefined;
  };

  const removeNotification = (): void => {
    notification?.remove();
    notification = undefined;
  };

  const dismiss = (): void => {
    if (notification === undefined || exitTimer !== undefined) {
      return;
    }

    if (autoDismissTimer !== undefined) {
      globalThis.clearTimeout(autoDismissTimer);
      autoDismissTimer = undefined;
    }
    if (showAnimationFrame !== undefined) {
      globalThis.cancelAnimationFrame(showAnimationFrame);
      showAnimationFrame = undefined;
    }

    notification.classList.remove('snackbar--visible');
    exitTimer = globalThis.setTimeout((): void => {
      exitTimer = undefined;
      removeNotification();
    }, EXIT_TRANSITION_MS);
  };

  const show = (options: SnackbarOptions): void => {
    clearTimers();
    removeNotification();

    const nextNotification: HTMLDivElement = document.createElement('div');
    const content: HTMLDivElement = document.createElement('div');
    const label: HTMLParagraphElement = document.createElement('p');
    const message: HTMLParagraphElement = document.createElement('p');
    const durationMs: number = normalizeDuration(options.durationMs);

    notification = nextNotification;
    region.setAttribute(
      'aria-live',
      options.variant === 'error' ? 'assertive' : 'polite',
    );
    nextNotification.className = `snackbar snackbar--${options.variant}`;
    content.className = 'snackbar__content';
    label.className = 'snackbar__label';
    label.textContent = variantLabels[options.variant];
    message.className = 'snackbar__message';
    message.textContent = options.message;
    content.append(label, message);
    nextNotification.append(content);

    if (options.dismissible !== false) {
      const closeButton: HTMLButtonElement = document.createElement('button');
      closeButton.className = 'snackbar__close';
      closeButton.type = 'button';
      closeButton.dataset.snackbarDismiss = '';
      closeButton.setAttribute('aria-label', 'Dismiss notification');
      nextNotification.append(closeButton);
    }

    region.append(nextNotification);
    showAnimationFrame = globalThis.requestAnimationFrame((): void => {
      nextNotification.classList.add('snackbar--visible');
      showAnimationFrame = undefined;
    });
    autoDismissTimer = globalThis.setTimeout(dismiss, durationMs);
  };

  region.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-snackbar-dismiss]') !== null
      ) {
        dismiss();
      }
    },
    { signal },
  );

  return {
    destroy: (): void => {
      clearTimers();
      removeNotification();
      eventController.abort();
    },
    dismiss,
    element: region,
    show,
  };
};
