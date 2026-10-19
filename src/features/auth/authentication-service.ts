import {
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  signInWithPopup as firebaseSignInWithPopup,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  type Auth,
  type AuthProvider,
  type User,
  type UserCredential,
} from 'firebase/auth';

import { createGoogleAuthProvider } from '../../services/firebase';
import type { AppSessionProfile } from './app-session';

export const LOGIN_SUCCESS_MESSAGE = 'Welcome back! You are now signed in.';

export const REGISTRATION_SUCCESS_MESSAGE = 'Your account has been created.';

export const GOOGLE_SIGN_IN_SUCCESS_MESSAGE =
  'You are now signed in with Google.';

export const AUTHENTICATION_ERROR_MESSAGES = {
  'account-created-setup-failed':
    'Your account was created, but setup could not finish. Please sign in to continue.',
  'email-already-in-use':
    'An account already exists for this email address. Please sign in instead.',
  'invalid-credentials': 'The email or password is incorrect.',
  'invalid-email': 'Enter a valid email address.',
  'network-request-failed':
    'We could not reach the authentication service. Check your connection and try again.',
  'popup-blocked':
    'Your browser blocked the Google sign-in window. Allow popups and try again.',
  'popup-canceled': 'Google sign-in was canceled. Please try again.',
  'session-setup-failed':
    'You signed in, but the app session could not start. Please try again.',
  'too-many-requests':
    'Too many sign-in attempts. Please wait a moment and try again.',
  'unauthorized-domain':
    'Google sign-in is not available from this website address.',
  unknown: 'We could not complete authentication. Please try again.',
  'weak-password': 'Choose a stronger password and try again.',
} as const;

export type AuthenticationErrorCode =
  keyof typeof AUTHENTICATION_ERROR_MESSAGES;

export class AuthenticationError extends Error {
  public readonly code: AuthenticationErrorCode;

  public constructor(code: AuthenticationErrorCode, options?: ErrorOptions) {
    super(AUTHENTICATION_ERROR_MESSAGES[code], options);
    this.name = 'AuthenticationError';
    this.code = code;
  }
}

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

export interface RegistrationCredentials extends LoginCredentials {
  readonly username: string;
}

export interface AuthenticationService {
  readonly login: (credentials: LoginCredentials) => Promise<void>;
  readonly register: (credentials: RegistrationCredentials) => Promise<void>;
  readonly signInWithGoogle: () => Promise<void>;
}

export interface AuthenticationSessionController {
  readonly establishSession: (profile: AppSessionProfile) => Promise<unknown>;
  readonly prepareForAuthentication: () => Promise<void>;
}

export interface AuthenticationDependencies {
  readonly createGoogleAuthProvider: () => AuthProvider;
  readonly createUserWithEmailAndPassword: (
    auth: Auth,
    email: string,
    password: string,
  ) => Promise<UserCredential>;
  readonly signInWithEmailAndPassword: (
    auth: Auth,
    email: string,
    password: string,
  ) => Promise<UserCredential>;
  readonly signInWithPopup: (
    auth: Auth,
    provider: AuthProvider,
  ) => Promise<UserCredential>;
  readonly signOut: (auth: Auth) => Promise<void>;
  readonly updateProfile: (
    user: User,
    profile: { readonly displayName: string },
  ) => Promise<void>;
}

export interface AuthenticationServiceOptions {
  readonly auth: Auth;
  readonly dependencies?: Partial<AuthenticationDependencies>;
  readonly sessionController: AuthenticationSessionController;
}

const DEFAULT_AUTHENTICATION_DEPENDENCIES: AuthenticationDependencies = {
  createGoogleAuthProvider,
  createUserWithEmailAndPassword: firebaseCreateUserWithEmailAndPassword,
  signInWithEmailAndPassword: firebaseSignInWithEmailAndPassword,
  signInWithPopup: firebaseSignInWithPopup,
  signOut: firebaseSignOut,
  updateProfile: firebaseUpdateProfile,
};

