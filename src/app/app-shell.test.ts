import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAuthDialog,
  type AuthDialogController,
} from '../components/dialogs/auth-dialog';
import {
  createGameDetailsDialog,
  type GameDetailsDialogController,
} from '../components/dialogs/game-details-dialog';
import { createFooter } from '../components/footer/footer';
import {
  createHeader,
  type HeaderController,
} from '../components/header/header';
import {
  createSnackbar,
  type SnackbarController,
} from '../components/snackbar/snackbar';
import { SNACKBAR_SHOW_EVENT } from '../components/snackbar/snackbar-events';
import type { AppSession } from '../features/auth/app-session';
import type { AuthenticationService } from '../features/auth/authentication-service';
import type { AuthenticatedGameActionsService } from '../features/game-actions/authenticated-game-actions';
import { createAppShell, type AppShell } from './app-shell';
import type { UrlState } from './url-state';

vi.mock('../components/dialogs/auth-dialog', () => ({
  createAuthDialog: vi.fn(),
}));

vi.mock('../components/dialogs/game-details-dialog', () => ({
  createGameDetailsDialog: vi.fn(),
}));

vi.mock('../components/footer/footer', () => ({
  createFooter: vi.fn(),
}));

vi.mock('../components/header/header', () => ({
  createHeader: vi.fn(),
}));

vi.mock('../components/snackbar/snackbar', () => ({
  createSnackbar: vi.fn(),
}));

interface ShellFixture {
  readonly authDialog: AuthDialogController;
  readonly footer: HTMLElement;
  readonly gameDetailsDialog: GameDetailsDialogController;
  readonly header: HeaderController;
  readonly notifications: SnackbarController;
  readonly root: HTMLDivElement;
  readonly shell: AppShell;
}

const SESSION: AppSession = {
  authenticatedAt: 1_789_012_345_000,
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
};

const DEFAULT_STATE: UrlState = {
  auth: undefined,
  category: 'all',
  game: undefined,
  page: 1,
  sort: 'rating-desc',
};

const shells: AppShell[] = [];

const createFixture = (): ShellFixture => {
  const header: HeaderController = {
    closeMenu: vi.fn(),
    destroy: vi.fn(),
    element: document.createElement('header'),
    setActivePath: vi.fn(),
    setSession: vi.fn(),
  };
  const authDialog: AuthDialogController = {
    destroy: vi.fn(),
    element: document.createElement('dialog'),
    setAuthenticationService: vi.fn(),
    synchronize: vi.fn(),
  };
  const gameDetailsDialog: GameDetailsDialogController = {
    destroy: vi.fn(),
    element: document.createElement('dialog'),
    setGameActionsService: vi.fn(),
    setSession: vi.fn(),
    synchronize: vi.fn(),
  };
  const notifications: SnackbarController = {
    destroy: vi.fn(),
    dismiss: vi.fn(),
    element: document.createElement('section'),
    show: vi.fn(),
  };
  const footer: HTMLElement = document.createElement('footer');
  const root: HTMLDivElement = document.createElement('div');

  vi.mocked(createHeader).mockReturnValue(header);
  vi.mocked(createAuthDialog).mockReturnValue(authDialog);
  vi.mocked(createGameDetailsDialog).mockReturnValue(gameDetailsDialog);
  vi.mocked(createSnackbar).mockReturnValue(notifications);
  vi.mocked(createFooter).mockReturnValue(footer);

  const shell: AppShell = createAppShell(root);
  shells.push(shell);

  return {
    authDialog,
    footer,
    gameDetailsDialog,
    header,
    notifications,
    root,
    shell,
  };
};

afterEach(() => {
  for (const shell of shells.splice(0)) {
    shell.destroy();
  }
});

