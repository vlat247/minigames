import type { Auth } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APP_SESSION_STORAGE_KEY,
  APP_SESSION_TTL_MS,
  writeAppSession,
  type AppSession,
  type AppSessionProfile,
} from './app-session';
import {
  FIREBASE_SIGN_OUT_ERROR_MESSAGE,
  LOGOUT_SUCCESS_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  createSessionController,
  type SessionController,
  type SessionNotifier,
  type SessionSignOut,
} from './session-controller';

const AUTHENTICATED_AT = 1_789_012_345_000;
const OTHER_STORAGE_KEY = 'unrelated:preference';
const PROFILE: AppSessionProfile = {
  avatarUrl: 'https://example.com/ada.png',
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
};
const SESSION: AppSession = {
  ...PROFILE,
  authenticatedAt: AUTHENTICATED_AT,
};

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: Value | PromiseLike<Value>) => void;
}

interface PromiseConstructorWithResolvers {
  readonly withResolvers: <Value>() => Deferred<Value>;
}

interface ControllerHarness {
  readonly controller: SessionController;
  readonly notify: ReturnType<typeof vi.fn<SessionNotifier>>;
  readonly signOut: ReturnType<typeof vi.fn<SessionSignOut>>;
}

const createDeferred = <Value>(): Deferred<Value> => {
  const promiseConstructor = Promise as PromiseConstructor &
    PromiseConstructorWithResolvers;
  return promiseConstructor.withResolvers<Value>();
};

const createAuthWithoutReadableCurrentUser = (): Auth => {
  const auth = {};
  Object.defineProperty(auth, 'currentUser', {
    get: (): never => {
      throw new Error('currentUser must not be read');
    },
  });
  return auth as Auth;
};

const createHarness = (
  clock: () => number,
  overrides: {
    readonly notify?: SessionNotifier;
    readonly signOut?: SessionSignOut;
    readonly storage?: Storage;
  } = {},
): ControllerHarness => {
  const notify = vi.fn<SessionNotifier>(overrides.notify);
  const signOut = vi.fn<SessionSignOut>(
    overrides.signOut ?? (async (): Promise<void> => undefined),
  );
  const controller = createSessionController({
    auth: createAuthWithoutReadableCurrentUser(),
    clock,
    notify,
    signOut,
    storage: overrides.storage ?? localStorage,
  });

  return { controller, notify, signOut };
};

const writeSession = (session: AppSession = SESSION): void => {
  writeAppSession(session, localStorage);
};

const dispatchStorageChange = (key: string | null): void => {
  globalThis.dispatchEvent(new StorageEvent('storage', { key }));
};

