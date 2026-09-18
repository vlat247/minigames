import {
  AUTH_DIALOG_OPEN_EVENT,
  type AuthMode,
  isAuthDialogRequestDetail,
} from './auth-dialog-events';
import './auth-dialog.scss';

const DIALOG_TRANSITION_DURATION_MS: number = 240;

const loginPanelMarkup: string = `
  <section class="auth-panel auth-panel--active" data-auth-panel="login" aria-labelledby="login-title">
    <div class="auth-panel__heading">
      <h2 id="login-title">Welcome Back!</h2>
      <p>Sign in to resume your games and progress.</p>
    </div>

    <form class="auth-form" data-auth-form="login">
      <div class="auth-form__fields">
        <div class="auth-field">
          <label for="login-email">Email Address</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">mail</span>
            <input id="login-email" name="email" type="email" autocomplete="email" placeholder="e.g. alex@minigames.com" />
          </div>
        </div>

        <div class="auth-field">
          <label for="login-password">Password</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">lock</span>
            <input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" />
            <button class="auth-field__visibility" type="button" data-password-target="login-password" aria-label="Show password">
              <span class="material-symbols-rounded" aria-hidden="true">visibility</span>
            </button>
          </div>
        </div>

        <button class="auth-form__forgot" type="button">Forgot Password?</button>
      </div>

      <div class="auth-form__actions">
        <button class="btn btn--primary btn--large auth-form__submit" type="submit">Login</button>
        <div class="auth-divider"><span>or</span></div>
        <button class="auth-google-button" type="button">
          <img src="/assets/icons/google.svg" alt="" width="24" height="24" />
          Continue with Google
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

    <form class="auth-form" data-auth-form="register">
      <div class="auth-form__fields">
        <div class="auth-field">
          <label for="register-username">Username</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">person</span>
            <input id="register-username" name="username" type="text" autocomplete="username" placeholder="e.g. CozyGamer_99" />
          </div>
        </div>

        <div class="auth-field">
          <label for="register-email">Email Address</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">mail</span>
            <input id="register-email" name="email" type="email" autocomplete="email" placeholder="your.email@domain.com" />
          </div>
        </div>

        <div class="auth-field">
          <label for="register-password">Password</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">lock</span>
            <input id="register-password" name="password" type="password" autocomplete="new-password" placeholder="Min. 8 characters" />
          </div>
        </div>

        <div class="auth-field">
          <label for="register-confirm-password">Confirm Password</label>
          <div class="auth-field__control">
            <span class="material-symbols-rounded" aria-hidden="true">lock</span>
            <input id="register-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Repeat your password" />
          </div>
        </div>
      </div>

      <div class="auth-form__actions">
        <button class="btn btn--primary btn--large auth-form__submit" type="submit">Create Account</button>
        <div class="auth-divider"><span>or</span></div>
        <button class="auth-google-button" type="button">
          <img src="/assets/icons/google.svg" alt="" width="24" height="24" />
          Sign up with Google
        </button>
      </div>
    </form>

    <p class="auth-panel__footer">
      Already have an account?
      <button type="button" data-auth-view="login">Login</button>
    </p>
  </section>
`;

