export const AUTH_DIALOG_OPEN_EVENT: string = 'auth:open';

export type AuthMode = 'login' | 'register';

export interface AuthDialogRequestDetail {
  mode: AuthMode;
}

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
