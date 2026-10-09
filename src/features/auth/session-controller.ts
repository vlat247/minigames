import { signOut as firebaseSignOut, type Auth } from 'firebase/auth';

import { dispatchSnackbar } from '../../components/snackbar/snackbar-events';
import type { SnackbarOptions } from '../../components/snackbar/snackbar';
import {
  APP_SESSION_STORAGE_KEY,
  APP_SESSION_TTL_MS,
  clearAppSession,
  createAppSession,
  readAppSession,
  writeAppSession,
  type AppSession,
  type AppSessionClock,
  type AppSessionProfile,
} from './app-session';

export const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please log in again.' as const;

export const LOGOUT_SUCCESS_MESSAGE = 'You have been logged out.' as const;

export const FIREBASE_SIGN_OUT_ERROR_MESSAGE =
  'We could not complete Firebase sign-out. You are still in Guest Mode.' as const;

export type SessionSubscriber = (session: AppSession | undefined) => void;

export type SessionSignOut = (auth: Auth) => Promise<void>;

export type SessionNotifier = (options: SnackbarOptions) => void;

export interface SessionControllerOptions {
  readonly auth: Auth;
  readonly clock?: AppSessionClock;
  readonly notify?: SessionNotifier;
  readonly signOut?: SessionSignOut;
  readonly storage?: Storage;
}

export interface SessionController {
  /**
   * Resolves after any Firebase sign-out required during startup settles.
   */
  readonly ready: Promise<void>;
  readonly destroy: () => void;
  readonly establishSession: (
    profile: AppSessionProfile,
  ) => Promise<AppSession>;
  /**
   * Returns the last validated in-memory snapshot without touching storage.
   */
  readonly getSession: () => AppSession | undefined;
  readonly logout: () => Promise<void>;
  /**
   * Re-reads and validates storage before returning an authenticated session.
   */
  readonly requireActiveSession: () => AppSession | undefined;
  readonly subscribe: (subscriber: SessionSubscriber) => () => void;
}

interface SignOutAttempt {
  readonly result: Promise<boolean>;
}

const areSessionsEqual = (
  first: AppSession | undefined,
  second: AppSession | undefined,
): boolean =>
  first === second ||
  (first !== undefined &&
    second !== undefined &&
    first.authenticatedAt === second.authenticatedAt &&
    first.avatarUrl === second.avatarUrl &&
    first.displayName === second.displayName &&
    first.email === second.email);

