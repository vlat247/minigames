import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import {
  AUTH_DIALOG_CLOSE_REQUEST_EVENT,
  AUTH_DIALOG_OPEN_EVENT,
  isAuthDialogRequestDetail,
  type AuthDialogRequestDetail,
  type AuthMode,
} from './auth-dialog-events';
import { createAuthDialog, type AuthDialogController } from './auth-dialog';
import {
  AUTHENTICATION_ERROR_MESSAGES,
  GOOGLE_SIGN_IN_SUCCESS_MESSAGE,
  LOGIN_SUCCESS_MESSAGE,
  REGISTRATION_SUCCESS_MESSAGE,
  type AuthenticationService,
} from '../../features/auth/authentication-service';
import { AUTH_VALIDATION_MESSAGES } from '../../features/auth/auth-validation';
import {
  SNACKBAR_SHOW_EVENT,
  isSnackbarRequestDetail,
} from '../snackbar/snackbar-events';
import type { SnackbarOptions } from '../snackbar/snackbar';

interface DeferredAction {
  readonly promise: Promise<void>;
  readonly reject: (reason: unknown) => void;
  readonly resolve: () => void;
}

interface PromiseWithResolversConstructor extends PromiseConstructor {
  readonly withResolvers: <Value>() => {
    readonly promise: Promise<Value>;
    readonly reject: (reason?: unknown) => void;
    readonly resolve: (value: Value | PromiseLike<Value>) => void;
  };
}

interface AuthenticationServiceSpies {
  readonly login: Mock<AuthenticationService['login']>;
  readonly register: Mock<AuthenticationService['register']>;
  readonly signInWithGoogle: Mock<AuthenticationService['signInWithGoogle']>;
}

interface AuthDialogFixture {
  readonly closeRequests: Event[];
  readonly controller: AuthDialogController;
  readonly dialog: HTMLDialogElement;
  readonly openRequests: AuthDialogRequestDetail[];
  readonly service: AuthenticationService;
  readonly serviceSpies: AuthenticationServiceSpies;
  readonly snackbarMessages: SnackbarOptions[];
}

interface FixtureOptions {
  readonly bindService?: boolean;
  readonly mode?: AuthMode;
}

type ValidationEventName = 'blur' | 'change' | 'input';

const controllers: AuthDialogController[] = [];
const eventControllers: AbortController[] = [];

const getRequiredElement = <ElementType extends Element>(
  root: ParentNode,
  selector: string,
): ElementType => {
  const element = root.querySelector<ElementType>(selector);
  if (element === null) {
    throw new Error(`Expected an element matching ${selector}.`);
  }
  return element;
};

const getForm = (dialog: HTMLDialogElement, mode: AuthMode): HTMLFormElement =>
  getRequiredElement<HTMLFormElement>(dialog, `[data-auth-form="${mode}"]`);

const getInput = (
  dialog: HTMLDialogElement,
  mode: AuthMode,
  name: string,
): HTMLInputElement =>
  getRequiredElement<HTMLInputElement>(
    getForm(dialog, mode),
    `input[name="${name}"]`,
  );

const getError = (
  dialog: HTMLDialogElement,
  mode: AuthMode,
  name: string,
): HTMLElement =>
  getRequiredElement<HTMLElement>(
    getForm(dialog, mode),
    `[data-auth-error="${name}"]`,
  );

const setInputValue = (
  input: HTMLInputElement,
  value: string,
  eventName: ValidationEventName = 'input',
): void => {
  input.value = value;
  input.dispatchEvent(new Event(eventName, { bubbles: true }));
};

const submitForm = (form: HTMLFormElement): void => {
  form.dispatchEvent(
    new SubmitEvent('submit', { bubbles: true, cancelable: true }),
  );
};

const settleAsyncAction = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createDeferredAction = (): DeferredAction => {
  const promiseConstructor = Promise as PromiseWithResolversConstructor;
  const { promise, reject, resolve } = promiseConstructor.withResolvers<void>();

  return {
    promise,
    reject,
    resolve: (): void => resolve(undefined),
  };
};

