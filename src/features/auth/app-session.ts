export const APP_SESSION_STORAGE_KEY =
  'minigames:minigames-rs:app-session' as const;

export const APP_SESSION_TTL_MS = 300_000 as const;

export const APP_SESSION_FALLBACK_NAME = 'Player' as const;

export const APP_SESSION_FALLBACK_AVATAR = '?' as const;

export interface AppSessionProfile {
  readonly avatarUrl?: string;
  readonly displayName: string;
  readonly email: string;
}

export interface AppSession extends AppSessionProfile {
  readonly authenticatedAt: number;
}

export type AppSessionReadResult =
  | {
      readonly status: 'missing';
    }
  | {
      readonly status: 'invalid';
    }
  | {
      readonly expiresAt: number;
      readonly session: AppSession;
      readonly status: 'expired';
    }
  | {
      readonly expiresAt: number;
      readonly session: AppSession;
      readonly status: 'valid';
    };

export type AppSessionClock = () => number;

const PROFILE_KEYS = ['avatarUrl', 'displayName', 'email'] as const;
const SESSION_KEYS = [...PROFILE_KEYS, 'authenticatedAt'] as const;
const ALPHANUMERIC_CHARACTER_PATTERN = /^[\p{L}\p{N}]$/u;

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (
  value: Record<PropertyKey, unknown>,
  allowedKeys: readonly string[],
): boolean =>
  Reflect.ownKeys(value).every(
    (key) => typeof key === 'string' && allowedKeys.includes(key),
  );

const hasOwnString = (
  value: Record<PropertyKey, unknown>,
  key: string,
): boolean => Object.hasOwn(value, key) && typeof value[key] === 'string';

const isNonnegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isStorableAuthenticatedAt = (value: unknown): value is number =>
  isNonnegativeSafeInteger(value) &&
  value <= Number.MAX_SAFE_INTEGER - APP_SESSION_TTL_MS;

const isAppSessionProfileWithoutTimestamp = (
  value: Record<PropertyKey, unknown>,
): boolean =>
  hasOwnString(value, 'displayName') &&
  hasOwnString(value, 'email') &&
  (!Object.hasOwn(value, 'avatarUrl') ||
    value.avatarUrl === undefined ||
    typeof value.avatarUrl === 'string');

const isAppSessionProfile = (value: unknown): value is AppSessionProfile =>
  isRecord(value) &&
  hasOnlyKeys(value, PROFILE_KEYS) &&
  isAppSessionProfileWithoutTimestamp(value);

const isAppSession = (value: unknown): value is AppSession =>
  isRecord(value) &&
  hasOnlyKeys(value, SESSION_KEYS) &&
  isAppSessionProfileWithoutTimestamp(value) &&
  Object.hasOwn(value, 'authenticatedAt') &&
  isStorableAuthenticatedAt(value.authenticatedAt);

const getCurrentTimestamp = (clock: AppSessionClock): number => {
  const timestamp = clock();

  if (!isNonnegativeSafeInteger(timestamp)) {
    throw new TypeError(
      'The app-session clock must return a nonnegative safe integer.',
    );
  }

  return timestamp;
};

export const createAppSession = (
  profile: AppSessionProfile,
  clock: AppSessionClock = Date.now,
): AppSession => {
  if (!isAppSessionProfile(profile)) {
    throw new TypeError('The app-session profile is invalid.');
  }

  const authenticatedAt = getCurrentTimestamp(clock);

  if (!isStorableAuthenticatedAt(authenticatedAt)) {
    throw new TypeError(
      'The authentication timestamp cannot produce a safe expiration time.',
    );
  }

  const avatarUrl = profile.avatarUrl?.trim();

  return avatarUrl === undefined || avatarUrl.length === 0
    ? {
        authenticatedAt,
        displayName: profile.displayName,
        email: profile.email,
      }
    : {
        authenticatedAt,
        avatarUrl,
        displayName: profile.displayName,
        email: profile.email,
      };
};

export const writeAppSession = (
  session: AppSession,
  storage: Storage = globalThis.localStorage,
): void => {
  if (!isAppSession(session)) {
    throw new TypeError('The app session is invalid.');
  }

  storage.setItem(APP_SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearAppSession = (
  storage: Storage = globalThis.localStorage,
): void => {
  storage.removeItem(APP_SESSION_STORAGE_KEY);
};

export const readAppSession = (
  storage: Storage = globalThis.localStorage,
  clock: AppSessionClock = Date.now,
): AppSessionReadResult => {
  const storedValue = storage.getItem(APP_SESSION_STORAGE_KEY);

  if (storedValue === null) {
    return { status: 'missing' };
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(storedValue) as unknown;
  } catch {
    clearAppSession(storage);
    return { status: 'invalid' };
  }

  if (!isAppSession(parsedValue)) {
    clearAppSession(storage);
    return { status: 'invalid' };
  }

  const currentTimestamp = getCurrentTimestamp(clock);

  if (parsedValue.authenticatedAt > currentTimestamp) {
    clearAppSession(storage);
    return { status: 'invalid' };
  }

  const expiresAt = parsedValue.authenticatedAt + APP_SESSION_TTL_MS;

  if (currentTimestamp >= expiresAt) {
    clearAppSession(storage);
    return { expiresAt, session: parsedValue, status: 'expired' };
  }

  return { expiresAt, session: parsedValue, status: 'valid' };
};

export const getProfileName = (
  profile: Pick<AppSessionProfile, 'displayName' | 'email'>,
): string => {
  const displayName = profile.displayName.trim();

  if (displayName.length > 0) {
    return displayName;
  }

  const emailLocalPart = profile.email.split('@', 1)[0]?.trim() ?? '';
  return emailLocalPart.length > 0 ? emailLocalPart : APP_SESSION_FALLBACK_NAME;
};

const getFirstAlphanumericCharacter = (word: string): string | undefined =>
  [...word].find((character) => ALPHANUMERIC_CHARACTER_PATTERN.test(character));

export const getProfileInitials = (
  profile: Pick<AppSessionProfile, 'displayName' | 'email'>,
): string => {
  const words = getProfileName(profile).trim().split(/\s+/u).slice(0, 2);
  const initials = words
    .map((word) => getFirstAlphanumericCharacter(word))
    .filter((character): character is string => character !== undefined)
    .join('')
    .toLocaleUpperCase();

  return initials.length > 0 ? initials : APP_SESSION_FALLBACK_AVATAR;
};
