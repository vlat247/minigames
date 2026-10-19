import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppSession } from '../../features/auth/app-session';
import {
  AUTH_DIALOG_OPEN_EVENT,
  type AuthDialogRequestDetail,
} from '../dialogs/auth-dialog-events';
import { LOGOUT_REQUEST_EVENT, isLogoutRequestEvent } from './header-events';
import { createHeader, type HeaderController } from './header';

const SESSION: AppSession = {
  authenticatedAt: 1_789_012_345_000,
  avatarUrl: 'https://example.com/ada.png',
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
};

const controllers: HeaderController[] = [];

const createFixture = (): HeaderController => {
  const controller = createHeader();
  controllers.push(controller);
  document.body.append(controller.element);

  return controller;
};

const getRequiredElement = <ElementType extends Element>(
  root: ParentNode,
  selector: string,
): ElementType => {
  const element = root.querySelector<ElementType>(selector);

  if (element === null) {
    throw new Error(`Expected an element matching ${selector}.`);
  }

  return element;
};

const getDesktopProfileToggle = (
  controller: HeaderController,
): HTMLButtonElement =>
  getRequiredElement<HTMLButtonElement>(
    controller.element,
    '[data-profile-toggle]',
  );

afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.destroy();
  }
});

describe('header session presentation', () => {
  it('starts with the existing guest actions in desktop, compact, and mobile layouts', () => {
    const { element } = createFixture();

    expect(element.dataset.session).toBe('guest');
    expect(
      element.querySelectorAll(
        ':scope [data-desktop-auth-slot] [data-auth-mode]',
      ),
    ).toHaveLength(2);
    expect(
      getRequiredElement<HTMLButtonElement>(
        element,
        '[data-desktop-auth-slot] [data-auth-mode="login"]',
      ).textContent,
    ).toBe('Log In');
    expect(
      getRequiredElement<HTMLButtonElement>(
        element,
        '[data-compact-auth-slot] [data-auth-mode="register"]',
      ).textContent,
    ).toBe('Sign Up');
    expect(
      element.querySelectorAll(
        ':scope [data-mobile-auth-slot] [data-auth-mode]',
      ),
    ).toHaveLength(2);
    expect(element.querySelector('[data-profile-toggle]')).toBeNull();
    expect(element.querySelector('[data-logout]')).toBeNull();
  });

  it('replaces every guest action with profile information and logout controls', () => {
    const controller = createFixture();

    controller.setSession(SESSION);

    expect(controller.element.dataset.session).toBe('authenticated');
    expect(controller.element.querySelector('[data-auth-mode]')).toBeNull();
    expect(
      getRequiredElement(controller.element, '.site-header__profile-name')
        .textContent,
    ).toBe('Ada Lovelace');
    expect(
      getRequiredElement(
        controller.element,
        '.site-header__profile-avatar-fallback',
      ).textContent,
    ).toBe('AL');
    expect(
      getRequiredElement(controller.element, '.mobile-menu__profile-name')
        .textContent,
    ).toBe('Ada Lovelace');
    expect(
      getRequiredElement(controller.element, '.mobile-menu__profile-email')
        .textContent,
    ).toBe('ada@example.com');
    expect(
      controller.element.querySelectorAll('button[data-logout]'),
    ).toHaveLength(2);
    expect(
      controller.element.querySelector('.site-header__compact-profile'),
    ).not.toBeNull();
  });

  it('derives the visible name and initials from email when display name is blank', () => {
    const controller = createFixture();

    controller.setSession({
      ...SESSION,
      avatarUrl: undefined,
      displayName: '  ',
      email: 'grace.hopper@example.com',
    });

    expect(
      getRequiredElement(controller.element, '.site-header__profile-name')
        .textContent,
    ).toBe('grace.hopper');
    expect(
      getRequiredElement(
        controller.element,
        '.site-header__profile-avatar-fallback',
      ).textContent,
    ).toBe('G');
  });

  it('uses an accessible person avatar when a profile has no usable initials', () => {
    const controller = createFixture();

    controller.setSession({
      ...SESSION,
      avatarUrl: '',
      displayName: '!!!',
      email: '',
    });

    const fallback = getRequiredElement<HTMLElement>(
      controller.element,
      '.site-header__profile-avatar-fallback',
    );
    expect(fallback.getAttribute('role')).toBe('img');
    expect(fallback.getAttribute('aria-label')).toBe('Profile picture for !!!');
    expect(
      getRequiredElement(fallback, '.material-symbols-rounded').textContent,
    ).toBe('person');
  });

  it('renders an untrusted profile name as literal text', () => {
    const controller = createFixture();
    const untrustedName = '<img src=x onerror="globalThis.hacked=true">';

    controller.setSession({
      ...SESSION,
      avatarUrl: undefined,
      displayName: untrustedName,
    });

    expect(
      getRequiredElement(controller.element, '.site-header__profile-name')
        .textContent,
    ).toBe(untrustedName);
    expect(controller.element.querySelector('[onerror]')).toBeNull();
    expect(controller.element.querySelector('img[src="x"]')).toBeNull();
  });

  it('reveals initials when a remote avatar cannot load', () => {
    const controller = createFixture();
    controller.setSession(SESSION);
    const image = getRequiredElement<HTMLImageElement>(
      controller.element,
      '.site-header__profile-avatar-image',
    );
    const fallback = getRequiredElement<HTMLElement>(
      controller.element,
      '.site-header__profile-avatar-fallback',
    );

    expect(image.getAttribute('src')).toBe(SESSION.avatarUrl);
    expect(image.alt).toBe('Profile picture for Ada Lovelace');
    expect(fallback.hidden).toBe(true);

    image.dispatchEvent(new Event('error'));

    expect(image.hidden).toBe(true);
    expect(fallback.hidden).toBe(false);
    expect(fallback.textContent).toBe('AL');
  });

  it('restores guest actions when the active session is cleared', () => {
    const controller = createFixture();
    controller.setSession(SESSION);
    getDesktopProfileToggle(controller).click();

    controller.setSession(undefined);

    expect(controller.element.dataset.session).toBe('guest');
    expect(
      controller.element.querySelector('[data-profile-toggle]'),
    ).toBeNull();
    expect(
      controller.element.querySelectorAll('[data-auth-mode]'),
    ).toHaveLength(5);
  });
});

