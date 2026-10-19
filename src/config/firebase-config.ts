import type { FirebaseOptions } from 'firebase/app';

export type FirebaseEnvironmentVariable =
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_APP_ID'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_MESSAGING_SENDER_ID'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_STORAGE_BUCKET';

export interface FirebaseEnvironment {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_AUTH_EMULATOR_URL?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
}

export interface FirebaseConfig {
  readonly authEmulatorUrl: string | undefined;
  readonly options: FirebaseOptions;
}

export class FirebaseConfigError extends Error {
  public readonly missingVariables: readonly FirebaseEnvironmentVariable[];

  public constructor(missingVariables: readonly FirebaseEnvironmentVariable[]) {
    super(
      `Missing required Firebase environment variables: ${missingVariables.join(', ')}. Copy .env.example to .env.local and add your Firebase web app configuration.`,
    );
    this.name = 'FirebaseConfigError';
    this.missingVariables = [...missingVariables];
  }
}

const normalizeEnvironmentValue = (
  value: string | undefined,
): string | undefined => {
  const normalizedValue: string | undefined = value?.trim();
  return normalizedValue === undefined || normalizedValue.length === 0
    ? undefined
    : normalizedValue;
};

export const parseFirebaseConfig = (
  environment: FirebaseEnvironment,
): FirebaseConfig => {
  const apiKey: string | undefined = normalizeEnvironmentValue(
    environment.VITE_FIREBASE_API_KEY,
  );
  const authDomain: string | undefined = normalizeEnvironmentValue(
    environment.VITE_FIREBASE_AUTH_DOMAIN,
  );
  const projectId: string | undefined = normalizeEnvironmentValue(
    environment.VITE_FIREBASE_PROJECT_ID,
  );
  const storageBucket: string | undefined = normalizeEnvironmentValue(
    environment.VITE_FIREBASE_STORAGE_BUCKET,
  );
  const messagingSenderId: string | undefined = normalizeEnvironmentValue(
    environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
  );
  const appId: string | undefined = normalizeEnvironmentValue(
    environment.VITE_FIREBASE_APP_ID,
  );
  const missingVariables: readonly FirebaseEnvironmentVariable[] = [
    apiKey === undefined ? 'VITE_FIREBASE_API_KEY' : undefined,
    authDomain === undefined ? 'VITE_FIREBASE_AUTH_DOMAIN' : undefined,
    projectId === undefined ? 'VITE_FIREBASE_PROJECT_ID' : undefined,
    storageBucket === undefined ? 'VITE_FIREBASE_STORAGE_BUCKET' : undefined,
    messagingSenderId === undefined
      ? 'VITE_FIREBASE_MESSAGING_SENDER_ID'
      : undefined,
    appId === undefined ? 'VITE_FIREBASE_APP_ID' : undefined,
  ].filter(
    (variable): variable is FirebaseEnvironmentVariable =>
      variable !== undefined,
  );

  if (
    apiKey === undefined ||
    authDomain === undefined ||
    projectId === undefined ||
    storageBucket === undefined ||
    messagingSenderId === undefined ||
    appId === undefined
  ) {
    throw new FirebaseConfigError(missingVariables);
  }

  return {
    authEmulatorUrl: normalizeEnvironmentValue(
      environment.VITE_FIREBASE_AUTH_EMULATOR_URL,
    ),
    options: {
      apiKey,
      appId,
      authDomain,
      messagingSenderId,
      projectId,
      storageBucket,
    },
  };
};

export const getFirebaseConfig = (): FirebaseConfig => {
  return parseFirebaseConfig({
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_AUTH_EMULATOR_URL: import.meta.env
      .VITE_FIREBASE_AUTH_EMULATOR_URL,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env
      .VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  });
};
