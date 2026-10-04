import { createAuthDialog } from '../components/dialogs/auth-dialog';
import { createGameDetailsDialog } from '../components/dialogs/game-details-dialog';
import { createFooter } from '../components/footer/footer';
import { createHeader } from '../components/header/header';
import {
  createSnackbar,
  type SnackbarController,
} from '../components/snackbar/snackbar';
import type { UrlState } from './url-state';

export interface AppShell {
  readonly destroy: () => void;
  readonly notifications: SnackbarController;
  readonly outlet: HTMLElement;
  readonly setActivePath: (path: string) => void;
  readonly synchronizeDialogs: (state: UrlState) => void;
}

export const createAppShell = (rootElement: HTMLElement): AppShell => {
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

  return {
    destroy: (): void => {
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
    synchronizeDialogs: (state: UrlState): void => {
      authDialog.synchronize(state.auth);
      gameDetailsDialog.synchronize(state.game);
    },
  };
};
