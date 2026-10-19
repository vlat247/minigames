import { describe, expect, it, vi } from 'vitest';

import {
  APP_SESSION_FALLBACK_AVATAR,
  APP_SESSION_FALLBACK_NAME,
  APP_SESSION_STORAGE_KEY,
  APP_SESSION_TTL_MS,
  clearAppSession,
  createAppSession,
  getProfileInitials,
  getProfileName,
  readAppSession,
  writeAppSession,
  type AppSession,
  type AppSessionProfile,
} from './app-session';

const AUTHENTICATED_AT = 1_789_012_345_000;
const OTHER_STORAGE_KEY = 'another-app:session';
const PROFILE: AppSessionProfile = {
  avatarUrl: 'https://example.com/avatar.png',
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
};
const SESSION: AppSession = {
  ...PROFILE,
  authenticatedAt: AUTHENTICATED_AT,
};

const storeRawSession = (value: unknown): void => {
  localStorage.setItem(APP_SESSION_STORAGE_KEY, JSON.stringify(value));
};

describe('createAppSession', () => {
  it('uses Date.now exactly once as the authentication timestamp by default', () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(AUTHENTICATED_AT);

    expect(createAppSession(PROFILE)).toEqual(SESSION);
    expect(dateNow).toHaveBeenCalledOnce();
  });

  it('uses an injected clock and preserves empty required strings', () => {
    const clock = vi.fn(() => AUTHENTICATED_AT);

    expect(createAppSession({ displayName: '', email: '' }, clock)).toEqual({
      authenticatedAt: AUTHENTICATED_AT,
      displayName: '',
      email: '',
    });
    expect(clock).toHaveBeenCalledOnce();
  });

  it('omits avatarUrl when it is unavailable', () => {
    const session = createAppSession(
      { displayName: 'Ada', email: 'ada@example.com' },
      () => AUTHENTICATED_AT,
    );

    expect(session).not.toHaveProperty('avatarUrl');
  });

  it('normalizes an available avatar URL and omits blank values', () => {
    expect(
      createAppSession(
        {
          avatarUrl: '  https://example.com/avatar.png  ',
          displayName: 'Ada',
          email: 'ada@example.com',
        },
        () => AUTHENTICATED_AT,
      ),
    ).toHaveProperty('avatarUrl', 'https://example.com/avatar.png');
    expect(
      createAppSession(
        { avatarUrl: ' ', displayName: 'Ada', email: 'ada@example.com' },
        () => AUTHENTICATED_AT,
      ),
    ).not.toHaveProperty('avatarUrl');
    expect(
      createAppSession(
        { avatarUrl: undefined, displayName: 'Ada', email: 'ada@example.com' },
        () => AUTHENTICATED_AT,
      ),
    ).not.toHaveProperty('avatarUrl');
  });

  it.each([
    { displayName: 'Ada' },
    { email: 'ada@example.com' },
    { displayName: 42, email: 'ada@example.com' },
    { displayName: 'Ada', email: null },
    { avatarUrl: null, displayName: 'Ada', email: 'ada@example.com' },
    {
      displayName: 'Ada',
      email: 'ada@example.com',
      unexpected: 'data',
    },
  ])('rejects an invalid profile: %j', (profile) => {
    expect(() =>
      createAppSession(
        profile as unknown as AppSessionProfile,
        () => AUTHENTICATED_AT,
      ),
    ).toThrow(TypeError);
  });

  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER])(
    'rejects an unsafe clock value: %s',
    (timestamp) => {
      expect(() => createAppSession(PROFILE, () => timestamp)).toThrow(
        TypeError,
      );
    },
  );
});

