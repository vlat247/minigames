import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  connectAuthEmulator: vi.fn(),
  getApp: vi.fn(),
  getApps: vi.fn(),
  getAuth: vi.fn(),
  getFirebaseConfig: vi.fn(),
  googleAuthProviderConstructor: vi.fn(),
  initializeApp: vi.fn(),
  setCustomParameters: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  getApp: firebaseMocks.getApp,
  getApps: firebaseMocks.getApps,
  initializeApp: firebaseMocks.initializeApp,
}));

vi.mock('firebase/auth', () => ({
  connectAuthEmulator: firebaseMocks.connectAuthEmulator,
  getAuth: firebaseMocks.getAuth,
  GoogleAuthProvider: class GoogleAuthProviderMock {
    public constructor() {
      firebaseMocks.googleAuthProviderConstructor();
    }

    public setCustomParameters(parameters: Record<string, string>): void {
      firebaseMocks.setCustomParameters(parameters);
    }
  },
}));

vi.mock('../config/firebase-config', () => ({
  getFirebaseConfig: firebaseMocks.getFirebaseConfig,
}));

const firebaseOptions = {
  apiKey: 'test-api-key',
  appId: 'test-app-id',
  authDomain: 'test.firebaseapp.com',
  messagingSenderId: '123456789',
  projectId: 'test-project',
  storageBucket: 'test-project.firebasestorage.app',
};

const importFirebase = async (): Promise<typeof import('./firebase')> =>
  import('./firebase');

describe('Firebase services', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('DEV', true);

    firebaseMocks.getApps.mockReturnValue([]);
    firebaseMocks.getFirebaseConfig.mockReturnValue({
      authEmulatorUrl: undefined,
      options: firebaseOptions,
    });
  });

  it('creates the named Firebase app and obtains Auth on a cold initialization', async () => {
    const app = { name: 'minigames' };
    const auth = { emulatorConfig: null };
    firebaseMocks.initializeApp.mockReturnValue(app);
    firebaseMocks.getAuth.mockReturnValue(auth);
    const { initializeFirebase } = await importFirebase();

    const services = initializeFirebase();

    expect(firebaseMocks.getFirebaseConfig).toHaveBeenCalledOnce();
    expect(firebaseMocks.getApps).toHaveBeenCalledOnce();
    expect(firebaseMocks.initializeApp).toHaveBeenCalledWith(
      firebaseOptions,
      'minigames',
    );
    expect(firebaseMocks.getAuth).toHaveBeenCalledWith(app);
    expect(services).toEqual({ app, auth });
  });

  it('reuses an existing app with the minigames name', async () => {
    const otherApp = { name: 'other-app' };
    const existingApp = { name: 'minigames' };
    const auth = { emulatorConfig: null };
    firebaseMocks.getApps.mockReturnValue([otherApp, existingApp]);
    firebaseMocks.getAuth.mockReturnValue(auth);
    const { initializeFirebase } = await importFirebase();

    const services = initializeFirebase();

    expect(firebaseMocks.initializeApp).not.toHaveBeenCalled();
    expect(firebaseMocks.getAuth).toHaveBeenCalledWith(existingApp);
    expect(services).toEqual({ app: existingApp, auth });
  });

  it('returns the same cached services without repeating initialization', async () => {
    const app = { name: 'minigames' };
    const auth = { emulatorConfig: null };
    firebaseMocks.initializeApp.mockReturnValue(app);
    firebaseMocks.getAuth.mockReturnValue(auth);
    const { initializeFirebase } = await importFirebase();

    const firstServices = initializeFirebase();
    const secondServices = initializeFirebase();

    expect(secondServices).toBe(firstServices);
    expect(firebaseMocks.getFirebaseConfig).toHaveBeenCalledOnce();
    expect(firebaseMocks.getApps).toHaveBeenCalledOnce();
    expect(firebaseMocks.initializeApp).toHaveBeenCalledOnce();
    expect(firebaseMocks.getAuth).toHaveBeenCalledOnce();
  });

  it('connects Auth to the configured emulator in development', async () => {
    const app = { name: 'minigames' };
    const auth = { emulatorConfig: null };
    firebaseMocks.initializeApp.mockReturnValue(app);
    firebaseMocks.getAuth.mockReturnValue(auth);
    firebaseMocks.getFirebaseConfig.mockReturnValue({
      authEmulatorUrl: 'http://127.0.0.1:9099',
      options: firebaseOptions,
    });
    const { initializeFirebase } = await importFirebase();

    initializeFirebase();

    expect(firebaseMocks.connectAuthEmulator).toHaveBeenCalledWith(
      auth,
      'http://127.0.0.1:9099',
      { disableWarnings: true },
    );
  });

  it('does not reconnect Auth when it already has emulator configuration', async () => {
    const app = { name: 'minigames' };
    const auth = {
      emulatorConfig: {
        host: '127.0.0.1',
        options: { disableWarnings: true },
        port: 9099,
        protocol: 'http',
      },
    };
    firebaseMocks.initializeApp.mockReturnValue(app);
    firebaseMocks.getAuth.mockReturnValue(auth);
    firebaseMocks.getFirebaseConfig.mockReturnValue({
      authEmulatorUrl: 'http://127.0.0.1:9099',
      options: firebaseOptions,
    });
    const { initializeFirebase } = await importFirebase();

    initializeFirebase();

    expect(firebaseMocks.connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('does not connect to the emulator in production', async () => {
    vi.stubEnv('DEV', false);
    const app = { name: 'minigames' };
    const auth = { emulatorConfig: null };
    firebaseMocks.initializeApp.mockReturnValue(app);
    firebaseMocks.getAuth.mockReturnValue(auth);
    firebaseMocks.getFirebaseConfig.mockReturnValue({
      authEmulatorUrl: 'http://127.0.0.1:9099',
      options: firebaseOptions,
    });
    const { initializeFirebase } = await importFirebase();

    initializeFirebase();

    expect(firebaseMocks.connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('does not connect to the emulator when no URL is configured', async () => {
    const app = { name: 'minigames' };
    const auth = { emulatorConfig: null };
    firebaseMocks.initializeApp.mockReturnValue(app);
    firebaseMocks.getAuth.mockReturnValue(auth);
    const { initializeFirebase } = await importFirebase();

    initializeFirebase();

    expect(firebaseMocks.connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('creates a fresh Google provider configured to select an account', async () => {
    const { createGoogleAuthProvider } = await importFirebase();

    const firstProvider = createGoogleAuthProvider();
    const secondProvider = createGoogleAuthProvider();

    expect(firstProvider).not.toBe(secondProvider);
    expect(firebaseMocks.googleAuthProviderConstructor).toHaveBeenCalledTimes(
      2,
    );
    expect(firebaseMocks.setCustomParameters).toHaveBeenCalledTimes(2);
    expect(firebaseMocks.setCustomParameters).toHaveBeenNthCalledWith(1, {
      prompt: 'select_account',
    });
    expect(firebaseMocks.setCustomParameters).toHaveBeenNthCalledWith(2, {
      prompt: 'select_account',
    });
  });
});