const createAuthenticationService = (): {
  readonly service: AuthenticationService;
  readonly spies: AuthenticationServiceSpies;
} => {
  const login = vi
    .fn<AuthenticationService['login']>()
    .mockResolvedValue(undefined);
  const register = vi
    .fn<AuthenticationService['register']>()
    .mockResolvedValue(undefined);
  const signInWithGoogle = vi
    .fn<AuthenticationService['signInWithGoogle']>()
    .mockResolvedValue(undefined);

  return {
    service: { login, register, signInWithGoogle },
    spies: { login, register, signInWithGoogle },
  };
};

const createFixture = (options: FixtureOptions = {}): AuthDialogFixture => {
  const { service, spies } = createAuthenticationService();
  const controller = createAuthDialog();
  const dialog = controller.element;
  const eventController = new AbortController();
  const closeRequests: Event[] = [];
  const openRequests: AuthDialogRequestDetail[] = [];
  const snackbarMessages: SnackbarOptions[] = [];

  controllers.push(controller);
  eventControllers.push(eventController);
  document.body.append(dialog);

  document.addEventListener(
    AUTH_DIALOG_CLOSE_REQUEST_EVENT,
    (event: Event): void => {
      closeRequests.push(event);
    },
    { signal: eventController.signal },
  );
  document.addEventListener(
    AUTH_DIALOG_OPEN_EVENT,
    (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (isAuthDialogRequestDetail(detail)) {
        openRequests.push(detail);
      }
    },
    { signal: eventController.signal },
  );
  document.addEventListener(
    SNACKBAR_SHOW_EVENT,
    (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (isSnackbarRequestDetail(detail)) {
        snackbarMessages.push(detail);
      }
    },
    { signal: eventController.signal },
  );

  if (options.bindService !== false) {
    controller.setAuthenticationService(service);
  }
  if (options.mode !== undefined) {
    controller.synchronize(options.mode);
  }

  return {
    closeRequests,
    controller,
    dialog,
    openRequests,
    service,
    serviceSpies: spies,
    snackbarMessages,
  };
};

const enterValidLogin = (dialog: HTMLDialogElement): void => {
  setInputValue(getInput(dialog, 'login', 'email'), 'player@example.com');
  setInputValue(getInput(dialog, 'login', 'password'), 'secret1');
};

const enterValidRegistration = (dialog: HTMLDialogElement): void => {
  setInputValue(getInput(dialog, 'register', 'username'), 'Player9');
  setInputValue(getInput(dialog, 'register', 'email'), 'player@example.com');
  setInputValue(getInput(dialog, 'register', 'password'), 'Valid1!');
  setInputValue(getInput(dialog, 'register', 'confirmPassword'), 'Valid1!');
};

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value(this: HTMLDialogElement): void {
        this.open = false;
      },
    },
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement): void {
        this.open = true;
      },
    },
  });
});

afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
});

afterEach(() => {
  for (const controller of controllers.splice(0).toReversed()) {
    controller.destroy();
    controller.element.remove();
  }
  for (const eventController of eventControllers.splice(0).toReversed()) {
    eventController.abort();
  }
});

