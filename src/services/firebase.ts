import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from 'firebase/auth';

import {
  getFirebaseConfig,
  type FirebaseConfig,
} from '../config/firebase-config';

const FIREBASE_APP_NAME: string = 'minigames';

export interface FirebaseServices {
  readonly app: FirebaseApp;
  readonly auth: Auth;
}

const getOrCreateFirebaseApp = (config: FirebaseConfig): FirebaseApp => {
  const existingApp: FirebaseApp | undefined = getApps().find(
    (app: FirebaseApp): boolean => app.name === FIREBASE_APP_NAME,
  );

  return existingApp ?? initializeApp(config.options, FIREBASE_APP_NAME);
};

const createFirebaseInitializer = (): (() => FirebaseServices) => {
  let services: FirebaseServices | undefined;

  return (): FirebaseServices => {
    if (services !== undefined) {
      return services;
    }

    const config: FirebaseConfig = getFirebaseConfig();
    const app: FirebaseApp = getOrCreateFirebaseApp(config);
    const auth: Auth = getAuth(app);

    if (
      import.meta.env.DEV &&
      config.authEmulatorUrl !== undefined &&
      auth.emulatorConfig === null
    ) {
      connectAuthEmulator(auth, config.authEmulatorUrl, {
        disableWarnings: true,
      });
    }

    services = { app, auth };
    return services;
  };
};

export const initializeFirebase: () => FirebaseServices =
  createFirebaseInitializer();

export const createGoogleAuthProvider = (): GoogleAuthProvider => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  return provider;
};
