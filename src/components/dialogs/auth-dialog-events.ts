import type { AuthMode } from '../../app/url-state';

export const AUTH_DIALOG_OPEN_EVENT: string = 'auth:open';
export const AUTH_DIALOG_CLOSE_REQUEST_EVENT: string = 'auth:close-request';

export type { AuthMode } from '../../app/url-state';

export interface AuthDialogRequestDetail {
  readonly mode: AuthMode;
}

export const dispatchAuthDialogRequest = (mode: AuthMode): void => {
  document.dispatchEvent(
    new CustomEvent<AuthDialogRequestDetail>(AUTH_DIALOG_OPEN_EVENT, {
      detail: { mode },
    }),
  );
};

export const dispatchAuthDialogCloseRequest = (): void => {
  document.dispatchEvent(new Event(AUTH_DIALOG_CLOSE_REQUEST_EVENT));
};

export const isAuthDialogRequestDetail = (
  value: unknown,
): value is AuthDialogRequestDetail => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'mode' in value &&
    (value.mode === 'login' || value.mode === 'register')
  );
};
