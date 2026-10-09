import {
  type AuthMode,
  dispatchAuthDialogCloseRequest,
  dispatchAuthDialogRequest,
} from './auth-dialog-events';
import { dispatchSnackbar } from '../snackbar/snackbar-events';
import {
  getAuthenticationErrorMessage,
  GOOGLE_SIGN_IN_SUCCESS_MESSAGE,
  LOGIN_SUCCESS_MESSAGE,
  REGISTRATION_SUCCESS_MESSAGE,
  type AuthenticationService,
} from '../../features/auth/authentication-service';
import {
  validateLoginForm,
  validateRegistrationForm,
  type AuthFieldValidationResult,
  type LoginFormValidationResult,
  type LoginFormValues,
  type RegistrationFormValidationResult,
  type RegistrationFormValues,
} from '../../features/auth/auth-validation';
import { getAppPath } from '../../utils/paths';
import './auth-dialog.scss';

const DIALOG_TRANSITION_DURATION_MS: number = 240;
const googleIconPath: string = getAppPath('/assets/icons/google.svg');

type AuthenticationAction = 'google' | 'login' | 'register';
type AuthForm = HTMLFormElement & { readonly dataset: { authForm?: AuthMode } };

export interface AuthDialogController {
  readonly destroy: () => void;
  readonly element: HTMLDialogElement;
  readonly setAuthenticationService: (service: AuthenticationService) => void;
  readonly synchronize: (mode: AuthMode | undefined) => void;
}

const loginPanelMarkup: string = `
  <section class="auth-panel auth-panel--active" data-auth-panel="login" aria-labelledby="login-title">
    <div class="auth-panel__heading">
      <h2 id="login-title">Welcome Back!</h2>
      <p>Sign in to resume your games and progress.</p>
    </div>

    <form class="auth-form" data-auth-form="login" novalidate>
      <div class="auth-form__fields">
        <div class="auth-field">
          <label for="login-email">Email Address</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">mail</span>
            <input id="login-email" name="email" type="email" autocomplete="email" placeholder="e.g. alex@minigames.com" aria-describedby="login-email-error" aria-invalid="false" />
          </div>
          <p class="auth-field__error" id="login-email-error" data-auth-error="email" aria-live="polite"></p>
        </div>

        <div class="auth-field">
          <label for="login-password">Password</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">lock</span>
            <input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" aria-describedby="login-password-error" aria-invalid="false" />
            <button class="auth-field__visibility" type="button" data-password-target="login-password" aria-label="Show password">
              <span class="material-symbols-rounded" aria-hidden="true">visibility</span>
            </button>
          </div>
          <p class="auth-field__error" id="login-password-error" data-auth-error="password" aria-live="polite"></p>
        </div>

        <button class="auth-form__forgot" type="button">Forgot Password?</button>
      </div>

      <div class="auth-form__actions">
        <button class="btn btn--primary btn--large auth-form__submit" type="submit" data-auth-submit disabled>
          <span data-auth-action-label>Login</span>
        </button>
        <div class="auth-divider"><span>or</span></div>
        <button class="auth-google-button" type="button" data-auth-google disabled>
          <img src="${googleIconPath}" alt="" width="24" height="24" />
          <span data-auth-action-label>Continue with Google</span>
        </button>
      </div>
    </form>

    <p class="auth-panel__footer">
      Don't have an account?
      <button type="button" data-auth-view="register">Register</button>
    </p>
  </section>
`;

