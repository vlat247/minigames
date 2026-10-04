import type { SnackbarOptions, SnackbarVariant } from './snackbar';

export const SNACKBAR_SHOW_EVENT: string = 'snackbar:show';

const isSnackbarVariant = (value: unknown): value is SnackbarVariant => {
  return value === 'error' || value === 'success';
};

export const dispatchSnackbar = (options: SnackbarOptions): void => {
  document.dispatchEvent(
    new CustomEvent<SnackbarOptions>(SNACKBAR_SHOW_EVENT, {
      detail: options,
    }),
  );
};

export const isSnackbarRequestDetail = (
  value: unknown,
): value is SnackbarOptions => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('message' in value) ||
    !('variant' in value) ||
    typeof value.message !== 'string' ||
    value.message.trim().length === 0 ||
    !isSnackbarVariant(value.variant)
  ) {
    return false;
  }

  const hasInvalidDismissible: boolean =
    'dismissible' in value &&
    value.dismissible !== undefined &&
    typeof value.dismissible !== 'boolean';
  const hasInvalidDuration: boolean =
    'durationMs' in value &&
    value.durationMs !== undefined &&
    (typeof value.durationMs !== 'number' ||
      !Number.isFinite(value.durationMs));

  return !hasInvalidDismissible && !hasInvalidDuration;
};
