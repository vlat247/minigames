import { afterEach } from 'vitest';

afterEach(() => {
  document.body.replaceChildren();
  globalThis.history.replaceState({}, '', '/');
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
});