const registerPanelMarkup: string = `
  <section class="auth-panel" data-auth-panel="register" aria-labelledby="register-title" hidden>
    <div class="auth-panel__heading">
      <h2 id="register-title">Create Account</h2>
      <p>Join MiniGames to track your score &amp; streak.</p>
    </div>

    <form class="auth-form" data-auth-form="register" novalidate>
      <div class="auth-form__fields">
        <div class="auth-field">
          <label for="register-username">Username</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">person</span>
            <input id="register-username" name="username" type="text" autocomplete="username" placeholder="e.g. CozyGamer99" aria-describedby="register-username-error" aria-invalid="false" />
          </div>
          <p class="auth-field__error" id="register-username-error" data-auth-error="username" aria-live="polite"></p>
        </div>

        <div class="auth-field">
          <label for="register-email">Email Address</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">mail</span>
            <input id="register-email" name="email" type="email" autocomplete="email" placeholder="your.email@domain.com" aria-describedby="register-email-error" aria-invalid="false" />
          </div>
          <p class="auth-field__error" id="register-email-error" data-auth-error="email" aria-live="polite"></p>
        </div>

        <div class="auth-field">
          <label for="register-password">Password</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">lock</span>
            <input id="register-password" name="password" type="password" autocomplete="new-password" placeholder="At least 6 characters" aria-describedby="register-password-error" aria-invalid="false" />
            <button class="auth-field__visibility" type="button" data-password-target="register-password" aria-label="Show password">
              <span class="material-symbols-rounded" aria-hidden="true">visibility</span>
            </button>
          </div>
          <p class="auth-field__error" id="register-password-error" data-auth-error="password" aria-live="polite"></p>
        </div>

        <div class="auth-field">
          <label for="register-confirm-password">Confirm Password</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">lock</span>
            <input id="register-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Repeat your password" aria-describedby="register-confirm-password-error" aria-invalid="false" />
            <button class="auth-field__visibility" type="button" data-password-target="register-confirm-password" aria-label="Show password">
              <span class="material-symbols-rounded" aria-hidden="true">visibility</span>
            </button>
          </div>
          <p class="auth-field__error" id="register-confirm-password-error" data-auth-error="confirmPassword" aria-live="polite"></p>
        </div>
      </div>

      <div class="auth-form__actions">
        <button class="btn btn--primary btn--large auth-form__submit" type="submit" data-auth-submit disabled>
          <span data-auth-action-label>Create Account</span>
        </button>
        <div class="auth-divider"><span>or</span></div>
        <button class="auth-google-button" type="button" data-auth-google disabled>
          <img src="${googleIconPath}" alt="" width="24" height="24" />
          <span data-auth-action-label>Sign up with Google</span>
        </button>
      </div>
    </form>

    <p class="auth-panel__footer">
      Already have an account?
      <button type="button" data-auth-view="login">Login</button>
    </p>
  </section>
`;

const getRequiredElement = <ElementType extends Element>(
  root: ParentNode,
  selector: string,
): ElementType => {
  const element = root.querySelector<ElementType>(selector);
  if (element === null) {
    throw new Error(`Expected an authentication element matching ${selector}.`);
  }
  return element;
};

const getInput = (form: HTMLFormElement, name: string): HTMLInputElement =>
  getRequiredElement<HTMLInputElement>(form, `input[name="${name}"]`);

const getLoginValues = (form: HTMLFormElement): LoginFormValues => ({
  email: getInput(form, 'email').value,
  password: getInput(form, 'password').value,
});

const getRegistrationValues = (
  form: HTMLFormElement,
): RegistrationFormValues => ({
  confirmPassword: getInput(form, 'confirmPassword').value,
  email: getInput(form, 'email').value,
  password: getInput(form, 'password').value,
  username: getInput(form, 'username').value,
});