describe('header profile interactions', () => {
  it('exposes an accessible menu and toggles it from the profile button', () => {
    const controller = createFixture();
    controller.setSession(SESSION);
    const toggle = getDesktopProfileToggle(controller);
    const menu = getRequiredElement<HTMLElement>(
      controller.element,
      '.site-header__profile-menu',
    );
    const logoutButton = getRequiredElement<HTMLButtonElement>(
      menu,
      '[data-logout]',
    );

    expect(toggle.getAttribute('aria-haspopup')).toBe('menu');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(menu.id);
    expect(menu.getAttribute('role')).toBe('menu');
    expect(menu.hidden).toBe(true);
    expect(logoutButton.getAttribute('role')).toBe('menuitem');

    toggle.click();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe(
      'Close account menu for Ada Lovelace',
    );
    expect(menu.hidden).toBe(false);
    expect(menu.inert).toBe(false);
    expect(document.activeElement).toBe(logoutButton);

    toggle.click();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(menu.hidden).toBe(true);
    expect(menu.inert).toBe(true);
  });

  it('closes the profile menu with Escape and restores focus to its trigger', () => {
    const controller = createFixture();
    controller.setSession(SESSION);
    const toggle = getDesktopProfileToggle(controller);
    toggle.click();
    getRequiredElement<HTMLButtonElement>(
      controller.element,
      '.site-header__logout',
    ).focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('closes the profile menu on an outside click without stealing focus', () => {
    const controller = createFixture();
    controller.setSession(SESSION);
    const toggle = getDesktopProfileToggle(controller);
    const outsideButton = document.createElement('button');
    document.body.append(outsideButton);
    toggle.click();
    outsideButton.focus();

    outsideButton.click();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(outsideButton);
  });

  it('closes both desktop and mobile menus through closeMenu', () => {
    const controller = createFixture();
    controller.setSession(SESSION);
    const profileToggle = getDesktopProfileToggle(controller);
    const menuToggle = getRequiredElement<HTMLButtonElement>(
      controller.element,
      '.site-header__menu-toggle',
    );
    profileToggle.click();
    menuToggle.click();

    controller.closeMenu();

    expect(profileToggle.getAttribute('aria-expanded')).toBe('false');
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.classList.contains('menu-open')).toBe(false);
  });

  it('dispatches one logout request from desktop and mobile controls', () => {
    const controller = createFixture();
    controller.setSession(SESSION);
    const listener = vi.fn();
    document.addEventListener(LOGOUT_REQUEST_EVENT, listener);
    const profileToggle = getDesktopProfileToggle(controller);
    const menuToggle = getRequiredElement<HTMLButtonElement>(
      controller.element,
      '.site-header__menu-toggle',
    );

    profileToggle.click();
    getRequiredElement<HTMLButtonElement>(
      controller.element,
      '.site-header__logout',
    ).click();
    expect(profileToggle.getAttribute('aria-expanded')).toBe('false');

    menuToggle.click();
    getRequiredElement<HTMLButtonElement>(
      controller.element,
      '.mobile-menu__logout',
    ).click();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(isLogoutRequestEvent(listener.mock.calls[0]?.[0])).toBe(true);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');
    document.removeEventListener(LOGOUT_REQUEST_EVENT, listener);
  });

  it('keeps the existing auth request behavior for restored guest actions', () => {
    const controller = createFixture();
    const listener = vi.fn<EventListener>();
    document.addEventListener(AUTH_DIALOG_OPEN_EVENT, listener);

    getRequiredElement<HTMLButtonElement>(
      controller.element,
      '[data-desktop-auth-slot] [data-auth-mode="register"]',
    ).click();

    expect(listener).toHaveBeenCalledOnce();
    const request = listener.mock.calls[0]?.[0] as
      CustomEvent<AuthDialogRequestDetail> | undefined;
    expect(request?.detail).toEqual({ mode: 'register' });
    document.removeEventListener(AUTH_DIALOG_OPEN_EVENT, listener);
  });

  it('closes menus and removes interaction listeners when destroyed', () => {
    const controller = createFixture();
    controller.setSession(SESSION);
    const profileToggle = getDesktopProfileToggle(controller);
    const menuToggle = getRequiredElement<HTMLButtonElement>(
      controller.element,
      '.site-header__menu-toggle',
    );
    profileToggle.click();
    menuToggle.click();

    controller.destroy();
    profileToggle.click();
    menuToggle.click();

    expect(profileToggle.getAttribute('aria-expanded')).toBe('false');
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.classList.contains('menu-open')).toBe(false);
  });
});

describe('isLogoutRequestEvent', () => {
  it('accepts only events with the logout request type', () => {
    expect(isLogoutRequestEvent(new Event(LOGOUT_REQUEST_EVENT))).toBe(true);
    expect(isLogoutRequestEvent(new Event('auth:open'))).toBe(false);
    expect(isLogoutRequestEvent({ type: LOGOUT_REQUEST_EVENT })).toBe(false);
    expect(isLogoutRequestEvent(undefined)).toBe(false);
  });
});
