import '../styles/main.scss';
import { createAppShell, type AppShell } from './app-shell';
import { connectDialogRouting } from './dialog-routing';
import { Router } from './router';
import { homePage } from '../pages/home/home';
import { libraryPage } from '../pages/library/library';
import { notFoundPage } from '../pages/not-found/not-found';
import { initializeFirebase } from '../services/firebase';
import { LOGOUT_REQUEST_EVENT } from '../components/header/header-events';
import { createAuthenticationService } from '../features/auth/authentication-service';
import { createSessionController } from '../features/auth/session-controller';

const ROOT_ELEMENT_ID: string = 'app';

const createRootElement = (): HTMLDivElement => {
  const rootElement: HTMLDivElement = document.createElement('div');
  rootElement.id = ROOT_ELEMENT_ID;
  document.body.prepend(rootElement);

  return rootElement;
};

const initializeApp = (): void => {
  const { auth } = initializeFirebase();
  const rootElement: HTMLDivElement = createRootElement();
  const shell: AppShell = createAppShell(rootElement);
  const sessionController = createSessionController({ auth });
  const authenticationService = createAuthenticationService({
    auth,
    sessionController,
  });
  const eventController = new AbortController();
  const unsubscribeSession = sessionController.subscribe(shell.setSession);
  const router: Router = new Router(shell.outlet, shell.setActivePath, {
    beforeNavigation: (): void => {
      sessionController.requireActiveSession();
    },
  });

  document.addEventListener(
    LOGOUT_REQUEST_EVENT,
    (): void => {
      void sessionController.logout();
    },
    { signal: eventController.signal },
  );

  router.addRoute('/', homePage);
  router.addRoute('/library', libraryPage);
  router.addRoute('*', notFoundPage);
  const disconnectDialogRouting: () => void = connectDialogRouting(
    router,
    shell,
    sessionController,
  );
  shell.setAuthenticationService(authenticationService);
  router.start();

  import.meta.hot?.dispose((): void => {
    eventController.abort();
    disconnectDialogRouting();
    router.stop();
    unsubscribeSession();
    sessionController.destroy();
    shell.destroy();
    rootElement.remove();
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
} else {
  initializeApp();
}
