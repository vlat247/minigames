import type { Auth } from 'firebase/auth';
import { describe, expect, it, vi } from 'vitest';

import { createAppShell, type AppShell } from './app-shell';
import { connectDialogRouting } from './dialog-routing';
import { Router } from './router';
import { dispatchLogoutRequest } from '../components/header/header-events';
import {
  createAuthenticationService,
  type AuthenticationService,
} from '../features/auth/authentication-service';
import {
  createAuthenticatedGameActionsService,
  type AuthenticatedGameActionsService,
} from '../features/game-actions/authenticated-game-actions';
import {
  createSessionController,
  type SessionController,
} from '../features/auth/session-controller';
import { homePage } from '../pages/home/home';
import { libraryPage } from '../pages/library/library';
import { notFoundPage } from '../pages/not-found/not-found';
import { initializeFirebase } from '../services/firebase';

vi.mock('./app-shell', () => ({
  createAppShell: vi.fn(),
}));

vi.mock('./dialog-routing', () => ({
  connectDialogRouting: vi.fn(),
}));

vi.mock('./router', () => ({
  Router: vi.fn(),
}));

vi.mock('../features/auth/authentication-service', () => ({
  createAuthenticationService: vi.fn(),
}));

vi.mock('../features/auth/session-controller', () => ({
  createSessionController: vi.fn(),
}));

vi.mock('../features/game-actions/authenticated-game-actions', () => ({
  createAuthenticatedGameActionsService: vi.fn(),
}));

vi.mock('../pages/home/home', () => ({
  homePage: vi.fn(),
}));

vi.mock('../pages/library/library', () => ({
  libraryPage: vi.fn(),
}));

vi.mock('../pages/not-found/not-found', () => ({
  notFoundPage: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  initializeFirebase: vi.fn(),
}));

describe('application startup', () => {
  it('waits for the DOM, composes authenticated services, registers routes, and handles logout', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const auth = {} as Auth;
    const outlet = document.createElement('main');
    const setActivePath = vi.fn();
    const setSession = vi.fn();
    const shell = {
      destroy: vi.fn(),
      notifications: {
        destroy: vi.fn(),
        dismiss: vi.fn(),
        element: document.createElement('section'),
        show: vi.fn(),
      },
      outlet,
      setActivePath,
      setAuthenticationService: vi.fn(),
      setGameActionsService: vi.fn(),
      setSession,
      synchronizeDialogs: vi.fn(),
    } satisfies AppShell;
    const unsubscribeSession = vi.fn();
    const logout = vi.fn(async (): Promise<void> => undefined);
    const requireActiveSession = vi.fn();
    const sessionController = {
      destroy: vi.fn(),
      logout,
      requireActiveSession,
      subscribe: vi.fn(() => unsubscribeSession),
    } as unknown as SessionController;
    const authenticationService = {} as AuthenticationService;
    const gameActionsService = {} as AuthenticatedGameActionsService;
    const addRoute = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    class RouterFixture {
      public readonly addRoute = addRoute;

      public readonly start = start;

      public readonly stop = stop;
    }
    const disconnectDialogRouting = vi.fn();

    vi.mocked(initializeFirebase).mockReturnValue({
      app: {} as never,
      auth,
    });
    vi.mocked(createAppShell).mockReturnValue(shell);
    vi.mocked(createSessionController).mockReturnValue(sessionController);
    vi.mocked(createAuthenticationService).mockReturnValue(
      authenticationService,
    );
    vi.mocked(createAuthenticatedGameActionsService).mockReturnValue(
      gameActionsService,
    );
    vi.mocked(Router).mockImplementation(
      RouterFixture as unknown as typeof Router,
    );
    vi.mocked(connectDialogRouting).mockReturnValue(disconnectDialogRouting);

    await import('./index');

    expect(initializeFirebase).not.toHaveBeenCalled();
    expect(document.querySelector('#app')).toBeNull();

    document.dispatchEvent(new Event('DOMContentLoaded'));

    const root = document.querySelector<HTMLDivElement>('#app');
    expect(root).not.toBeNull();
    expect(document.body.firstElementChild).toBe(root);
    expect(initializeFirebase).toHaveBeenCalledOnce();
    expect(createAppShell).toHaveBeenCalledWith(root);
    expect(createSessionController).toHaveBeenCalledWith({ auth });
    expect(createAuthenticationService).toHaveBeenCalledWith({
      auth,
      sessionController,
    });
    expect(createAuthenticatedGameActionsService).toHaveBeenCalledWith({
      sessionController,
    });
    expect(sessionController.subscribe).toHaveBeenCalledWith(setSession);
    expect(Router).toHaveBeenCalledWith(outlet, setActivePath, {
      beforeNavigation: expect.any(Function),
    });
    const router = vi.mocked(Router).mock.instances[0] as unknown as Router;
    expect(connectDialogRouting).toHaveBeenCalledWith(
      router,
      shell,
      sessionController,
    );
    expect(shell.setAuthenticationService).toHaveBeenCalledWith(
      authenticationService,
    );
    expect(shell.setGameActionsService).toHaveBeenCalledWith(
      gameActionsService,
    );
    expect(addRoute).toHaveBeenNthCalledWith(1, '/', homePage);
    expect(addRoute).toHaveBeenNthCalledWith(2, '/library', libraryPage);
    expect(addRoute).toHaveBeenNthCalledWith(3, '*', notFoundPage);
    expect(start).toHaveBeenCalledOnce();

    const routerOptions = vi.mocked(Router).mock.calls[0]?.[2];
    routerOptions?.beforeNavigation?.('push');
    expect(requireActiveSession).toHaveBeenCalledOnce();

    dispatchLogoutRequest();
    expect(logout).toHaveBeenCalledOnce();

    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(initializeFirebase).toHaveBeenCalledOnce();
  });
});
