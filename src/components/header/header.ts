import './header.scss';
import {
  AUTH_DIALOG_OPEN_EVENT,
  type AuthDialogRequestDetail,
  type AuthMode,
} from '../dialogs/auth-dialog-events';
import { getAppPath } from '../../utils/paths';

export interface HeaderController {
  readonly closeMenu: () => void;
  readonly destroy: () => void;
  readonly element: HTMLElement;
  readonly setActivePath: (path: string) => void;
}

const dispatchAuthRequest = (mode: AuthMode): void => {
  const event: CustomEvent<AuthDialogRequestDetail> =
    new CustomEvent<AuthDialogRequestDetail>(AUTH_DIALOG_OPEN_EVENT, {
      detail: { mode },
    });

  document.dispatchEvent(event);
};

export const createHeader = (): HeaderController => {
  const homePath: string = getAppPath('/');
  const libraryPath: string = getAppPath('/library');
  const logoPath: string = getAppPath('/assets/icons/logo.png');
  const header: HTMLElement = document.createElement('header');
  const eventController: AbortController = new AbortController();
  const { signal } = eventController;
  header.className = 'site-header';
  header.innerHTML = `
    <div class="site-header__inner">
      <a class="site-header__brand" href="${homePath}" data-link aria-label="MiniGames home">
        <img class="site-header__logo" src="${logoPath}" alt="" width="32" height="32" />
        <span>MiniGames</span>
      </a>

      <nav class="site-header__desktop-nav" aria-label="Primary navigation">
        <a class="site-header__nav-link" href="${homePath}" data-link data-nav-path="/">Home</a>
        <a class="site-header__nav-link" href="${libraryPath}" data-link data-nav-path="/library">Library</a>
        <a class="site-header__nav-link" href="${homePath}" data-link>Tournaments</a>
        <a class="site-header__nav-link" href="${homePath}" data-link>Community</a>
      </nav>

      <div class="site-header__desktop-actions">
        <button class="btn btn--secondary" type="button" data-auth-mode="login">Log In</button>
        <button class="btn btn--primary" type="button" data-auth-mode="register">Sign Up</button>
      </div>

      <div class="site-header__compact-actions">
        <button class="btn btn--primary site-header__compact-sign-up" type="button" data-auth-mode="register">Sign Up</button>
        <button
          class="site-header__menu-toggle"
          type="button"
          aria-expanded="false"
          aria-controls="mobile-navigation"
          aria-label="Open navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>

    <div class="mobile-menu" id="mobile-navigation" aria-hidden="true">
      <a class="mobile-menu__brand" href="${homePath}" data-link aria-label="MiniGames home">
        <img src="${logoPath}" alt="" width="32" height="32" />
        <span>MiniGames</span>
      </a>

      <nav class="mobile-menu__nav" aria-label="Mobile navigation">
        <a class="mobile-menu__link" href="${homePath}" data-link data-nav-path="/">Home</a>
        <a class="mobile-menu__link" href="${libraryPath}" data-link data-nav-path="/library">Library</a>
        <a class="mobile-menu__link" href="${homePath}" data-link>Tournaments</a>
        <a class="mobile-menu__link" href="${homePath}" data-link>Community</a>
      </nav>

      <div class="mobile-menu__actions">
        <button class="btn btn--secondary" type="button" data-auth-mode="login">Log In</button>
        <button class="btn btn--primary" type="button" data-auth-mode="register">Sign Up</button>
      </div>
    </div>
  `;

  const navigationLinks: NodeListOf<HTMLAnchorElement> =
    header.querySelectorAll<HTMLAnchorElement>('a[data-nav-path]');
  const setActivePath = (path: string): void => {
    for (const link of navigationLinks) {
      const isActive: boolean = link.dataset.navPath === path;
      link.classList.toggle(
        'site-header__nav-link--active',
        isActive && link.classList.contains('site-header__nav-link'),
      );
      link.classList.toggle(
        'mobile-menu__link--active',
        isActive && link.classList.contains('mobile-menu__link'),
      );

      link.toggleAttribute('aria-current', isActive);
      if (isActive) {
        link.ariaCurrent = 'page';
      }
    }
  };

  const menu: HTMLElement | null = header.querySelector('.mobile-menu');
  const menuToggle: HTMLButtonElement | null = header.querySelector(
    '.site-header__menu-toggle',
  );

  if (menu === null || menuToggle === null) {
    return {
      closeMenu: (): void => {
        document.body.classList.remove('menu-open');
      },
      destroy: (): void => {
        eventController.abort();
      },
      element: header,
      setActivePath,
    };
  }

  menu.inert = true;

  const setMenuOpen = (
    isOpen: boolean,
    shouldRestoreFocus: boolean = true,
  ): void => {
    header.classList.toggle('site-header--menu-open', isOpen);
    document.body.classList.toggle('menu-open', isOpen);
    menu.setAttribute('aria-hidden', String(!isOpen));
    menu.inert = !isOpen;
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute(
      'aria-label',
      isOpen ? 'Close navigation menu' : 'Open navigation menu',
    );

    if (shouldRestoreFocus) {
      menuToggle.focus();
    }
  };

  const closeMenu = (): void => {
    setMenuOpen(false, false);
  };

  menuToggle.addEventListener(
    'click',
    (): void => {
      const isOpen: boolean =
        menuToggle.getAttribute('aria-expanded') === 'true';
      setMenuOpen(!isOpen);
    },
    { signal },
  );

  header.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const authButton: HTMLButtonElement | null = event.target.closest(
        'button[data-auth-mode]',
      );
      if (authButton !== null) {
        const mode: AuthMode =
          authButton.dataset.authMode === 'register' ? 'register' : 'login';
        if (menuToggle.getAttribute('aria-expanded') === 'true') {
          setMenuOpen(false);
        }
        dispatchAuthRequest(mode);
        return;
      }

      if (event.target.closest('.mobile-menu__link') !== null) {
        setMenuOpen(false);
      }
    },
    { signal },
  );

  document.addEventListener(
    'keydown',
    (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && menuToggle.ariaExpanded === 'true') {
        setMenuOpen(false);
      }
    },
    { signal },
  );

  globalThis.addEventListener(
    'resize',
    (): void => {
      if (
        menuToggle.ariaExpanded === 'true' &&
        globalThis.getComputedStyle(menu).display === 'none'
      ) {
        closeMenu();
      }
    },
    { signal },
  );

  return {
    closeMenu,
    destroy: (): void => {
      closeMenu();
      eventController.abort();
    },
    element: header,
    setActivePath,
  };
};
