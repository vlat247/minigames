import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FirebaseConfigError,
  getFirebaseConfig,
  parseFirebaseConfig,
  type FirebaseEnvironment,
  type FirebaseEnvironmentVariable,
} from './firebase-config';

const REQUIRED_VARIABLES = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const satisfies readonly FirebaseEnvironmentVariable[];

const COMPLETE_ENVIRONMENT: FirebaseEnvironment = {
  VITE_FIREBASE_API_KEY: 'api-key-value',
  VITE_FIREBASE_APP_ID: 'app-id-value',
  VITE_FIREBASE_AUTH_DOMAIN: 'auth-domain-value',
  VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
  VITE_FIREBASE_MESSAGING_SENDER_ID: 'messaging-sender-id-value',
  VITE_FIREBASE_PROJECT_ID: 'project-id-value',
  VITE_FIREBASE_STORAGE_BUCKET: 'storage-bucket-value',
};

const captureConfigError = (
  environment: FirebaseEnvironment,
): FirebaseConfigError => {
  try {
    parseFirebaseConfig(environment);
  } catch (error: unknown) {
    if (error instanceof FirebaseConfigError) {
      return error;
    }

    throw error;
  }

  throw new Error('Expected Firebase configuration parsing to fail.');
};

const createEnvironmentWithout = (
  variable: FirebaseEnvironmentVariable,
): FirebaseEnvironment => {
  const environment: Record<string, string | undefined> = {
    ...COMPLETE_ENVIRONMENT,
  };
  delete environment[variable];
  return environment;
};

const INVALID_REQUIRED_VALUE_CASES = REQUIRED_VARIABLES.flatMap(
  (variable) =>
    [
      {
        environment: createEnvironmentWithout(variable),
        invalidForm: 'omitted',
        variable,
      },
      {
        environment: { ...COMPLETE_ENVIRONMENT, [variable]: undefined },
        invalidForm: 'explicitly undefined',
        variable,
      },
      {
        environment: { ...COMPLETE_ENVIRONMENT, [variable]: '' },
        invalidForm: 'empty',
        variable,
      },
      {
        environment: { ...COMPLETE_ENVIRONMENT, [variable]: ' \t\n ' },
        invalidForm: 'whitespace-only',
        variable,
      },
    ] satisfies readonly {
      readonly environment: FirebaseEnvironment;
      readonly invalidForm: string;
      readonly variable: FirebaseEnvironmentVariable;
    }[],
);

describe('parseFirebaseConfig', () => {
  it('trims and maps every Firebase value into its SDK option', () => {
    expect(
      parseFirebaseConfig({
        VITE_FIREBASE_API_KEY: '  api-key-value  ',
        VITE_FIREBASE_APP_ID: '\tapp-id-value\n',
        VITE_FIREBASE_AUTH_DOMAIN: ' auth-domain-value ',
        VITE_FIREBASE_AUTH_EMULATOR_URL: ' http://127.0.0.1:9099 ',
        VITE_FIREBASE_MESSAGING_SENDER_ID: ' messaging-sender-id-value ',
        VITE_FIREBASE_PROJECT_ID: '\nproject-id-value\t',
        VITE_FIREBASE_STORAGE_BUCKET: ' storage-bucket-value ',
      }),
    ).toEqual({
      authEmulatorUrl: 'http://127.0.0.1:9099',
      options: {
        apiKey: 'api-key-value',
        appId: 'app-id-value',
        authDomain: 'auth-domain-value',
        messagingSenderId: 'messaging-sender-id-value',
        projectId: 'project-id-value',
        storageBucket: 'storage-bucket-value',
      },
    });
  });

  it.each([undefined, '', ' '.repeat(3), '\t\n'])(
    'treats an optional emulator value of %j as absent',
    (authEmulatorUrl) => {
      expect(
        parseFirebaseConfig({
          ...COMPLETE_ENVIRONMENT,
          VITE_FIREBASE_AUTH_EMULATOR_URL: authEmulatorUrl,
        }).authEmulatorUrl,
      ).toBeUndefined();
    },
  );

  it.each(INVALID_REQUIRED_VALUE_CASES)(
    'reports $variable when its value is $invalidForm',
    ({ environment, variable }) => {
      const error = captureConfigError(environment);

      expect(error).toMatchObject({
        missingVariables: [variable],
        name: 'FirebaseConfigError',
      });
      expect(error.message).toContain(variable);
    },
  );

  it('collects every invalid required variable in declaration order', () => {
    const error = captureConfigError({
      ...COMPLETE_ENVIRONMENT,
      VITE_FIREBASE_API_KEY: undefined,
      VITE_FIREBASE_APP_ID: '\t',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_STORAGE_BUCKET: ' '.repeat(3),
    });

    expect(error.missingVariables).toEqual([
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_APP_ID',
    ]);
    expect(error.message).toContain(
      'VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_APP_ID',
    );
  });

  it('reports every required variable when the environment is empty', () => {
    const error = captureConfigError({});

    expect(error.missingVariables).toEqual(REQUIRED_VARIABLES);
  });

  it('never exposes supplied Firebase values in a validation error', () => {
    const environment: FirebaseEnvironment = {
      VITE_FIREBASE_API_KEY: 'secret-api-key-7Qm2',
      VITE_FIREBASE_APP_ID: ' '.repeat(3),
      VITE_FIREBASE_AUTH_DOMAIN: 'private-auth-domain.example',
      VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://private-emulator:9099',
      VITE_FIREBASE_MESSAGING_SENDER_ID: 'private-sender-341992',
      VITE_FIREBASE_PROJECT_ID: 'private-project-z8p',
      VITE_FIREBASE_STORAGE_BUCKET: 'private-bucket-name',
    };
    const suppliedValues = Object.values(environment).filter(
      (value): value is string =>
        value !== undefined && value.trim().length > 0,
    );
    const error = captureConfigError(environment);

    for (const suppliedValue of suppliedValues) {
      expect(error.message).not.toContain(suppliedValue);
    }
  });
});

describe('getFirebaseConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads, trims, and maps the Vite environment', () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', ' env-api-key ');
    vi.stubEnv('VITE_FIREBASE_APP_ID', ' env-app-id ');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', ' env-auth-domain ');
    vi.stubEnv('VITE_FIREBASE_AUTH_EMULATOR_URL', ' http://localhost:9099 ');
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', ' env-sender-id ');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', ' env-project-id ');
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', ' env-storage-bucket ');

    expect(getFirebaseConfig()).toEqual({
      authEmulatorUrl: 'http://localhost:9099',
      options: {
        apiKey: 'env-api-key',
        appId: 'env-app-id',
        authDomain: 'env-auth-domain',
        messagingSenderId: 'env-sender-id',
        projectId: 'env-project-id',
        storageBucket: 'env-storage-bucket',
      },
    });
  });
});