export const createSessionController = (
  options: SessionControllerOptions,
): SessionController => {
  const {
    auth,
    clock = Date.now,
    notify = dispatchSnackbar,
    signOut = firebaseSignOut,
    storage = globalThis.localStorage,
  } = options;
  const subscribers = new Set<SessionSubscriber>();
  let cachedSession: AppSession | undefined;
  let isDestroyed = false;
  let expirationTimer: number | undefined;
  let guestSignOutAttempt: SignOutAttempt | undefined;

  const notifyWhileActive = (notification: SnackbarOptions): void => {
    if (!isDestroyed) {
      notify(notification);
    }
  };

  const clearExpirationTimer = (): void => {
    if (expirationTimer === undefined) {
      return;
    }

    globalThis.clearTimeout(expirationTimer);
    expirationTimer = undefined;
  };

  const publishSession = (session: AppSession | undefined): void => {
    if (isDestroyed || areSessionsEqual(cachedSession, session)) {
      return;
    }

    cachedSession = session;
    for (const subscriber of subscribers) {
      subscriber(session);
    }
  };

  const requestFirebaseSignOut = (): Promise<boolean> => {
    if (guestSignOutAttempt !== undefined) {
      return guestSignOutAttempt.result;
    }

    const result = (async (): Promise<boolean> => {
      try {
        await signOut(auth);
        return true;
      } catch {
        notifyWhileActive({
          message: FIREBASE_SIGN_OUT_ERROR_MESSAGE,
          variant: 'error',
        });
        return false;
      }
    })();

    guestSignOutAttempt = { result };
    return result;
  };

  const enterGuestMode = (isExpired: boolean): void => {
    clearExpirationTimer();
    publishSession(undefined);

    if (isExpired) {
      notifyWhileActive({
        message: SESSION_EXPIRED_MESSAGE,
        variant: 'error',
      });
    }

    void requestFirebaseSignOut();
  };

  const reconcileStoredSession = (): AppSession | undefined => {
    if (isDestroyed) {
      return cachedSession;
    }

    let result: ReturnType<typeof readAppSession>;

    try {
      result = readAppSession(storage, clock);
    } catch {
      try {
        clearAppSession(storage);
      } catch {
        // The in-memory state must still become Guest Mode when storage fails.
      }
      enterGuestMode(false);
      return undefined;
    }

    if (result.status !== 'valid') {
      enterGuestMode(result.status === 'expired');
      return undefined;
    }

    guestSignOutAttempt = undefined;
    publishSession(result.session);
    clearExpirationTimer();

    const remainingLifetime = result.expiresAt - clock();
    if (remainingLifetime <= 0) {
      return reconcileStoredSession();
    }

    expirationTimer = globalThis.setTimeout((): void => {
      expirationTimer = undefined;
      reconcileStoredSession();
    }, remainingLifetime);

    return cachedSession;
  };

  const startupSession = reconcileStoredSession();
  const ready: Promise<void> = (async (): Promise<void> => {
    if (startupSession === undefined && guestSignOutAttempt !== undefined) {
      await guestSignOutAttempt.result;
    }
  })();

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      reconcileStoredSession();
    }
  };
  const onFocus = (): void => {
    reconcileStoredSession();
  };
  const onPageShow = (): void => {
    reconcileStoredSession();
  };
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === APP_SESSION_STORAGE_KEY) {
      reconcileStoredSession();
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  globalThis.addEventListener('focus', onFocus);
  globalThis.addEventListener('pageshow', onPageShow);
  globalThis.addEventListener('storage', onStorage);

  return {
    ready,
    destroy: (): void => {
      if (isDestroyed) {
        return;
      }

      isDestroyed = true;
      clearExpirationTimer();
      subscribers.clear();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      globalThis.removeEventListener('focus', onFocus);
      globalThis.removeEventListener('pageshow', onPageShow);
      globalThis.removeEventListener('storage', onStorage);
    },
    establishSession: async (
      profile: AppSessionProfile,
    ): Promise<AppSession> => {
      await ready;
      if (guestSignOutAttempt !== undefined) {
        await guestSignOutAttempt.result;
      }
      if (isDestroyed) {
        throw new Error('The session controller has been destroyed.');
      }

      const session = createAppSession(profile, clock);
      writeAppSession(session, storage);
      guestSignOutAttempt = undefined;
      publishSession(session);
      clearExpirationTimer();
      const remainingLifetime =
        session.authenticatedAt + APP_SESSION_TTL_MS - clock();
      if (remainingLifetime <= 0) {
        reconcileStoredSession();
        return session;
      }
      expirationTimer = globalThis.setTimeout((): void => {
        expirationTimer = undefined;
        reconcileStoredSession();
      }, remainingLifetime);
      return session;
    },
    getSession: (): AppSession | undefined => cachedSession,
    logout: async (): Promise<void> => {
      if (isDestroyed) {
        return;
      }

      try {
        clearAppSession(storage);
      } catch {
        // Guest Mode remains safer than retaining authenticated UI state.
      }
      enterGuestMode(false);
      const signedOut = await requestFirebaseSignOut();

      if (signedOut) {
        notifyWhileActive({
          message: LOGOUT_SUCCESS_MESSAGE,
          variant: 'success',
        });
      }
    },
    requireActiveSession: (): AppSession | undefined =>
      reconcileStoredSession(),
    subscribe: (subscriber: SessionSubscriber): (() => void) => {
      if (isDestroyed) {
        return (): void => undefined;
      }

      subscribers.add(subscriber);
      subscriber(cachedSession);

      return (): void => {
        subscribers.delete(subscriber);
      };
    },
  };
};
