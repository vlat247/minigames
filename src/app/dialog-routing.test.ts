import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ALREADY_AUTHENTICATED_MESSAGE,
  connectDialogRouting,
  type DialogSessionGuard,
} from './dialog-routing';
import { Router } from './router';
import { dispatchAuthDialogRequest } from '../components/dialogs/auth-dialog-events';
import {
  SNACKBAR_SHOW_EVENT,
  isSnackbarRequestDetail,
} from '../components/snackbar/snackbar-events';
import type { SnackbarOptions } from '../components/snackbar/snackbar';
import type { AppShell } from './app-shell';
import type { AppSession } from '../features/auth/app-session';

const ACTIVE_SESSION: AppSession = {
  authenticatedAt: 1_789_012_345_000,
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
};

interface DialogRoutingHarness {
  readonly cleanup: () => void;
  readonly sessionGuard: DialogSessionGuard;
  readonly synchronizeDialogs: ReturnType<typeof vi.fn>;
}

const cleanups: (() => void)[] = [];

const createHarness = (
  getSession: () => AppSession | undefined,
): DialogRoutingHarness => {
  const outlet = document.createElement('main');
  const synchronizeDialogs = vi.fn();
  const shell: Pick<AppShell, 'synchronizeDialogs'> = { synchronizeDialogs };
  const sessionGuard: DialogSessionGuard = {
    requireActiveSession: vi.fn(getSession),
  };
  const router = new Router(outlet);
  router.addRoute('/', () => ({ content: document.createElement('section') }));
  const disconnect = connectDialogRouting(router, shell, sessionGuard);
  const cleanup = (): void => {
    disconnect();
    router.stop();
  };
  cleanups.push(cleanup);
  router.start();

  return { cleanup, sessionGuard, synchronizeDialogs };
};

const collectSnackbarMessages = (): SnackbarOptions[] => {
  const messages: SnackbarOptions[] = [];
  const eventController = new AbortController();
  cleanups.push((): void => eventController.abort());

  document.addEventListener(
    SNACKBAR_SHOW_EVENT,
    (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (isSnackbarRequestDetail(detail)) {
        messages.push(detail);
      }
    },
    { signal: eventController.signal },
  );

  return messages;
};

afterEach(() => {
  for (const cleanup of cleanups.splice(0).toReversed()) {
    cleanup();
  }
});

describe('authenticated Auth dialog guard', () => {
  it('blocks a UI Auth request without adding browser history', () => {
    globalThis.history.replaceState({}, '', '/?campaign=autumn#games');
    const messages = collectSnackbarMessages();
    const pushState = vi.spyOn(globalThis.history, 'pushState');
    const { synchronizeDialogs } = createHarness(() => ACTIVE_SESSION);

    dispatchAuthDialogRequest('login');

    expect(globalThis.location.href).toBe(
      'http://localhost/?campaign=autumn#games',
    );
    expect(pushState).not.toHaveBeenCalled();
    expect(synchronizeDialogs.mock.lastCall?.[0]?.auth).toBeUndefined();
    expect(messages).toEqual([
      { message: ALREADY_AUTHENTICATED_MESSAGE, variant: 'success' },
    ]);
  });

  it('replaces a direct Auth URL while preserving other state and the hash', () => {
    globalThis.history.replaceState(
      {
        keep: 'this state',
        miniGamesDialog: { baseHref: 'http://localhost/', kind: 'auth' },
      },
      '',
      '/?auth=register&campaign=spring&filter=cozy#comments',
    );
    const replaceState = vi.spyOn(globalThis.history, 'replaceState');
    const pushState = vi.spyOn(globalThis.history, 'pushState');
    const messages = collectSnackbarMessages();

    createHarness(() => ACTIVE_SESSION);

    expect(globalThis.location.pathname).toBe('/');
    expect(globalThis.location.search).toBe('?campaign=spring&filter=cozy');
    expect(globalThis.location.hash).toBe('#comments');
    expect(globalThis.history.state).toEqual({ keep: 'this state' });
    expect(replaceState).toHaveBeenCalledOnce();
    expect(pushState).not.toHaveBeenCalled();
    expect(messages).toHaveLength(1);
  });

  it('allows an Auth URL after recovery identifies the user as a guest', () => {
    globalThis.history.replaceState(
      {},
      '',
      '/?auth=login&campaign=expired#dialog',
    );
    const messages = collectSnackbarMessages();
    const getGuestSession = vi.fn<() => AppSession | undefined>();
    const { synchronizeDialogs } = createHarness(getGuestSession);

    expect(globalThis.location.search).toBe('?auth=login&campaign=expired');
    expect(globalThis.location.hash).toBe('#dialog');
    expect(synchronizeDialogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ auth: 'login' }),
    );
    expect(messages).toEqual([]);
  });

  it('guards Auth state restored through browser history', () => {
    globalThis.history.replaceState({}, '', '/?campaign=initial');
    const messages = collectSnackbarMessages();
    const { synchronizeDialogs } = createHarness(() => ACTIVE_SESSION);
    synchronizeDialogs.mockClear();

    globalThis.history.pushState(
      { source: 'history' },
      '',
      '/?auth=login&campaign=history#restored',
    );
    globalThis.dispatchEvent(new PopStateEvent('popstate'));

    expect(globalThis.location.search).toBe('?campaign=history');
    expect(globalThis.location.hash).toBe('#restored');
    expect(globalThis.history.state).toEqual({ source: 'history' });
    expect(synchronizeDialogs).toHaveBeenCalledOnce();
    expect(synchronizeDialogs.mock.lastCall?.[0]?.auth).toBeUndefined();
    expect(messages).toHaveLength(1);
  });

  it('revalidates the session before opening Auth for a guest', () => {
    globalThis.history.replaceState({}, '', '/');
    const getGuestSession = vi.fn<() => AppSession | undefined>();
    const { sessionGuard, synchronizeDialogs } = createHarness(getGuestSession);
    vi.mocked(sessionGuard.requireActiveSession).mockClear();

    dispatchAuthDialogRequest('register');

    expect(sessionGuard.requireActiveSession).toHaveBeenCalledTimes(2);
    expect(globalThis.location.search).toBe('?auth=register');
    expect(synchronizeDialogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ auth: 'register' }),
    );
  });
});
