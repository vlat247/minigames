import { createAuthDialog } from '../components/dialogs/auth-dialog';
import { createGameDetailsDialog } from '../components/dialogs/game-details-dialog';
import { createFooter } from '../components/footer/footer';
import { createHeader } from '../components/header/header';
import {
  createSnackbar,
  type SnackbarController,
} from '../components/snackbar/snackbar';
import {
  isSnackbarRequestDetail,
  SNACKBAR_SHOW_EVENT,
} from '../components/snackbar/snackbar-events';
import type { AppSession } from '../features/auth/app-session';
import type { UrlState } from './url-state';

export interface AppShell {
  readonly destroy: () => void;
  readonly notifications: SnackbarController;
  readonly outlet: HTMLElement;
  readonly setActivePath: (path: string) => void;
  readonly setSession: (session: AppSession | undefined) => void;
  readonly synchronizeDialogs: (state: UrlState) => void;
}

export const createAppShell = (rootElement: HTMLElement): AppShell => {
  const eventController: AbortController = new AbortController();
  const { signal } = eventController;
  const header = createHeader();
  const authDialog = createAuthDialog();
  const gameDetailsDialog = createGameDetailsDialog();
  const notifications: SnackbarController = createSnackbar();
  const outlet: HTMLElement = document.createElement('main');
  outlet.id = 'main-content';

  rootElement.replaceChildren(
    header.element,
    outlet,
    createFooter(),
    authDialog.element,
    gameDetailsDialog.element,
    notifications.element,
  );

  const placeNotificationRegion = (state?: UrlState): void => {
    let host: HTMLElement = rootElement;
    const currentHost: HTMLElement | null = notifications.element.parentElement;

    if (state?.game !== undefined && gameDetailsDialog.element.open) {
      host = gameDetailsDialog.element;
    } else if (state?.auth !== undefined && authDialog.element.open) {
      host = authDialog.element;
    } else if (currentHost instanceof HTMLDialogElement && currentHost.open) {
      host = currentHost;
    } else if (gameDetailsDialog.element.open) {
      host = gameDetailsDialog.element;
    } else if (authDialog.element.open) {
      host = authDialog.element;
    }

    if (notifications.element.parentElement !== host) {
      host.append(notifications.element);
    }
  };

  authDialog.element.addEventListener(
    'close',
    (): void => placeNotificationRegion(),
    { signal },
  );
  gameDetailsDialog.element.addEventListener(
    'close',
    (): void => placeNotificationRegion(),
    { signal },
  );

  document.addEventListener(
    SNACKBAR_SHOW_EVENT,
    (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (isSnackbarRequestDetail(detail)) {
        notifications.show(detail);
      }
    },
    { signal },
  );

  return {
    destroy: (): void => {
      eventController.abort();
      header.destroy();
      authDialog.destroy();
      gameDetailsDialog.destroy();
      notifications.destroy();
      rootElement.replaceChildren();
    },
    notifications,
    outlet,
    setActivePath: (path: string): void => {
      header.closeMenu();
      header.setActivePath(path);
    },
    setSession: (session: AppSession | undefined): void => {
      header.setSession(session);
    },
    synchronizeDialogs: (state: UrlState): void => {
      authDialog.synchronize(state.auth);
      gameDetailsDialog.synchronize(state.game);
      placeNotificationRegion(state);
    },
  };
};
