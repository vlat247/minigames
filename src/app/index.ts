import '../styles/main.scss';
import { createAppShell, type AppShell } from './app-shell';
import { Router } from './router';
import { homePage } from '../pages/home/home';
import { notFoundPage } from '../pages/not-found/not-found';

const ROOT_ELEMENT_ID: string = 'app';

const createRootElement = (): HTMLDivElement => {
  const rootElement: HTMLDivElement = document.createElement('div');
  rootElement.id = ROOT_ELEMENT_ID;
  document.body.prepend(rootElement);

  return rootElement;
};

const initializeApp = (): void => {
  const rootElement: HTMLDivElement = createRootElement();
  const shell: AppShell = createAppShell(rootElement);
  const router: Router = new Router(shell.outlet, shell.setActivePath);

  router.addRoute('/', homePage);
  router.addRoute('*', notFoundPage);
  router.start();

  import.meta.hot?.dispose((): void => {
    router.stop();
    shell.destroy();
    rootElement.remove();
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
} else {
  initializeApp();
}