describe('app-session persistence', () => {
  it('writes one JSON object under the stable project-specific key', () => {
    writeAppSession(SESSION, localStorage);

    expect(localStorage).toHaveLength(1);
    expect(
      JSON.parse(localStorage.getItem(APP_SESSION_STORAGE_KEY) ?? ''),
    ).toEqual(SESSION);
  });

  it('rejects invalid records rather than storing them', () => {
    const invalidSession = {
      ...SESSION,
      authenticatedAt: -1,
    } as AppSession;

    expect(() => writeAppSession(invalidSession, localStorage)).toThrow(
      TypeError,
    );
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('clears only the app-session key', () => {
    writeAppSession(SESSION, localStorage);
    localStorage.setItem(OTHER_STORAGE_KEY, 'keep me');

    clearAppSession(localStorage);

    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(OTHER_STORAGE_KEY)).toBe('keep me');
  });

  it('returns missing without mutating unrelated storage', () => {
    localStorage.setItem(OTHER_STORAGE_KEY, 'keep me');

    expect(readAppSession(localStorage, () => AUTHENTICATED_AT)).toEqual({
      status: 'missing',
    });
    expect(localStorage.getItem(OTHER_STORAGE_KEY)).toBe('keep me');
  });

  it('restores a valid session without changing its timestamp or stored JSON', () => {
    writeAppSession(SESSION, localStorage);
    const storedValue = localStorage.getItem(APP_SESSION_STORAGE_KEY);

    expect(
      readAppSession(localStorage, () => AUTHENTICATED_AT + 100_000),
    ).toEqual({
      expiresAt: AUTHENTICATED_AT + APP_SESSION_TTL_MS,
      session: SESSION,
      status: 'valid',
    });
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBe(storedValue);
  });

  it('is valid until the millisecond before the exact expiration boundary', () => {
    writeAppSession(SESSION, localStorage);

    expect(
      readAppSession(
        localStorage,
        () => AUTHENTICATED_AT + APP_SESSION_TTL_MS - 1,
      ).status,
    ).toBe('valid');
  });

  it('expires at the exact lifetime boundary and removes only its own key', () => {
    writeAppSession(SESSION, localStorage);
    localStorage.setItem(OTHER_STORAGE_KEY, 'keep me');

    expect(
      readAppSession(localStorage, () => AUTHENTICATED_AT + APP_SESSION_TTL_MS),
    ).toEqual({
      expiresAt: AUTHENTICATED_AT + APP_SESSION_TTL_MS,
      session: SESSION,
      status: 'expired',
    });
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(OTHER_STORAGE_KEY)).toBe('keep me');
  });

  it('rejects a future authentication timestamp as invalid', () => {
    writeAppSession(SESSION, localStorage);

    expect(readAppSession(localStorage, () => AUTHENTICATED_AT - 1)).toEqual({
      status: 'invalid',
    });
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('removes malformed JSON while preserving other storage', () => {
    localStorage.setItem(APP_SESSION_STORAGE_KEY, '{not valid JSON');
    localStorage.setItem(OTHER_STORAGE_KEY, 'keep me');

    expect(readAppSession(localStorage, () => AUTHENTICATED_AT)).toEqual({
      status: 'invalid',
    });
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(OTHER_STORAGE_KEY)).toBe('keep me');
  });

  it.each([
    null,
    [],
    'session',
    42,
    {},
    { authenticatedAt: AUTHENTICATED_AT, displayName: 'Ada' },
    { authenticatedAt: AUTHENTICATED_AT, email: 'ada@example.com' },
    { displayName: 'Ada', email: 'ada@example.com' },
    { ...SESSION, displayName: null },
    { ...SESSION, email: false },
    { ...SESSION, avatarUrl: 42 },
    { ...SESSION, authenticatedAt: 'yesterday' },
    { ...SESSION, authenticatedAt: -1 },
    { ...SESSION, authenticatedAt: 1.5 },
    { ...SESSION, authenticatedAt: Number.MAX_SAFE_INTEGER },
    { ...SESSION, firebaseToken: 'must-not-be-stored' },
  ])('rejects and removes invalid stored data: %j', (storedSession) => {
    storeRawSession(storedSession);
    localStorage.setItem(OTHER_STORAGE_KEY, 'keep me');

    expect(readAppSession(localStorage, () => AUTHENTICATED_AT)).toEqual({
      status: 'invalid',
    });
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(OTHER_STORAGE_KEY)).toBe('keep me');
  });

  it('accepts an optional avatar string in stored data', () => {
    const sessionWithoutAvatar: AppSession = {
      authenticatedAt: AUTHENTICATED_AT,
      displayName: 'Ada',
      email: 'ada@example.com',
    };
    writeAppSession(sessionWithoutAvatar, localStorage);

    expect(
      readAppSession(localStorage, () => AUTHENTICATED_AT + 1),
    ).toMatchObject({ session: sessionWithoutAvatar, status: 'valid' });
  });
});

describe('profile helpers', () => {
  it('trims and selects a nonempty display name', () => {
    expect(
      getProfileName({
        displayName: '  Ada Lovelace  ',
        email: 'fallback@example.com',
      }),
    ).toBe('Ada Lovelace');
  });

  it('uses the email local part when the display name is empty', () => {
    expect(
      getProfileName({
        displayName: ' \t ',
        email: '  email.fallback@example.com ',
      }),
    ).toBe('email.fallback');
  });

  it('uses a generic name when display name and email local part are empty', () => {
    expect(getProfileName({ displayName: '', email: '@example.com' })).toBe(
      APP_SESSION_FALLBACK_NAME,
    );
    expect(getProfileName({ displayName: ' ', email: ' ' })).toBe(
      APP_SESSION_FALLBACK_NAME,
    );
  });

  it.each([
    ['Ada', 'A'],
    ['Ada Lovelace', 'AL'],
    ['  Ada   Lovelace Byron  ', 'AL'],
    ['123 games', '1G'],
    ['—Ada (Lovelace)', 'AL'],
    ['Élodie Жуков', 'ÉЖ'],
    ['東京 太郎', '東太'],
    ['🧑‍💻 Ada', 'A'],
  ])('creates Unicode-aware initials from %j', (displayName, expected) => {
    expect(
      getProfileInitials({ displayName, email: 'fallback@example.com' }),
    ).toBe(expected);
  });

  it('derives initials from the selected email fallback name', () => {
    expect(
      getProfileInitials({
        displayName: '',
        email: 'grace.hopper@example.com',
      }),
    ).toBe('G');
  });

  it('returns the generic avatar when the selected name has no alphanumerics', () => {
    expect(
      getProfileInitials({
        displayName: '— 🎮',
        email: 'fallback@example.com',
      }),
    ).toBe(APP_SESSION_FALLBACK_AVATAR);
  });

  it('keeps XSS-like profile names as inert text and derives plain initials', () => {
    const xssLikeName = '<img src=x onerror=alert(1)>';
    const profile = { displayName: xssLikeName, email: 'safe@example.com' };

    expect(getProfileName(profile)).toBe(xssLikeName);
    expect(getProfileInitials(profile)).toBe('IS');
    expect(getProfileInitials(profile)).not.toContain('<');
    expect(getProfileInitials(profile)).not.toContain('>');
  });
});
