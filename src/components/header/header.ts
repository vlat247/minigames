import './header.scss';
import {
  type AuthMode,
  dispatchAuthDialogRequest,
} from '../dialogs/auth-dialog-events';
import {
  APP_SESSION_FALLBACK_AVATAR,
  getProfileInitials,
  getProfileName,
  type AppSession,
} from '../../features/auth/app-session';
import { getAppPath } from '../../utils/paths';
import { dispatchLogoutRequest } from './header-events';

export interface HeaderController {
  readonly closeMenu: () => void;
  readonly destroy: () => void;
  readonly element: HTMLElement;
  readonly setActivePath: (path: string) => void;
  readonly setSession: (session: AppSession | undefined) => void;
}

const getRequiredElement = <ElementType extends Element>(
  root: ParentNode,
  selector: string,
): ElementType => {
  const element = root.querySelector<ElementType>(selector);

  if (element === null) {
    throw new Error(`The header is missing its required ${selector} element.`);
  }

  return element;
};

const createAvatar = (
  session: AppSession,
  signal: AbortSignal,
  className: string,
): HTMLElement => {
  const profileName = getProfileName(session);
  const initials = getProfileInitials(session);
  const avatar = document.createElement('span');
  const fallback = document.createElement('span');
  avatar.className = className;
  fallback.className = `${className}-fallback`;
  fallback.setAttribute('role', 'img');
  fallback.setAttribute('aria-label', `Profile picture for ${profileName}`);

  if (initials === APP_SESSION_FALLBACK_AVATAR) {
    const personIcon = document.createElement('span');
    personIcon.className = 'material-symbols-rounded';
    personIcon.setAttribute('aria-hidden', 'true');
    personIcon.textContent = 'person';
    fallback.append(personIcon);
  } else {
    fallback.textContent = initials;
  }

  const avatarUrl = session.avatarUrl?.trim();
  if (avatarUrl === undefined || avatarUrl.length === 0) {
    avatar.append(fallback);
    return avatar;
  }

  const image = document.createElement('img');
  image.className = `${className}-image`;
  image.alt = `Profile picture for ${profileName}`;
  image.src = avatarUrl;
  fallback.hidden = true;
  image.addEventListener(
    'error',
    (): void => {
      image.hidden = true;
      fallback.hidden = false;
    },
    { once: true, signal },
  );
  avatar.append(image, fallback);

  return avatar;
};

const createGuestActions = (): DocumentFragment => {
  const actions = document.createDocumentFragment();
  const logInButton = document.createElement('button');
  const signUpButton = document.createElement('button');
  logInButton.className = 'btn btn--secondary';
  logInButton.type = 'button';
  logInButton.dataset.authMode = 'login';
  logInButton.textContent = 'Log In';
  signUpButton.className = 'btn btn--primary';
  signUpButton.type = 'button';
  signUpButton.dataset.authMode = 'register';
  signUpButton.textContent = 'Sign Up';
  actions.append(logInButton, signUpButton);

  return actions;
};