describe('Auth dialog validation', () => {
  it('starts with unavailable actions, disabled submits, and no visible errors', () => {
    const { controller, dialog, service } = createFixture({
      bindService: false,
    });

    for (const button of dialog.querySelectorAll<HTMLButtonElement>(
      '[data-auth-submit], [data-auth-google]',
    )) {
      expect(button.disabled).toBe(true);
    }
    for (const error of dialog.querySelectorAll<HTMLElement>(
      '[data-auth-error]',
    )) {
      expect(error.textContent).toBe('');
    }
    for (const input of dialog.querySelectorAll<HTMLInputElement>('input')) {
      expect(input.getAttribute('aria-invalid')).toBe('false');
    }

    controller.setAuthenticationService(service);

    for (const button of dialog.querySelectorAll<HTMLButtonElement>(
      '[data-auth-google]',
    )) {
      expect(button.disabled).toBe(false);
    }
    for (const button of dialog.querySelectorAll<HTMLButtonElement>(
      '[data-auth-submit]',
    )) {
      expect(button.disabled).toBe(true);
    }
  });

  it.each<ValidationEventName>(['input', 'change', 'blur'])(
    'validates touched fields on %s and keeps errors accessible',
    (eventName) => {
      const { dialog } = createFixture();
      const email = getInput(dialog, 'login', 'email');
      const emailError = getError(dialog, 'login', 'email');

      setInputValue(email, 'not-an-email', eventName);

      expect(email.getAttribute('aria-invalid')).toBe('true');
      expect(email.getAttribute('aria-describedby')).toBe(emailError.id);
      expect(emailError.textContent).toBe(
        AUTH_VALIDATION_MESSAGES.emailInvalid,
      );
      expect(email.closest('.auth-field__control')?.classList).toContain(
        'auth-field__control--invalid',
      );

      setInputValue(email, 'player@example.com', eventName);

      expect(email.getAttribute('aria-invalid')).toBe('false');
      expect(emailError.textContent).toBe('');
      expect(email.closest('.auth-field__control')?.classList).not.toContain(
        'auth-field__control--invalid',
      );
    },
  );

  it('revalidates a populated confirmation when the password changes', () => {
    const { dialog } = createFixture({ mode: 'register' });
    const password = getInput(dialog, 'register', 'password');
    const confirmation = getInput(dialog, 'register', 'confirmPassword');
    const confirmationError = getError(dialog, 'register', 'confirmPassword');

    setInputValue(password, 'Valid1!');
    setInputValue(confirmation, 'Valid1!');
    expect(confirmation.getAttribute('aria-invalid')).toBe('false');
    expect(confirmationError.textContent).toBe('');

    setInputValue(password, 'Changed2@');

    expect(confirmation.getAttribute('aria-invalid')).toBe('true');
    expect(confirmationError.textContent).toBe(
      AUTH_VALIDATION_MESSAGES.confirmPasswordMismatch,
    );
  });

  it('clears both forms, errors, and password visibility when modes change', () => {
    const { controller, dialog } = createFixture({ mode: 'login' });
    const loginEmail = getInput(dialog, 'login', 'email');
    const loginPassword = getInput(dialog, 'login', 'password');
    const loginVisibility = getRequiredElement<HTMLButtonElement>(
      dialog,
      '[data-password-target="login-password"]',
    );

    setInputValue(loginEmail, 'invalid');
    setInputValue(loginPassword, 'secret1');
    loginVisibility.click();
    expect(loginPassword.type).toBe('text');

    controller.synchronize('register');

    expect(loginEmail.value).toBe('');
    expect(loginPassword.value).toBe('');
    expect(loginPassword.type).toBe('password');
    expect(getError(dialog, 'login', 'email').textContent).toBe('');
    expect(loginEmail.getAttribute('aria-invalid')).toBe('false');

    const registrationUsername = getInput(dialog, 'register', 'username');
    const registrationPassword = getInput(dialog, 'register', 'password');
    const registrationVisibility = getRequiredElement<HTMLButtonElement>(
      dialog,
      '[data-password-target="register-password"]',
    );
    setInputValue(registrationUsername, 'lowercase');
    setInputValue(registrationPassword, 'Valid1!');
    registrationVisibility.click();
    expect(registrationPassword.type).toBe('text');

    controller.synchronize('login');

    expect(registrationUsername.value).toBe('');
    expect(registrationPassword.value).toBe('');
    expect(registrationPassword.type).toBe('password');
    expect(getError(dialog, 'register', 'username').textContent).toBe('');
    expect(registrationUsername.getAttribute('aria-invalid')).toBe('false');
  });

  it('clears sensitive values when a closing dialog is immediately reopened', () => {
    const { controller, dialog } = createFixture({ mode: 'login' });
    const email = getInput(dialog, 'login', 'email');
    setInputValue(email, 'invalid');

    controller.synchronize(undefined);
    controller.synchronize('login');

    expect(dialog.open).toBe(true);
    expect(email.value).toBe('');
    expect(email.getAttribute('aria-invalid')).toBe('false');
    expect(getError(dialog, 'login', 'email').textContent).toBe('');
  });
});

