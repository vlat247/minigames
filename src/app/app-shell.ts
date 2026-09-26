import { createAuthDialog } from '../components/dialogs/auth-dialog';
import { createFooter } from '../components/footer/footer';
import { createHeader } from '../components/header/header';

export interface AppShell {
  readonly destroy: () => void;
  readonly outlet: HTMLElement;
  readonly setActivePath: (path: string) => void;
}

export const createAppShell = (rootElement: HTMLElement): AppShell => {
  const header = createHeader();
  const authDialog = createAuthDialog();
  const outlet: HTMLElement = document.createElement('main');
  outlet.id = 'main-content';

  rootElement.replaceChildren(
    header.element,
    outlet,
    createFooter(),
    authDialog.element,
  );

  return {
    destroy: (): void => {
      header.destroy();
      authDialog.destroy();
      rootElement.replaceChildren();
    },
    outlet,
    setActivePath: (path: string): void => {
      header.closeMenu();
      header.setActivePath(path);
    },
  };
};