export const createAuthDialog = (): AuthDialogController => {
  const dialog: HTMLDialogElement = document.createElement('dialog');
  const eventController: AbortController = new AbortController();
  const { signal } = eventController;
  dialog.className = 'auth-dialog';
  dialog.setAttribute('aria-label', 'Account access');
  dialog.innerHTML = `
    <button class="auth-dialog__close" type="button" data-auth-close aria-label="Close account dialog">
      <span class="material-symbols-rounded" aria-hidden="true">close</span>
    </button>
    <div class="auth-tabs" role="tablist" aria-label="Choose an authentication form">
      <button id="login-tab" type="button" role="tab" aria-controls="login-panel" aria-selected="true" data-auth-view="login">Login</button>
      <button id="register-tab" type="button" role="tab" aria-controls="register-panel" aria-selected="false" data-auth-view="register" tabindex="-1">Register</button>
    </div>
    <div class="auth-dialog__panels">
      ${loginPanelMarkup}
      ${registerPanelMarkup}
    </div>
  `;

  const loginPanel = getRequiredElement<HTMLElement>(
    dialog,
    '[data-auth-panel="login"]',
  );
  const registerPanel = getRequiredElement<HTMLElement>(
    dialog,
    '[data-auth-panel="register"]',
  );
  const loginTab = getRequiredElement<HTMLButtonElement>(dialog, '#login-tab');
  const registerTab = getRequiredElement<HTMLButtonElement>(
    dialog,
    '#register-tab',
  );
  const loginForm = getRequiredElement<AuthForm>(
    dialog,
    '[data-auth-form="login"]',
  );
  const registerForm = getRequiredElement<AuthForm>(
    dialog,
    '[data-auth-form="register"]',
  );
  const forms: readonly AuthForm[] = [loginForm, registerForm];
  const touchedFields = new Map<AuthForm, Set<string>>([
    [loginForm, new Set<string>()],
    [registerForm, new Set<string>()],
  ]);
  const defaultActionLabels = new Map<HTMLElement, string>();
  for (const label of dialog.querySelectorAll<HTMLElement>(
    '[data-auth-action-label]',
  )) {
    defaultActionLabels.set(label, label.textContent ?? '');
  }

  let authenticationService: AuthenticationService | undefined;
  let activeMode: AuthMode = 'login';
  let isDestroyed = false;
  let isPending = false;
  let deferredSynchronization:
    { readonly mode: AuthMode | undefined } | undefined;
  let returnFocusElement: HTMLElement | null = null;
  let closeTimer: number | undefined;
  let openAnimationFrame: number | undefined;

  loginPanel.id = 'login-panel';
  loginPanel.setAttribute('role', 'tabpanel');
  loginPanel.setAttribute('aria-labelledby', 'login-tab');
  registerPanel.id = 'register-panel';
  registerPanel.setAttribute('role', 'tabpanel');
  registerPanel.setAttribute('aria-labelledby', 'register-tab');

  const renderField = (
    form: AuthForm,
    name: string,
    result: AuthFieldValidationResult,
  ): void => {
    const input = getInput(form, name);
    const error = getRequiredElement<HTMLElement>(
      form,
      `[data-auth-error="${name}"]`,
    );
    const shouldShowError = touchedFields.get(form)?.has(name) === true;
    const isInvalid = shouldShowError && !result.isValid;
    input.setAttribute('aria-invalid', String(isInvalid));
    error.textContent = isInvalid ? result.error : '';
    input
      .closest('.auth-field__control')
      ?.classList.toggle('auth-field__control--invalid', isInvalid);
  };

  const renderLoginValidation = (): LoginFormValidationResult => {
    const validation = validateLoginForm(getLoginValues(loginForm));
    renderField(loginForm, 'email', validation.fields.email);
    renderField(loginForm, 'password', validation.fields.password);
    getRequiredElement<HTMLButtonElement>(
      loginForm,
      '[data-auth-submit]',
    ).disabled =
      isPending || authenticationService === undefined || !validation.isValid;
    return validation;
  };

  const renderRegistrationValidation = (): RegistrationFormValidationResult => {
    const validation = validateRegistrationForm(
      getRegistrationValues(registerForm),
    );
    renderField(registerForm, 'username', validation.fields.username);
    renderField(registerForm, 'email', validation.fields.email);
    renderField(registerForm, 'password', validation.fields.password);
    renderField(
      registerForm,
      'confirmPassword',
      validation.fields.confirmPassword,
    );
    getRequiredElement<HTMLButtonElement>(
      registerForm,
      '[data-auth-submit]',
    ).disabled =
      isPending || authenticationService === undefined || !validation.isValid;
    return validation;
  };

  const renderValidation = (): void => {
    renderLoginValidation();
    renderRegistrationValidation();
  };

  const restoreActionLabels = (): void => {
    for (const [label, text] of defaultActionLabels) {
      label.textContent = text;
    }
  };

  const setPending = (
    isPendingState: boolean,
    action?: AuthenticationAction,
    trigger?: HTMLButtonElement,
  ): void => {
    isPending = isPendingState;
    dialog.ariaBusy = isPendingState ? 'true' : null;
    dialog.classList.toggle('auth-dialog--pending', isPendingState);
    for (const control of dialog.querySelectorAll<
      HTMLButtonElement | HTMLInputElement
    >('button, input')) {
      control.disabled = isPendingState;
    }

    restoreActionLabels();
    if (isPendingState && trigger !== undefined) {
      const label = trigger.querySelector<HTMLElement>(
        '[data-auth-action-label]',
      );
      if (label !== null) {
        switch (action) {
          case 'login': {
            label.textContent = 'Signing in…';
            break;
          }
          case 'register': {
            label.textContent = 'Creating account…';
            break;
          }
          default: {
            label.textContent = 'Connecting…';
          }
        }
      }
    }

    if (isPendingState) {
      return;
    }

    for (const input of dialog.querySelectorAll<HTMLInputElement>('input')) {
      input.disabled = false;
    }
    for (const control of dialog.querySelectorAll<HTMLButtonElement>(
      'button:not([data-auth-submit])',
    )) {
      control.disabled = authenticationService === undefined;
    }
    renderValidation();

    const synchronization = deferredSynchronization;
    deferredSynchronization = undefined;
    if (synchronization !== undefined) {
      synchronizeDialog(synchronization.mode);
    }
  };

  const resetPasswordVisibility = (): void => {
    for (const button of dialog.querySelectorAll<HTMLButtonElement>(
      '[data-password-target]',
    )) {
      const targetId = button.dataset.passwordTarget;
      const input =
        targetId === undefined
          ? null
          : dialog.querySelector<HTMLInputElement>(`#${targetId}`);
      if (input !== null) {
        input.type = 'password';
      }
      button.setAttribute('aria-label', 'Show password');
      const icon = button.querySelector<HTMLElement>(
        '.material-symbols-rounded',
      );
      if (icon !== null) {
        icon.textContent = 'visibility';
      }
    }
  };

  const resetForms = (): void => {
    for (const form of forms) {
      form.reset();
      touchedFields.get(form)?.clear();
    }
    resetPasswordVisibility();
    renderValidation();
  };

  const setMode = (mode: AuthMode): void => {
    const shouldReset = mode !== activeMode;
    activeMode = mode;
    const isLogin: boolean = mode === 'login';
    loginTab.setAttribute('aria-selected', String(isLogin));
    loginTab.tabIndex = isLogin ? 0 : -1;
    registerTab.setAttribute('aria-selected', String(!isLogin));
    registerTab.tabIndex = isLogin ? -1 : 0;
    loginPanel.hidden = !isLogin;
    loginPanel.classList.toggle('auth-panel--active', isLogin);
    registerPanel.hidden = isLogin;
    registerPanel.classList.toggle('auth-panel--active', !isLogin);
    if (shouldReset) {
      resetForms();
    }
  };

  const finishClose = (): void => {
    closeTimer = undefined;
    if (!dialog.open) {
      return;
    }
    dialog.close();
    dialog.classList.remove('auth-dialog--closing');
    if (document.querySelector('dialog[open]') === null) {
      document.body.classList.remove('dialog-open');
    }
    const focusTarget =
      returnFocusElement?.isConnected === true
        ? returnFocusElement
        : document.querySelector<HTMLElement>('[data-profile-toggle]');
    focusTarget?.focus();
    returnFocusElement = null;
  };

  const closeDialog = (): void => {
    if (!dialog.open || dialog.classList.contains('auth-dialog--closing')) {
      return;
    }
    dialog.classList.add('auth-dialog--closing');
    dialog.classList.remove('auth-dialog--visible');
    resetForms();
    closeTimer = globalThis.setTimeout(
      finishClose,
      DIALOG_TRANSITION_DURATION_MS,
    );
  };

  const openDialog = (mode: AuthMode): void => {
    if (closeTimer !== undefined) {
      globalThis.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
    if (openAnimationFrame !== undefined) {
      globalThis.cancelAnimationFrame(openAnimationFrame);
      openAnimationFrame = undefined;
    }
    const selectedTab: HTMLButtonElement =
      mode === 'login' ? loginTab : registerTab;
    const shouldMoveFocus =
      !dialog.open || selectedTab.getAttribute('aria-selected') !== 'true';
    setMode(mode);
    if (dialog.open) {
      dialog.classList.remove('auth-dialog--closing');
      document.body.classList.add('dialog-open');
      if (shouldMoveFocus) {
        selectedTab.focus({ preventScroll: true });
      }
      openAnimationFrame = globalThis.requestAnimationFrame((): void => {
        dialog.classList.add('auth-dialog--visible');
        openAnimationFrame = undefined;
      });
      return;
    }

    returnFocusElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    selectedTab.focus({ preventScroll: true });
    document.body.classList.add('dialog-open');
    openAnimationFrame = globalThis.requestAnimationFrame((): void => {
      dialog.classList.add('auth-dialog--visible');
      openAnimationFrame = undefined;
    });
  };

  const synchronizeDialog = (mode: AuthMode | undefined): void => {
    if (mode === undefined) {
      closeDialog();
      return;
    }
    openDialog(mode);
  };

  const runAuthentication = async (
    action: AuthenticationAction,
    trigger: HTMLButtonElement,
    request: (service: AuthenticationService) => Promise<void>,
    successMessage: string,
  ): Promise<void> => {
    const service = authenticationService;
    if (isDestroyed || isPending || service === undefined) {
      return;
    }
    setPending(true, action, trigger);
    try {
      await request(service);
      if (isDestroyed) {
        return;
      }
      setPending(false);
      dispatchSnackbar({ message: successMessage, variant: 'success' });
      dispatchAuthDialogCloseRequest();
    } catch (error: unknown) {
      if (!isDestroyed) {
        setPending(false);
        dispatchSnackbar({
          message: getAuthenticationErrorMessage(error),
          variant: 'error',
        });
      }
    }
  };

  const markFormTouched = (form: AuthForm): void => {
    const touched = touchedFields.get(form);
    for (const input of form.querySelectorAll<HTMLInputElement>(
      'input[name]',
    )) {
      touched?.add(input.name);
    }
  };

  const focusFirstInvalidField = (
    form: AuthForm,
    validation: LoginFormValidationResult | RegistrationFormValidationResult,
  ): void => {
    const firstInvalidName = Object.entries(validation.fields).find(
      ([, result]) => !result.isValid,
    )?.[0];
    if (firstInvalidName !== undefined) {
      getInput(form, firstInvalidName).focus();
    }
  };

  dialog.addEventListener(
    'input',
    (event: Event): void => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      const form = event.target.closest<AuthForm>('[data-auth-form]');
      if (form === null) {
        return;
      }
      touchedFields.get(form)?.add(event.target.name);
      if (form === registerForm && event.target.name === 'password') {
        const confirmation = getInput(registerForm, 'confirmPassword');
        if (confirmation.value.length > 0) {
          touchedFields.get(registerForm)?.add('confirmPassword');
        }
      }
      if (form === loginForm) {
        renderLoginValidation();
      } else {
        renderRegistrationValidation();
      }
    },
    { signal },
  );

  for (const eventName of ['change', 'blur'] as const) {
    dialog.addEventListener(
      eventName,
      (event: Event): void => {
        if (!(event.target instanceof HTMLInputElement)) {
          return;
        }
        const form = event.target.closest<AuthForm>('[data-auth-form]');
        if (form === null) {
          return;
        }
        touchedFields.get(form)?.add(event.target.name);
        if (form === loginForm) {
          renderLoginValidation();
        } else {
          renderRegistrationValidation();
        }
      },
      { capture: eventName === 'blur', signal },
    );
  }

  dialog.addEventListener(
    'keydown',
    (event: KeyboardEvent): void => {
      if (
        isPending ||
        !(event.target instanceof HTMLButtonElement) ||
        !event.target.matches('[role="tab"]')
      ) {
        return;
      }
      let mode: AuthMode | undefined;
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          mode = activeMode === 'login' ? 'register' : 'login';
          break;
        }
        case 'Home': {
          mode = 'login';
          break;
        }
        case 'End': {
          mode = 'register';
          break;
        }
      }
      if (mode === undefined) {
        return;
      }
      event.preventDefault();
      dispatchAuthDialogRequest(mode);
    },
    { signal },
  );

  dialog.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const closeButton = event.target.closest<HTMLButtonElement>(
        'button[data-auth-close]',
      );
      if (closeButton !== null) {
        if (!isPending) {
          dispatchAuthDialogCloseRequest();
        }
        return;
      }

      const viewButton = event.target.closest<HTMLButtonElement>(
        'button[data-auth-view]',
      );
      if (viewButton !== null) {
        if (!isPending) {
          dispatchAuthDialogRequest(
            viewButton.dataset.authView === 'register' ? 'register' : 'login',
          );
        }
        return;
      }

      const visibilityButton = event.target.closest<HTMLButtonElement>(
        'button[data-password-target]',
      );
      if (visibilityButton !== null) {
        if (isPending) {
          return;
        }
        const targetId = visibilityButton.dataset.passwordTarget;
        const passwordInput =
          targetId === undefined
            ? null
            : dialog.querySelector<HTMLInputElement>(`#${targetId}`);
        if (passwordInput !== null) {
          const shouldShowPassword = passwordInput.type === 'password';
          passwordInput.type = shouldShowPassword ? 'text' : 'password';
          visibilityButton.setAttribute(
            'aria-label',
            shouldShowPassword ? 'Hide password' : 'Show password',
          );
          const icon = visibilityButton.querySelector<HTMLElement>(
            '.material-symbols-rounded',
          );
          if (icon !== null) {
            icon.textContent = shouldShowPassword
              ? 'visibility_off'
              : 'visibility';
          }
        }
        return;
      }

      const googleButton = event.target.closest<HTMLButtonElement>(
        'button[data-auth-google]',
      );
      if (googleButton !== null) {
        void runAuthentication(
          'google',
          googleButton,
          (service) => service.signInWithGoogle(),
          GOOGLE_SIGN_IN_SUCCESS_MESSAGE,
        );
        return;
      }

      if (isPending || event.target !== dialog) {
        return;
      }
      const bounds: DOMRect = dialog.getBoundingClientRect();
      const isInsideDialog =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      if (!isInsideDialog) {
        dispatchAuthDialogCloseRequest();
      }
    },
    { signal },
  );

  dialog.addEventListener(
    'cancel',
    (event: Event): void => {
      event.preventDefault();
      if (!isPending) {
        dispatchAuthDialogCloseRequest();
      }
    },
    { signal },
  );

  for (const form of forms) {
    form.addEventListener(
      'submit',
      (event: SubmitEvent): void => {
        event.preventDefault();
        if (isPending || authenticationService === undefined) {
          return;
        }
        markFormTouched(form);
        const submitButton = getRequiredElement<HTMLButtonElement>(
          form,
          '[data-auth-submit]',
        );
        if (form === loginForm) {
          const values = getLoginValues(loginForm);
          const validation = renderLoginValidation();
          if (!validation.isValid) {
            focusFirstInvalidField(form, validation);
            return;
          }
          void runAuthentication(
            'login',
            submitButton,
            (service) =>
              service.login({
                email: values.email.trim(),
                password: values.password,
              }),
            LOGIN_SUCCESS_MESSAGE,
          );
          return;
        }

        const values = getRegistrationValues(registerForm);
        const validation = renderRegistrationValidation();
        if (!validation.isValid) {
          focusFirstInvalidField(form, validation);
          return;
        }
        void runAuthentication(
          'register',
          submitButton,
          (service) =>
            service.register({
              email: values.email.trim(),
              password: values.password,
              username: values.username.trim(),
            }),
          REGISTRATION_SUCCESS_MESSAGE,
        );
      },
      { signal },
    );
  }

  renderValidation();

  return {
    destroy: (): void => {
      isDestroyed = true;
      eventController.abort();
      if (closeTimer !== undefined) {
        globalThis.clearTimeout(closeTimer);
      }
      if (openAnimationFrame !== undefined) {
        globalThis.cancelAnimationFrame(openAnimationFrame);
      }
      if (dialog.open) {
        dialog.close();
      }
      dialog.classList.remove(
        'auth-dialog--closing',
        'auth-dialog--pending',
        'auth-dialog--visible',
      );
      dialog.removeAttribute('aria-busy');
      if (document.querySelector('dialog[open]') === null) {
        document.body.classList.remove('dialog-open');
      }
      returnFocusElement = null;
    },
    element: dialog,
    setAuthenticationService: (service: AuthenticationService): void => {
      authenticationService = service;
      if (isPending) {
        return;
      }
      for (const control of dialog.querySelectorAll<HTMLButtonElement>(
        'button:not([data-auth-submit])',
      )) {
        control.disabled = false;
      }
      renderValidation();
    },
    synchronize: (mode: AuthMode | undefined): void => {
      if (isPending) {
        deferredSynchronization = { mode };
        return;
      }
      synchronizeDialog(mode);
    },
  };
};