describe('Auth dialog authentication actions', () => {
  it('submits trimmed login identity data without changing the password', () => {
    const { dialog, serviceSpies } = createFixture();
    const form = getForm(dialog, 'login');
    setInputValue(getInput(dialog, 'login', 'email'), '  player@example.com  ');
    setInputValue(getInput(dialog, 'login', 'password'), ' raw password ');

    submitForm(form);

    expect(serviceSpies.login).toHaveBeenCalledExactlyOnceWith({
      email: 'player@example.com',
      password: ' raw password ',
    });
  });

  it('submits trimmed registration identity data with the exact password', () => {
    const { dialog, serviceSpies } = createFixture({ mode: 'register' });
    const form = getForm(dialog, 'register');
    setInputValue(getInput(dialog, 'register', 'username'), '  Player9  ');
    setInputValue(
      getInput(dialog, 'register', 'email'),
      '  player@example.com  ',
    );
    setInputValue(getInput(dialog, 'register', 'password'), 'Valid1!');
    setInputValue(getInput(dialog, 'register', 'confirmPassword'), 'Valid1!');

    submitForm(form);

    expect(serviceSpies.register).toHaveBeenCalledExactlyOnceWith({
      email: 'player@example.com',
      password: 'Valid1!',
      username: 'Player9',
    });
  });

  it('locks every control, shows progress, and suppresses duplicate submits', async () => {
    const deferred = createDeferredAction();
    const { dialog, serviceSpies } = createFixture({ mode: 'login' });
    serviceSpies.login.mockReturnValueOnce(deferred.promise);
    enterValidLogin(dialog);
    const form = getForm(dialog, 'login');
    const submit = getRequiredElement<HTMLButtonElement>(
      form,
      '[data-auth-submit]',
    );

    submitForm(form);
    submitForm(form);

    expect(serviceSpies.login).toHaveBeenCalledOnce();
    expect(dialog.getAttribute('aria-busy')).toBe('true');
    expect(dialog.classList).toContain('auth-dialog--pending');
    expect(submit.textContent).toContain('Signing in…');
    for (const control of dialog.querySelectorAll<
      HTMLButtonElement | HTMLInputElement
    >('button, input')) {
      expect(control.disabled).toBe(true);
    }

    deferred.resolve();
    await settleAsyncAction();

    expect(dialog.getAttribute('aria-busy')).toBeNull();
    expect(dialog.classList).not.toContain('auth-dialog--pending');
    expect(submit.disabled).toBe(false);
    expect(submit.textContent).toContain('Login');
    for (const input of dialog.querySelectorAll<HTMLInputElement>('input')) {
      expect(input.disabled).toBe(false);
    }
    expect(
      getRequiredElement<HTMLButtonElement>(dialog, '[data-auth-close]')
        .disabled,
    ).toBe(false);
  });

  it('blocks close button, backdrop, and cancel attempts while pending', () => {
    const deferred = createDeferredAction();
    const { closeRequests, dialog, serviceSpies } = createFixture({
      mode: 'login',
    });
    serviceSpies.login.mockReturnValueOnce(deferred.promise);
    enterValidLogin(dialog);
    submitForm(getForm(dialog, 'login'));

    getRequiredElement<HTMLButtonElement>(
      dialog,
      '[data-auth-close]',
    ).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    dialog.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 20 }),
    );
    const cancelEvent = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(closeRequests).toHaveLength(0);
  });

  it('defers external route synchronization until a pending request settles', async () => {
    const deferred = createDeferredAction();
    const { controller, dialog, serviceSpies } = createFixture({
      mode: 'login',
    });
    serviceSpies.login.mockReturnValueOnce(deferred.promise);
    enterValidLogin(dialog);
    submitForm(getForm(dialog, 'login'));

    controller.synchronize(undefined);
    expect(dialog.classList).not.toContain('auth-dialog--closing');

    deferred.reject(new Error('request failed'));
    await settleAsyncAction();

    expect(dialog.classList).toContain('auth-dialog--closing');
  });

  it('reports a safe failure, unlocks the dialog, and keeps it open', async () => {
    const deferred = createDeferredAction();
    const { closeRequests, dialog, serviceSpies, snackbarMessages } =
      createFixture({ mode: 'login' });
    serviceSpies.login.mockReturnValueOnce(deferred.promise);
    enterValidLogin(dialog);
    submitForm(getForm(dialog, 'login'));

    deferred.reject(new Error('private SDK details'));
    await settleAsyncAction();

    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-busy')).toBeNull();
    expect(closeRequests).toHaveLength(0);
    expect(snackbarMessages).toEqual([
      {
        message: AUTHENTICATION_ERROR_MESSAGES.unknown,
        variant: 'error',
      },
    ]);
    for (const input of dialog.querySelectorAll<HTMLInputElement>('input')) {
      expect(input.disabled).toBe(false);
    }
    expect(
      getRequiredElement<HTMLButtonElement>(dialog, '[data-auth-close]')
        .disabled,
    ).toBe(false);
  });

  it('announces success and requests close only after authentication resolves', async () => {
    const deferred = createDeferredAction();
    const { closeRequests, dialog, serviceSpies, snackbarMessages } =
      createFixture({ mode: 'login' });
    serviceSpies.login.mockReturnValueOnce(deferred.promise);
    enterValidLogin(dialog);
    submitForm(getForm(dialog, 'login'));

    expect(closeRequests).toHaveLength(0);
    expect(snackbarMessages).toHaveLength(0);

    deferred.resolve();
    await settleAsyncAction();

    expect(snackbarMessages).toEqual([
      { message: LOGIN_SUCCESS_MESSAGE, variant: 'success' },
    ]);
    expect(closeRequests).toHaveLength(1);
  });

  it.each<AuthMode>(['login', 'register'])(
    'supports Google authentication from the %s panel',
    async (mode) => {
      const { closeRequests, dialog, serviceSpies, snackbarMessages } =
        createFixture({ mode });
      const googleButton = getRequiredElement<HTMLButtonElement>(
        dialog,
        `[data-auth-panel="${mode}"] [data-auth-google]`,
      );

      googleButton.click();
      await settleAsyncAction();

      expect(serviceSpies.signInWithGoogle).toHaveBeenCalledOnce();
      expect(snackbarMessages).toEqual([
        { message: GOOGLE_SIGN_IN_SUCCESS_MESSAGE, variant: 'success' },
      ]);
      expect(closeRequests).toHaveLength(1);
    },
  );

  it('uses the registration success copy after account creation', async () => {
    const { dialog, snackbarMessages } = createFixture({ mode: 'register' });
    enterValidRegistration(dialog);

    submitForm(getForm(dialog, 'register'));
    await settleAsyncAction();

    expect(snackbarMessages).toEqual([
      { message: REGISTRATION_SUCCESS_MESSAGE, variant: 'success' },
    ]);
  });

  it('ignores a pending result after the dialog is destroyed', async () => {
    const deferred = createDeferredAction();
    const {
      closeRequests,
      controller,
      dialog,
      serviceSpies,
      snackbarMessages,
    } = createFixture({ mode: 'login' });
    serviceSpies.login.mockReturnValueOnce(deferred.promise);
    enterValidLogin(dialog);
    submitForm(getForm(dialog, 'login'));

    controller.destroy();
    deferred.resolve();
    await settleAsyncAction();

    expect(dialog.open).toBe(false);
    expect(closeRequests).toHaveLength(0);
    expect(snackbarMessages).toHaveLength(0);
  });
});

describe('Auth dialog tabs', () => {
  it.each<{
    readonly key: 'ArrowLeft' | 'ArrowRight' | 'End' | 'Home';
    readonly mode: AuthMode;
    readonly requestedMode: AuthMode;
  }>([
    { key: 'ArrowRight', mode: 'login', requestedMode: 'register' },
    { key: 'ArrowLeft', mode: 'register', requestedMode: 'login' },
    { key: 'Home', mode: 'register', requestedMode: 'login' },
    { key: 'End', mode: 'login', requestedMode: 'register' },
  ])(
    'maps $key from the $mode tab to the $requestedMode route',
    ({ key, mode, requestedMode }) => {
      const { dialog, openRequests } = createFixture({ mode });
      const tab = getRequiredElement<HTMLButtonElement>(dialog, `#${mode}-tab`);
      const keyEvent = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key,
      });

      tab.dispatchEvent(keyEvent);

      expect(keyEvent.defaultPrevented).toBe(true);
      expect(openRequests).toEqual([{ mode: requestedMode }]);
    },
  );
});
