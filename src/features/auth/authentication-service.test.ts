import type { Auth, AuthProvider, User, UserCredential } from 'firebase/auth';
import { describe, expect, it, vi } from 'vitest';

import {
  AUTHENTICATION_ERROR_MESSAGES,
  AuthenticationError,
  createAuthenticationService,
  getAuthenticationErrorMessage,
  type AuthenticationDependencies,
  type AuthenticationSessionController,
} from './authentication-service';

const PASSWORD = 'Secure1!';
const PROVIDER = {} as AuthProvider;

const USER = {
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
  photoURL: ' https://example.com/ada.png ',
} as User;

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: Value | PromiseLike<Value>) => void;
}

interface PromiseConstructorWithResolvers {
  readonly withResolvers: <Value>() => Deferred<Value>;
}

interface HarnessOptions {
  readonly ready?: Promise<void>;
  readonly user?: User;
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

const createCredential = (user: User): UserCredential =>
  ({ user }) as UserCredential;

const createHarness = (options: HarnessOptions = {}) => {
  const auth = createAuthWithoutReadableCurrentUser();
  const credential = createCredential(options.user ?? USER);
  const createGoogleAuthProvider = vi.fn<
    AuthenticationDependencies['createGoogleAuthProvider']
  >(() => PROVIDER);
  const createUserWithEmailAndPassword = vi.fn<
    AuthenticationDependencies['createUserWithEmailAndPassword']
  >(async () => credential);
  const signInWithEmailAndPassword = vi.fn<
    AuthenticationDependencies['signInWithEmailAndPassword']
  >(async () => credential);
  const signInWithPopup = vi.fn<AuthenticationDependencies['signInWithPopup']>(
    async () => credential,
  );
  const signOut = vi.fn<AuthenticationDependencies['signOut']>(() =>
    Promise.resolve(),
  );
  const updateProfile = vi.fn<AuthenticationDependencies['updateProfile']>(() =>
    Promise.resolve(),
  );
  const establishSession = vi.fn<
    AuthenticationSessionController['establishSession']
  >(() => Promise.resolve());
  const sessionController: AuthenticationSessionController = {
    establishSession,
    ready: options.ready ?? Promise.resolve(),
  };
  const dependencies: AuthenticationDependencies = {
    createGoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
  };
  const service = createAuthenticationService({
    auth,
    dependencies,
    sessionController,
  });

  return {
    auth,
    createGoogleAuthProvider,
    createUserWithEmailAndPassword,
    establishSession,
    service,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
  };
};

describe('authentication service', () => {
  it('waits for session startup before requesting email credentials', async () => {
    const ready = createDeferred<void>();
    const harness = createHarness({ ready: ready.promise });

    const request = harness.service.login({
      email: '  ada@example.com  ',
      password: PASSWORD,
    });

    expect(harness.signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(harness.establishSession).not.toHaveBeenCalled();

    ready.resolve();
    await expect(request).resolves.toBeUndefined();
    expect(harness.signInWithEmailAndPassword).toHaveBeenCalledWith(
      harness.auth,
      'ada@example.com',
      PASSWORD,
    );
    expect(harness.establishSession).toHaveBeenCalledWith({
      avatarUrl: 'https://example.com/ada.png',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
    });
    expect(harness.signOut).not.toHaveBeenCalled();
  });

  it('creates an account, stores the trimmed username, then establishes the app session', async () => {
    const harness = createHarness();

    await expect(
      harness.service.register({
        email: '  ada@example.com ',
        password: PASSWORD,
        username: '  AdaPlayer ',
      }),
    ).resolves.toBeUndefined();

    expect(harness.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      harness.auth,
      'ada@example.com',
      PASSWORD,
    );
    expect(harness.updateProfile).toHaveBeenCalledWith(USER, {
      displayName: 'AdaPlayer',
    });
    expect(harness.establishSession).toHaveBeenCalledWith({
      avatarUrl: 'https://example.com/ada.png',
      displayName: 'AdaPlayer',
      email: 'ada@example.com',
    });
    expect(harness.updateProfile.mock.invocationCallOrder[0]).toBeLessThan(
      harness.establishSession.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('uses a fresh Google provider and maps nullable user fields safely', async () => {
    const googleUser = {
      displayName: null,
      email: null,
      photoURL: ' '.repeat(3),
    } as User;
    const harness = createHarness({ user: googleUser });

    await expect(harness.service.signInWithGoogle()).resolves.toBeUndefined();

    expect(harness.createGoogleAuthProvider).toHaveBeenCalledOnce();
    expect(harness.signInWithPopup).toHaveBeenCalledWith(
      harness.auth,
      PROVIDER,
    );
    expect(harness.establishSession).toHaveBeenCalledWith({
      displayName: '',
      email: '',
    });
  });

  it('does not request credentials when session startup fails', async () => {
    const cause = new Error('startup sign-out failed');
    const harness = createHarness({ ready: Promise.reject(cause) });

    await expect(
      harness.service.login({ email: 'ada@example.com', password: PASSWORD }),
    ).rejects.toMatchObject({
      cause,
      code: 'session-setup-failed',
      message: AUTHENTICATION_ERROR_MESSAGES['session-setup-failed'],
      name: 'AuthenticationError',
    });
    expect(harness.signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(harness.signOut).not.toHaveBeenCalled();
  });

  it('maps credential failures without signing out an unauthenticated request', async () => {
    const firebaseError = {
      code: 'auth/network-request-failed',
      message: 'internal Firebase details',
    };
    const harness = createHarness();
    harness.signInWithEmailAndPassword.mockRejectedValueOnce(firebaseError);

    await expect(
      harness.service.login({ email: 'ada@example.com', password: PASSWORD }),
    ).rejects.toMatchObject({
      cause: firebaseError,
      code: 'network-request-failed',
      message: AUTHENTICATION_ERROR_MESSAGES['network-request-failed'],
      name: 'AuthenticationError',
    });
    expect(harness.establishSession).not.toHaveBeenCalled();
    expect(harness.signOut).not.toHaveBeenCalled();
  });

  it('signs Firebase out if registration profile setup fails and preserves the primary cause', async () => {
    const cause = new Error('profile write failed');
    const cleanupError = new Error('cleanup failed');
    const harness = createHarness();
    harness.updateProfile.mockRejectedValueOnce(cause);
    harness.signOut.mockRejectedValueOnce(cleanupError);

    await expect(
      harness.service.register({
        email: 'ada@example.com',
        password: PASSWORD,
        username: 'AdaPlayer',
      }),
    ).rejects.toMatchObject({
      cause,
      code: 'account-created-setup-failed',
      message: AUTHENTICATION_ERROR_MESSAGES['account-created-setup-failed'],
    });
    expect(harness.signOut).toHaveBeenCalledWith(harness.auth);
    expect(harness.establishSession).not.toHaveBeenCalled();
  });

  it('signs Firebase out if registration cannot establish the app session', async () => {
    const cause = new DOMException('storage unavailable', 'QuotaExceededError');
    const harness = createHarness();
    harness.establishSession.mockRejectedValueOnce(cause);

    await expect(
      harness.service.register({
        email: 'ada@example.com',
        password: PASSWORD,
        username: 'AdaPlayer',
      }),
    ).rejects.toMatchObject({
      cause,
      code: 'account-created-setup-failed',
    });
    expect(harness.updateProfile).toHaveBeenCalledOnce();
    expect(harness.signOut).toHaveBeenCalledWith(harness.auth);
  });

  it.each([
    ['email login', 'login'],
    ['Google login', 'google'],
  ] as const)(
    'signs Firebase out when %s succeeds but app-session setup fails',
    async (_label, method) => {
      const cause = new Error('session storage failed');
      const harness = createHarness();
      harness.establishSession.mockRejectedValueOnce(cause);

      const request =
        method === 'login'
          ? harness.service.login({
              email: 'ada@example.com',
              password: PASSWORD,
            })
          : harness.service.signInWithGoogle();

      await expect(request).rejects.toMatchObject({
        cause,
        code: 'session-setup-failed',
        message: AUTHENTICATION_ERROR_MESSAGES['session-setup-failed'],
      });
      expect(harness.signOut).toHaveBeenCalledWith(harness.auth);
    },
  );

  it('turns a Google provider construction failure into a safe error', async () => {
    const cause = new Error('sensitive provider details');
    const harness = createHarness();
    harness.createGoogleAuthProvider.mockImplementationOnce(() => {
      throw cause;
    });

    await expect(harness.service.signInWithGoogle()).rejects.toMatchObject({
      cause,
      code: 'unknown',
      message: AUTHENTICATION_ERROR_MESSAGES.unknown,
    });
    expect(harness.signInWithPopup).not.toHaveBeenCalled();
    expect(harness.signOut).not.toHaveBeenCalled();
  });
});

describe('authentication error messages', () => {
  it.each([
    ['auth/invalid-credential', 'invalid-credentials'],
    ['auth/wrong-password', 'invalid-credentials'],
    ['auth/user-not-found', 'invalid-credentials'],
    ['auth/email-already-in-use', 'email-already-in-use'],
    ['auth/weak-password', 'weak-password'],
    ['auth/invalid-email', 'invalid-email'],
    ['auth/too-many-requests', 'too-many-requests'],
    ['auth/network-request-failed', 'network-request-failed'],
    ['auth/popup-closed-by-user', 'popup-canceled'],
    ['auth/popup-blocked', 'popup-blocked'],
    ['auth/unauthorized-domain', 'unauthorized-domain'],
    ['auth/canceled-popup-request', 'popup-canceled'],
    ['auth/cancelled-popup-request', 'popup-canceled'],
  ] as const)(
    'maps %s to a safe %s message',
    (firebaseCode, authenticationCode) => {
      expect(getAuthenticationErrorMessage({ code: firebaseCode })).toBe(
        AUTHENTICATION_ERROR_MESSAGES[authenticationCode],
      );
    },
  );

  it('returns an existing typed error message unchanged', () => {
    const error = new AuthenticationError('popup-blocked');

    expect(getAuthenticationErrorMessage(error)).toBe(error.message);
  });

  it.each([
    new Error('internal implementation details'),
    { code: 500 },
    { code: 'auth/unrecognized-failure' },
    'raw failure',
    null,
  ])('hides unknown error details from users: %j', (error) => {
    expect(getAuthenticationErrorMessage(error)).toBe(
      AUTHENTICATION_ERROR_MESSAGES.unknown,
    );
  });
});