export const createAuthDialog = (): HTMLDialogElement => {
  const dialog: HTMLDialogElement = document.createElement('dialog');
  dialog.className = 'auth-dialog';
  dialog.setAttribute('aria-label', 'Account access');
  dialog.innerHTML = `
    <div class="auth-tabs" role="tablist" aria-label="Choose an authentication form">
      <button id="login-tab" type="button" role="tab" aria-controls="login-panel" aria-selected="true" data-auth-view="login">Login</button>
      <button id="register-tab" type="button" role="tab" aria-controls="register-panel" aria-selected="false" data-auth-view="register" tabindex="-1">Register</button>
    </div>
    <div class="auth-dialog__panels">
      ${loginPanelMarkup}
      ${registerPanelMarkup}
    </div>
  `;

  const loginPanel: HTMLElement | null = dialog.querySelector(
    '[data-auth-panel="login"]',
  );
  const registerPanel: HTMLElement | null = dialog.querySelector(
    '[data-auth-panel="register"]',
  );
  const loginTab: HTMLButtonElement | null = dialog.querySelector('#login-tab');
  const registerTab: HTMLButtonElement | null =
    dialog.querySelector('#register-tab');

  if (
    loginPanel === null ||
    registerPanel === null ||
    loginTab === null ||
    registerTab === null
  ) {
    return dialog;
  }

  let returnFocusElement: HTMLElement | null = null;
  let closeTimer: number | undefined;

  loginPanel.id = 'login-panel';
  loginPanel.setAttribute('role', 'tabpanel');
  loginPanel.setAttribute('aria-labelledby', 'login-tab');
  registerPanel.id = 'register-panel';
  registerPanel.setAttribute('role', 'tabpanel');
  registerPanel.setAttribute('aria-labelledby', 'register-tab');

  const setMode = (mode: AuthMode): void => {
    const isLogin: boolean = mode === 'login';

    loginTab.setAttribute('aria-selected', String(isLogin));
    loginTab.tabIndex = isLogin ? 0 : -1;
    registerTab.setAttribute('aria-selected', String(!isLogin));
    registerTab.tabIndex = isLogin ? -1 : 0;

    loginPanel.hidden = !isLogin;
    loginPanel.classList.toggle('auth-panel--active', isLogin);
    registerPanel.hidden = isLogin;
    registerPanel.classList.toggle('auth-panel--active', !isLogin);
  };

  const finishClose = (): void => {
    if (!dialog.open) {
      return;
    }

    dialog.close();
    dialog.classList.remove('auth-dialog--closing');
    document.body.classList.remove('dialog-open');
    returnFocusElement?.focus();
    returnFocusElement = null;
  };

  const closeDialog = (): void => {
    if (!dialog.open || dialog.classList.contains('auth-dialog--closing')) {
      return;
    }

    dialog.classList.add('auth-dialog--closing');
    dialog.classList.remove('auth-dialog--visible');
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

    setMode(mode);
    if (dialog.open) {
      return;
    }

    returnFocusElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    document.body.classList.add('dialog-open');
    globalThis.requestAnimationFrame((): void => {
      dialog.classList.add('auth-dialog--visible');
    });
  };

  dialog.addEventListener('click', (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const viewButton: HTMLButtonElement | null = event.target.closest(
      'button[data-auth-view]',
    );
    if (viewButton !== null) {
      setMode(
        viewButton.dataset.authView === 'register' ? 'register' : 'login',
      );
      return;
    }

    const visibilityButton: HTMLButtonElement | null = event.target.closest(
      'button[data-password-target]',
    );
    if (visibilityButton !== null) {
      const targetId: string | undefined =
        visibilityButton.dataset.passwordTarget;
      const passwordInput: HTMLInputElement | null = targetId
        ? dialog.querySelector(`#${targetId}`)
        : null;

      if (passwordInput !== null) {
        const shouldShowPassword: boolean = passwordInput.type === 'password';
        passwordInput.type = shouldShowPassword ? 'text' : 'password';
        visibilityButton.setAttribute(
          'aria-label',
          shouldShowPassword ? 'Hide password' : 'Show password',
        );
        const icon: HTMLElement | null = visibilityButton.querySelector(
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

    if (event.target !== dialog) {
      return;
    }

    const bounds: DOMRect = dialog.getBoundingClientRect();
    const isInsideDialog: boolean =
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom;
    if (!isInsideDialog) {
      closeDialog();
    }
  });

  dialog.addEventListener('cancel', (event: Event): void => {
    event.preventDefault();
    closeDialog();
  });

  dialog.addEventListener('keydown', (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    closeDialog();
  });

  const forms: NodeListOf<HTMLFormElement> =
    dialog.querySelectorAll<HTMLFormElement>('form');
  for (const form of forms) {
    form.addEventListener('submit', (event: SubmitEvent): void => {
      event.preventDefault();
    });
  }

  document.addEventListener(AUTH_DIALOG_OPEN_EVENT, (event: Event): void => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const customEvent: CustomEvent<unknown> = event as CustomEvent<unknown>;
    const detail: unknown = customEvent.detail;
    if (isAuthDialogRequestDetail(detail)) {
      openDialog(detail.mode);
    }
  });

  return dialog;
};
