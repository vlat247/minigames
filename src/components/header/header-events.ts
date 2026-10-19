export const LOGOUT_REQUEST_EVENT: string = 'auth:logout-request';

export const dispatchLogoutRequest = (): void => {
  document.dispatchEvent(new Event(LOGOUT_REQUEST_EVENT));
};

export const isLogoutRequestEvent = (value: unknown): value is Event =>
  value instanceof Event && value.type === LOGOUT_REQUEST_EVENT;