const FIREBASE_ERROR_CODES: Readonly<Record<string, AuthenticationErrorCode>> =
  {
    'auth/canceled-popup-request': 'popup-canceled',
    'auth/cancelled-popup-request': 'popup-canceled',
    'auth/email-already-in-use': 'email-already-in-use',
    'auth/invalid-credential': 'invalid-credentials',
    'auth/invalid-email': 'invalid-email',
    'auth/network-request-failed': 'network-request-failed',
    'auth/popup-blocked': 'popup-blocked',
    'auth/popup-closed-by-user': 'popup-canceled',
    'auth/too-many-requests': 'too-many-requests',
    'auth/unauthorized-domain': 'unauthorized-domain',
    'auth/user-not-found': 'invalid-credentials',
    'auth/weak-password': 'weak-password',
    'auth/wrong-password': 'invalid-credentials',
  };

const getFirebaseErrorCode = (error: unknown): string | undefined => {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
};

const normalizeAuthenticationError = (error: unknown): AuthenticationError => {
  if (error instanceof AuthenticationError) {
    return error;
  }

  const firebaseCode = getFirebaseErrorCode(error);
  const code =
    firebaseCode === undefined
      ? 'unknown'
      : (FIREBASE_ERROR_CODES[firebaseCode] ?? 'unknown');

  return new AuthenticationError(code, { cause: error });
};

export const getAuthenticationErrorMessage = (error: unknown): string =>
  normalizeAuthenticationError(error).message;

const getUserProfile = (
  user: User,
  displayNameOverride?: string,
): AppSessionProfile => {
  const avatarUrl = user.photoURL?.trim();
  const profile = {
    displayName: displayNameOverride ?? user.displayName ?? '',
    email: user.email ?? '',
  };

  return avatarUrl === undefined || avatarUrl.length === 0
    ? profile
    : { ...profile, avatarUrl };
};

export const createAuthenticationService = (
  options: AuthenticationServiceOptions,
): AuthenticationService => {
  const { auth, sessionController } = options;
  const dependencies: AuthenticationDependencies = {
    ...DEFAULT_AUTHENTICATION_DEPENDENCIES,
    ...options.dependencies,
  };

  const waitUntilSessionReady = async (): Promise<void> => {
    try {
      await sessionController.prepareForAuthentication();
    } catch (error: unknown) {
      throw new AuthenticationError('session-setup-failed', { cause: error });
    }
  };

  const requestCredentials = async (
    request: () => Promise<UserCredential>,
  ): Promise<UserCredential> => {
    await waitUntilSessionReady();

    try {
      return await request();
    } catch (error: unknown) {
      throw normalizeAuthenticationError(error);
    }
  };

  const signOutAfterFailure = async (): Promise<void> => {
    try {
      await dependencies.signOut(auth);
    } catch {
      // Cleanup must never replace the primary setup failure shown to the user.
    }
  };

  const establishAuthenticatedSession = async (user: User): Promise<void> => {
    try {
      await sessionController.establishSession(getUserProfile(user));
    } catch (error: unknown) {
      await signOutAfterFailure();
      throw new AuthenticationError('session-setup-failed', { cause: error });
    }
  };

  return {
    login: async (credentials: LoginCredentials): Promise<void> => {
      const credential = await requestCredentials(() =>
        dependencies.signInWithEmailAndPassword(
          auth,
          credentials.email.trim(),
          credentials.password,
        ),
      );

      await establishAuthenticatedSession(credential.user);
    },
    register: async (credentials: RegistrationCredentials): Promise<void> => {
      const displayName = credentials.username.trim();
      const credential = await requestCredentials(() =>
        dependencies.createUserWithEmailAndPassword(
          auth,
          credentials.email.trim(),
          credentials.password,
        ),
      );

      try {
        await dependencies.updateProfile(credential.user, { displayName });
        await sessionController.establishSession(
          getUserProfile(credential.user, displayName),
        );
      } catch (error: unknown) {
        await signOutAfterFailure();
        throw new AuthenticationError('account-created-setup-failed', {
          cause: error,
        });
      }
    },
    signInWithGoogle: async (): Promise<void> => {
      const credential = await requestCredentials(() =>
        dependencies.signInWithPopup(
          auth,
          dependencies.createGoogleAuthProvider(),
        ),
      );

      await establishAuthenticatedSession(credential.user);
    },
  };
};