describe('app shell composition', () => {
  it('mounts the application regions in order and delegates shared state and services', () => {
    const fixture = createFixture();
    const authenticationService = {} as AuthenticationService;
    const gameActionsService = {} as AuthenticatedGameActionsService;

    expect([...fixture.root.children]).toEqual([
      fixture.header.element,
      fixture.shell.outlet,
      fixture.footer,
      fixture.authDialog.element,
      fixture.gameDetailsDialog.element,
      fixture.notifications.element,
    ]);
    expect(fixture.shell.outlet).toBeInstanceOf(HTMLElement);
    expect(fixture.shell.outlet.id).toBe('main-content');
    expect(fixture.shell.notifications).toBe(fixture.notifications);

    fixture.shell.setSession(SESSION);
    fixture.shell.setSession(undefined);
    expect(fixture.header.setSession).toHaveBeenNthCalledWith(1, SESSION);
    expect(fixture.gameDetailsDialog.setSession).toHaveBeenNthCalledWith(
      1,
      SESSION,
    );
    expect(fixture.header.setSession).toHaveBeenLastCalledWith(undefined);
    expect(fixture.gameDetailsDialog.setSession).toHaveBeenLastCalledWith(
      undefined,
    );

    fixture.shell.setAuthenticationService(authenticationService);
    fixture.shell.setGameActionsService(gameActionsService);
    expect(fixture.authDialog.setAuthenticationService).toHaveBeenCalledWith(
      authenticationService,
    );
    expect(
      fixture.gameDetailsDialog.setGameActionsService,
    ).toHaveBeenCalledWith(gameActionsService);

    fixture.shell.setActivePath('/library');
    expect(fixture.header.closeMenu).toHaveBeenCalledOnce();
    expect(fixture.header.setActivePath).toHaveBeenCalledWith('/library');

    fixture.shell.synchronizeDialogs({
      ...DEFAULT_STATE,
      auth: 'login',
    });
    expect(fixture.authDialog.synchronize).toHaveBeenCalledWith('login');
    expect(fixture.gameDetailsDialog.synchronize).toHaveBeenCalledWith(
      undefined,
    );
  });

  it('keeps notifications inside the active dialog and restores them to the app root', () => {
    const fixture = createFixture();

    fixture.gameDetailsDialog.element.open = true;
    fixture.shell.synchronizeDialogs({
      ...DEFAULT_STATE,
      game: 'tiny-gardens',
    });
    expect(fixture.notifications.element.parentElement).toBe(
      fixture.gameDetailsDialog.element,
    );

    fixture.gameDetailsDialog.element.open = false;
    fixture.authDialog.element.open = true;
    fixture.shell.synchronizeDialogs({
      ...DEFAULT_STATE,
      auth: 'register',
    });
    expect(fixture.notifications.element.parentElement).toBe(
      fixture.authDialog.element,
    );

    fixture.shell.synchronizeDialogs(DEFAULT_STATE);
    expect(fixture.notifications.element.parentElement).toBe(
      fixture.authDialog.element,
    );

    fixture.authDialog.element.open = false;
    fixture.authDialog.element.dispatchEvent(new Event('close'));
    expect(fixture.notifications.element.parentElement).toBe(fixture.root);

    fixture.gameDetailsDialog.element.open = true;
    fixture.shell.synchronizeDialogs(DEFAULT_STATE);
    expect(fixture.notifications.element.parentElement).toBe(
      fixture.gameDetailsDialog.element,
    );

    fixture.gameDetailsDialog.element.open = false;
    fixture.gameDetailsDialog.element.dispatchEvent(new Event('close'));
    expect(fixture.notifications.element.parentElement).toBe(fixture.root);

    fixture.authDialog.element.open = true;
    fixture.shell.synchronizeDialogs(DEFAULT_STATE);
    expect(fixture.notifications.element.parentElement).toBe(
      fixture.authDialog.element,
    );

    fixture.authDialog.element.open = false;
    fixture.shell.synchronizeDialogs(DEFAULT_STATE);
    expect(fixture.notifications.element.parentElement).toBe(fixture.root);
  });

  it('routes valid global notification requests and ignores malformed events', () => {
    const { notifications } = createFixture();

    document.dispatchEvent(new Event(SNACKBAR_SHOW_EVENT));
    document.dispatchEvent(
      new CustomEvent(SNACKBAR_SHOW_EVENT, {
        detail: { message: 'Missing a valid variant.', variant: 'info' },
      }),
    );
    expect(notifications.show).not.toHaveBeenCalled();

    const request = {
      dismissible: false,
      durationMs: 2500,
      message: 'Saved successfully.',
      variant: 'success' as const,
    };
    document.dispatchEvent(
      new CustomEvent(SNACKBAR_SHOW_EVENT, { detail: request }),
    );
    expect(notifications.show).toHaveBeenCalledOnce();
    expect(notifications.show).toHaveBeenCalledWith(request);
  });

  it('tears down every child controller, listener, and mounted node', () => {
    const fixture = createFixture();

    fixture.shell.destroy();

    expect(fixture.header.destroy).toHaveBeenCalledOnce();
    expect(fixture.authDialog.destroy).toHaveBeenCalledOnce();
    expect(fixture.gameDetailsDialog.destroy).toHaveBeenCalledOnce();
    expect(fixture.notifications.destroy).toHaveBeenCalledOnce();
    expect(fixture.root.childElementCount).toBe(0);

    document.dispatchEvent(
      new CustomEvent(SNACKBAR_SHOW_EVENT, {
        detail: { message: 'Too late.', variant: 'error' },
      }),
    );
    fixture.authDialog.element.dispatchEvent(new Event('close'));
    expect(fixture.notifications.show).not.toHaveBeenCalled();
    expect(fixture.root.childElementCount).toBe(0);
  });
});