describe('session controller', () => {
  const controllers: SessionController[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    for (const controller of controllers) {
      controller.destroy();
    }
    controllers.length = 0;
    vi.useRealTimers();
  });

  const track = (harness: ControllerHarness): ControllerHarness => {
    controllers.push(harness.controller);
    return harness;
  };

  it('starts in Guest Mode, signs Firebase out, and never promotes currentUser', async () => {
    const { controller, signOut } = track(
      createHarness(() => AUTHENTICATED_AT),
    );

    expect(controller.getSession()).toBeUndefined();
    expect(signOut).toHaveBeenCalledOnce();
    await expect(controller.ready).resolves.toBeUndefined();
    expect(controller.getSession()).toBeUndefined();
  });

  it('synchronously restores a valid stored session without changing it', async () => {
    writeSession();
    const storedJson = localStorage.getItem(APP_SESSION_STORAGE_KEY);
    const { controller, signOut } = track(
      createHarness(() => AUTHENTICATED_AT + 100_000),
    );

    expect(controller.getSession()).toEqual(SESSION);
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBe(storedJson);
    expect(signOut).not.toHaveBeenCalled();
    await expect(controller.ready).resolves.toBeUndefined();
  });

  it('keeps getSession cached until requireActiveSession validates storage', () => {
    let currentTime = AUTHENTICATED_AT + 1;
    writeSession();
    const { controller } = track(createHarness(() => currentTime));
    const replacement: AppSession = {
      authenticatedAt: AUTHENTICATED_AT + 50_000,
      displayName: 'Grace Hopper',
      email: 'grace@example.com',
    };
    currentTime = replacement.authenticatedAt + 1;
    writeSession(replacement);

    expect(controller.getSession()).toEqual(SESSION);
    expect(controller.requireActiveSession()).toEqual(replacement);
    expect(controller.getSession()).toEqual(replacement);
  });

  it('immediately sends subscribers the snapshot and emits only real changes', () => {
    writeSession();
    const { controller } = track(createHarness(() => AUTHENTICATED_AT + 1));
    const subscriber = vi.fn();
    const unsubscribe = controller.subscribe(subscriber);

    expect(subscriber).toHaveBeenCalledOnce();
    expect(subscriber).toHaveBeenLastCalledWith(SESSION);
    controller.requireActiveSession();
    globalThis.dispatchEvent(new Event('focus'));
    expect(subscriber).toHaveBeenCalledOnce();

    localStorage.removeItem(APP_SESSION_STORAGE_KEY);
    controller.requireActiveSession();
    expect(subscriber).toHaveBeenLastCalledWith(undefined);
    expect(subscriber).toHaveBeenCalledTimes(2);

    unsubscribe();
    writeSession();
    controller.requireActiveSession();
    expect(subscriber).toHaveBeenCalledTimes(2);
  });

  it('expires at exactly five minutes, preserves unrelated storage, and notifies once', async () => {
    let currentTime = AUTHENTICATED_AT;
    writeSession();
    localStorage.setItem(OTHER_STORAGE_KEY, 'keep me');
    const { controller, notify, signOut } = track(
      createHarness(() => currentTime),
    );

    currentTime += APP_SESSION_TTL_MS - 1;
    await vi.advanceTimersByTimeAsync(APP_SESSION_TTL_MS - 1);
    expect(controller.getSession()).toEqual(SESSION);

    currentTime += 1;
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(OTHER_STORAGE_KEY)).toBe('keep me');
    expect(signOut).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith({
      message: SESSION_EXPIRED_MESSAGE,
      variant: 'error',
    });

    controller.requireActiveSession();
    globalThis.dispatchEvent(new Event('focus'));
    expect(signOut).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('re-reads storage at the timer boundary and reschedules a replacement session', async () => {
    let currentTime = AUTHENTICATED_AT;
    writeSession();
    const { controller, notify, signOut } = track(
      createHarness(() => currentTime),
    );
    const replacement: AppSession = {
      ...SESSION,
      authenticatedAt: AUTHENTICATED_AT + 100_000,
    };
    writeSession(replacement);

    currentTime += APP_SESSION_TTL_MS;
    await vi.advanceTimersByTimeAsync(APP_SESSION_TTL_MS);
    expect(controller.getSession()).toEqual(replacement);
    expect(notify).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();

    currentTime = replacement.authenticatedAt + APP_SESSION_TTL_MS;
    await vi.advanceTimersByTimeAsync(100_000);
    expect(controller.getSession()).toBeUndefined();
    expect(notify).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('treats an edited future timestamp as invalid and deduplicates sign-out checks', () => {
    let currentTime = AUTHENTICATED_AT + 1;
    writeSession();
    localStorage.setItem(OTHER_STORAGE_KEY, 'keep me');
    const { controller, notify, signOut } = track(
      createHarness(() => currentTime),
    );
    currentTime = AUTHENTICATED_AT + 10;
    writeSession({ ...SESSION, authenticatedAt: currentTime + 1 });

    expect(controller.requireActiveSession()).toBeUndefined();
    expect(controller.requireActiveSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(OTHER_STORAGE_KEY)).toBe('keep me');
    expect(signOut).toHaveBeenCalledOnce();
    expect(notify).not.toHaveBeenCalled();
  });

  it('reports a stored expired session once during startup', () => {
    writeSession();
    const { controller, notify, signOut } = track(
      createHarness(() => AUTHENTICATED_AT + APP_SESSION_TTL_MS),
    );

    expect(controller.getSession()).toBeUndefined();
    expect(signOut).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith({
      message: SESSION_EXPIRED_MESSAGE,
      variant: 'error',
    });
    controller.requireActiveSession();
    expect(notify).toHaveBeenCalledOnce();
  });

  it('removes invalid startup data and reconciles Firebase to Guest Mode', async () => {
    localStorage.setItem(APP_SESSION_STORAGE_KEY, '{invalid json');
    localStorage.setItem(OTHER_STORAGE_KEY, 'keep me');
    const { controller, notify, signOut } = track(
      createHarness(() => AUTHENTICATED_AT),
    );

    await expect(controller.ready).resolves.toBeUndefined();
    expect(controller.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(OTHER_STORAGE_KEY)).toBe('keep me');
    expect(signOut).toHaveBeenCalledOnce();
    expect(notify).not.toHaveBeenCalled();
  });

  it('waits for startup sign-out before establishing an exact new session', async () => {
    const deferred = createDeferred<void>();
    let currentTime = AUTHENTICATED_AT;
    const { controller } = track(
      createHarness(() => currentTime, {
        signOut: (): Promise<void> => deferred.promise,
      }),
    );
    const subscriber = vi.fn();
    controller.subscribe(subscriber);
    const sessionPromise = controller.establishSession(PROFILE);

    expect(controller.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    deferred.resolve();
    const session = await sessionPromise;

    expect(session).toEqual(SESSION);
    expect(controller.getSession()).toEqual(SESSION);
    expect(
      JSON.parse(localStorage.getItem(APP_SESSION_STORAGE_KEY) ?? ''),
    ).toEqual(SESSION);
    expect(subscriber).toHaveBeenNthCalledWith(1, undefined);
    expect(subscriber).toHaveBeenNthCalledWith(2, SESSION);

    currentTime += APP_SESSION_TTL_MS;
    await vi.advanceTimersByTimeAsync(APP_SESSION_TTL_MS);
    expect(controller.getSession()).toBeUndefined();
  });

  it('logs out to Guest Mode immediately and reports success after Firebase settles', async () => {
    writeSession();
    localStorage.setItem(OTHER_STORAGE_KEY, 'keep me');
    const deferred = createDeferred<void>();
    const { controller, notify, signOut } = track(
      createHarness(() => AUTHENTICATED_AT + 1, {
        signOut: (): Promise<void> => deferred.promise,
      }),
    );
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    const logoutPromise = controller.logout();
    expect(controller.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(OTHER_STORAGE_KEY)).toBe('keep me');
    expect(subscriber).toHaveBeenLastCalledWith(undefined);
    expect(signOut).toHaveBeenCalledOnce();
    expect(notify).not.toHaveBeenCalled();

    deferred.resolve();
    await logoutPromise;
    expect(notify).toHaveBeenCalledWith({
      message: LOGOUT_SUCCESS_MESSAGE,
      variant: 'success',
    });
  });

  it('keeps Guest Mode and reports Firebase sign-out rejection without rejecting', async () => {
    writeSession();
    const { controller, notify } = track(
      createHarness(() => AUTHENTICATED_AT + 1, {
        signOut: async (): Promise<void> => {
          throw new Error('network unavailable');
        },
      }),
    );

    await expect(controller.logout()).resolves.toBeUndefined();
    expect(controller.getSession()).toBeUndefined();
    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith({
      message: FIREBASE_SIGN_OUT_ERROR_MESSAGE,
      variant: 'error',
    });
    expect(notify).not.toHaveBeenCalledWith({
      message: LOGOUT_SUCCESS_MESSAGE,
      variant: 'success',
    });
  });

  it('catches a synchronous sign-out failure during startup', async () => {
    const { controller, notify } = track(
      createHarness(() => AUTHENTICATED_AT, {
        signOut: (): Promise<void> => {
          throw new Error('misconfigured auth');
        },
      }),
    );

    await expect(controller.ready).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledWith({
      message: FIREBASE_SIGN_OUT_ERROR_MESSAGE,
      variant: 'error',
    });
  });

  it('re-checks sessions on focus, pageshow, visible, and matching storage events', () => {
    let currentTime = AUTHENTICATED_AT + 1;
    writeSession();
    const { controller } = track(createHarness(() => currentTime));
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    const replaceStoredSession = (offset: number, name: string): AppSession => {
      const session: AppSession = {
        authenticatedAt: AUTHENTICATED_AT + offset,
        displayName: name,
        email: `${name.toLocaleLowerCase()}@example.com`,
      };
      currentTime = session.authenticatedAt + 1;
      writeSession(session);
      return session;
    };

    const focusSession = replaceStoredSession(10, 'Focus');
    globalThis.dispatchEvent(new Event('focus'));
    expect(controller.getSession()).toEqual(focusSession);

    const pageShowSession = replaceStoredSession(20, 'PageShow');
    globalThis.dispatchEvent(new PageTransitionEvent('pageshow'));
    expect(controller.getSession()).toEqual(pageShowSession);

    const visibilitySession = replaceStoredSession(30, 'Visibility');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(controller.getSession()).toEqual(visibilitySession);

    const ignoredSession = replaceStoredSession(40, 'Ignored');
    dispatchStorageChange('some-other-key');
    expect(controller.getSession()).toEqual(visibilitySession);

    dispatchStorageChange(APP_SESSION_STORAGE_KEY);
    expect(controller.getSession()).toEqual(ignoredSession);
    expect(subscriber).toHaveBeenCalledTimes(5);
  });

  it('ignores visibility changes while hidden and handles cross-tab storage clearing', () => {
    let currentTime = AUTHENTICATED_AT + 1;
    writeSession();
    const { controller, signOut } = track(createHarness(() => currentTime));
    const visibilityState = vi.spyOn(document, 'visibilityState', 'get');
    const replacement: AppSession = {
      ...SESSION,
      authenticatedAt: AUTHENTICATED_AT + 10,
      displayName: 'Hidden replacement',
    };
    currentTime = replacement.authenticatedAt + 1;
    writeSession(replacement);

    visibilityState.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(controller.getSession()).toEqual(SESSION);

    visibilityState.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(controller.getSession()).toEqual(replacement);

    localStorage.removeItem(APP_SESSION_STORAGE_KEY);
    dispatchStorageChange(null);
    expect(controller.getSession()).toBeUndefined();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('destroy removes checks, timers, subscribers, and later async notifications', async () => {
    writeSession();
    const deferred = createDeferred<void>();
    const { controller, notify, signOut } = track(
      createHarness(() => AUTHENTICATED_AT, {
        signOut: (): Promise<void> => deferred.promise,
      }),
    );
    const subscriber = vi.fn();
    controller.subscribe(subscriber);
    const logoutPromise = controller.logout();
    expect(subscriber).toHaveBeenCalledTimes(2);

    controller.destroy();
    deferred.reject(new Error('late failure'));
    await expect(logoutPromise).resolves.toBeUndefined();
    expect(notify).not.toHaveBeenCalled();

    writeSession();
    globalThis.dispatchEvent(new Event('focus'));
    dispatchStorageChange(APP_SESSION_STORAGE_KEY);
    await vi.advanceTimersByTimeAsync(APP_SESSION_TTL_MS);
    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(signOut).toHaveBeenCalledOnce();
  });
});