const createLogoutButton = (className: string): HTMLButtonElement => {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.dataset.logout = '';
  button.textContent = 'Logout';

  return button;
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

      <div class="site-header__desktop-actions" data-desktop-auth-slot></div>

      <div class="site-header__compact-actions">
        <div class="site-header__compact-auth-slot" data-compact-auth-slot></div>
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

      <div class="mobile-menu__actions" data-mobile-auth-slot></div>
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

  const menu = getRequiredElement<HTMLElement>(header, '.mobile-menu');
  const menuToggle = getRequiredElement<HTMLButtonElement>(
    header,
    '.site-header__menu-toggle',
  );
  const desktopAuthSlot = getRequiredElement<HTMLElement>(
    header,
    '[data-desktop-auth-slot]',
  );
  const compactAuthSlot = getRequiredElement<HTMLElement>(
    header,
    '[data-compact-auth-slot]',
  );
  const mobileAuthSlot = getRequiredElement<HTMLElement>(
    header,
    '[data-mobile-auth-slot]',
  );
  const profileMenuId = 'header-profile-menu';
  let profileRoot: HTMLElement | undefined;
  let profileToggle: HTMLButtonElement | undefined;
  let profileMenu: HTMLElement | undefined;

  menu.inert = true;

  const setProfileMenuOpen = (
    isOpen: boolean,
    shouldRestoreFocus: boolean = true,
  ): void => {
    if (
      profileRoot === undefined ||
      profileToggle === undefined ||
      profileMenu === undefined
    ) {
      return;
    }

    profileRoot.classList.toggle('site-header__profile--open', isOpen);
    profileToggle.setAttribute('aria-expanded', String(isOpen));
    profileToggle.setAttribute(
      'aria-label',
      `${isOpen ? 'Close' : 'Open'} account menu for ${profileToggle.dataset.profileName ?? ''}`.trim(),
    );
    profileMenu.hidden = !isOpen;
    profileMenu.inert = !isOpen;

    if (isOpen) {
      profileMenu.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
      return;
    }

    if (shouldRestoreFocus && profileToggle.isConnected) {
      profileToggle.focus();
    }
  };

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
    setProfileMenuOpen(false, false);
  };

  const renderDesktopSession = (session: AppSession): void => {
    const name = getProfileName(session);
    const root = document.createElement('div');
    const toggle = document.createElement('button');
    const nameElement = document.createElement('span');
    const arrow = document.createElement('span');
    const dropdown = document.createElement('div');
    const identity = document.createElement('div');
    const dropdownName = document.createElement('strong');
    const dropdownEmail = document.createElement('span');
    root.className = 'site-header__profile';
    toggle.className = 'site-header__profile-toggle';
    toggle.type = 'button';
    toggle.dataset.profileToggle = '';
    toggle.dataset.profileName = name;
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', profileMenuId);
    toggle.setAttribute('aria-label', `Open account menu for ${name}`);
    nameElement.className = 'site-header__profile-name';
    nameElement.textContent = name;
    arrow.className = 'material-symbols-rounded site-header__profile-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = 'keyboard_arrow_down';
    toggle.append(
      createAvatar(session, signal, 'site-header__profile-avatar'),
      nameElement,
      arrow,
    );
    dropdown.className = 'site-header__profile-menu';
    dropdown.id = profileMenuId;
    dropdown.setAttribute('role', 'menu');
    dropdown.hidden = true;
    dropdown.inert = true;
    identity.className = 'site-header__profile-identity';
    dropdownName.className = 'site-header__profile-menu-name';
    dropdownName.textContent = name;
    dropdownEmail.className = 'site-header__profile-email';
    dropdownEmail.textContent = session.email;
    identity.append(dropdownName, dropdownEmail);
    const logoutButton = createLogoutButton('site-header__logout');
    logoutButton.setAttribute('role', 'menuitem');
    dropdown.append(identity, logoutButton);
    root.append(toggle, dropdown);
    desktopAuthSlot.replaceChildren(root);
    profileRoot = root;
    profileToggle = toggle;
    profileMenu = dropdown;
  };

  const renderCompactSession = (session: AppSession): void => {
    const identity = document.createElement('span');
    const name = getProfileName(session);
    identity.className = 'site-header__compact-profile';
    identity.setAttribute('aria-label', `Signed in as ${name}`);
    identity.append(
      createAvatar(session, signal, 'site-header__compact-avatar'),
    );
    compactAuthSlot.replaceChildren(identity);
  };

  const renderMobileSession = (session: AppSession): void => {
    const name = getProfileName(session);
    const identity = document.createElement('div');
    const copy = document.createElement('div');
    const nameElement = document.createElement('strong');
    const emailElement = document.createElement('span');
    identity.className = 'mobile-menu__profile';
    copy.className = 'mobile-menu__profile-copy';
    nameElement.className = 'mobile-menu__profile-name';
    nameElement.textContent = name;
    emailElement.className = 'mobile-menu__profile-email';
    emailElement.textContent = session.email;
    copy.append(nameElement, emailElement);
    identity.append(
      createAvatar(session, signal, 'mobile-menu__profile-avatar'),
      copy,
    );
    mobileAuthSlot.replaceChildren(
      identity,
      createLogoutButton('btn btn--secondary mobile-menu__logout'),
    );
  };

  const setSession = (session: AppSession | undefined): void => {
    closeMenu();
    profileRoot = undefined;
    profileToggle = undefined;
    profileMenu = undefined;
    header.dataset.session = session === undefined ? 'guest' : 'authenticated';

    if (session === undefined) {
      desktopAuthSlot.replaceChildren(createGuestActions());
      const compactSignUp = document.createElement('button');
      compactSignUp.className = 'btn btn--primary site-header__compact-sign-up';
      compactSignUp.type = 'button';
      compactSignUp.dataset.authMode = 'register';
      compactSignUp.textContent = 'Sign Up';
      compactAuthSlot.replaceChildren(compactSignUp);
      mobileAuthSlot.replaceChildren(createGuestActions());
      return;
    }

    renderDesktopSession(session);
    renderCompactSession(session);
    renderMobileSession(session);
  };

  setSession(undefined);

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

      const clickedProfileToggle = event.target.closest<HTMLButtonElement>(
        'button[data-profile-toggle]',
      );
      if (clickedProfileToggle !== null) {
        setProfileMenuOpen(
          clickedProfileToggle.getAttribute('aria-expanded') !== 'true',
        );
        return;
      }

      if (event.target.closest('button[data-logout]') !== null) {
        setMenuOpen(false, false);
        setProfileMenuOpen(false, false);
        dispatchLogoutRequest();
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
        dispatchAuthDialogRequest(mode);
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
      if (event.key !== 'Escape') {
        return;
      }

      if (profileToggle?.getAttribute('aria-expanded') === 'true') {
        setProfileMenuOpen(false);
        return;
      }

      if (menuToggle.ariaExpanded === 'true') {
        setMenuOpen(false);
      }
    },
    { signal },
  );

  document.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (
        profileRoot === undefined ||
        !(event.target instanceof Node) ||
        profileRoot.contains(event.target)
      ) {
        return;
      }

      setProfileMenuOpen(false, false);
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
    setSession,
  };
};
