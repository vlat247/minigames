export const AUTH_VALIDATION_MESSAGES = {
  confirmPasswordMismatch: 'Passwords do not match.',
  confirmPasswordRequired: 'Confirm your password.',
  emailInvalid: 'Enter a valid email address.',
  emailRequired: 'Email is required.',
  loginPasswordLength: 'Password must be at least 6 characters.',
  passwordAllowedCharacters:
    'Password may contain English letters, digits, and special characters only.',
  passwordDigit: 'Password must contain at least one digit.',
  passwordLength: 'Password must be at least 6 characters.',
  passwordRequired: 'Password is required.',
  passwordSpecialCharacter:
    'Password must contain at least one special character.',
  passwordUppercase:
    'Password must contain at least one uppercase English letter.',
  usernameAllowedCharacters:
    'Username may contain English letters and digits only.',
  usernameLength: 'Username must be between 2 and 30 characters.',
  usernameRequired: 'Username is required.',
  usernameUppercase: 'Username must start with an uppercase English letter.',
} as const;

export type AuthFieldValidationResult =
  | {
      readonly error: null;
      readonly isValid: true;
    }
  | {
      readonly error: string;
      readonly isValid: false;
    };

export interface LoginFormValues {
  readonly email: string;
  readonly password: string;
}

export interface RegistrationFormValues extends LoginFormValues {
  readonly confirmPassword: string;
  readonly username: string;
}

export interface LoginFormValidationResult {
  readonly fields: {
    readonly email: AuthFieldValidationResult;
    readonly password: AuthFieldValidationResult;
  };
  readonly isValid: boolean;
}

export interface RegistrationFormValidationResult {
  readonly fields: {
    readonly confirmPassword: AuthFieldValidationResult;
    readonly email: AuthFieldValidationResult;
    readonly password: AuthFieldValidationResult;
    readonly username: AuthFieldValidationResult;
  };
  readonly isValid: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const USERNAME_PATTERN = /^[A-Za-z0-9]+$/u;
const UPPERCASE_ENGLISH_LETTER_PATTERN = /[A-Z]/u;
const DIGIT_PATTERN = /[0-9]/u;
const PRINTABLE_ASCII_PATTERN = /^[\u{21}-\u{7E}]+$/u;
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/u;

const validResult = (): AuthFieldValidationResult => ({
  error: null,
  isValid: true,
});

const invalidResult = (error: string): AuthFieldValidationResult => ({
  error,
  isValid: false,
});

export const validateEmail = (value: string): AuthFieldValidationResult => {
  const email = value.trim();

  if (email.length === 0) {
    return invalidResult(AUTH_VALIDATION_MESSAGES.emailRequired);
  }

  return EMAIL_PATTERN.test(email)
    ? validResult()
    : invalidResult(AUTH_VALIDATION_MESSAGES.emailInvalid);
};

export const validateUsername = (value: string): AuthFieldValidationResult => {
  const username = value.trim();

  if (username.length === 0) {
    return invalidResult(AUTH_VALIDATION_MESSAGES.usernameRequired);
  }

  if (username.length < 2 || username.length > 30) {
    return invalidResult(AUTH_VALIDATION_MESSAGES.usernameLength);
  }

  if (!UPPERCASE_ENGLISH_LETTER_PATTERN.test(username.charAt(0))) {
    return invalidResult(AUTH_VALIDATION_MESSAGES.usernameUppercase);
  }

  return USERNAME_PATTERN.test(username)
    ? validResult()
    : invalidResult(AUTH_VALIDATION_MESSAGES.usernameAllowedCharacters);
};

export const validateLoginPassword = (
  value: string,
): AuthFieldValidationResult => {
  if (value.length === 0) {
    return invalidResult(AUTH_VALIDATION_MESSAGES.passwordRequired);
  }

  return value.length >= 6
    ? validResult()
    : invalidResult(AUTH_VALIDATION_MESSAGES.loginPasswordLength);
};

export const validateRegistrationPassword = (
  value: string,
): AuthFieldValidationResult => {
  if (value.length === 0) {
    return invalidResult(AUTH_VALIDATION_MESSAGES.passwordRequired);
  }

  if (value.length < 6) {
    return invalidResult(AUTH_VALIDATION_MESSAGES.passwordLength);
  }

  if (!PRINTABLE_ASCII_PATTERN.test(value)) {
    return invalidResult(AUTH_VALIDATION_MESSAGES.passwordAllowedCharacters);
  }

  if (!UPPERCASE_ENGLISH_LETTER_PATTERN.test(value)) {
    return invalidResult(AUTH_VALIDATION_MESSAGES.passwordUppercase);
  }

  if (!DIGIT_PATTERN.test(value)) {
    return invalidResult(AUTH_VALIDATION_MESSAGES.passwordDigit);
  }

  return SPECIAL_CHARACTER_PATTERN.test(value)
    ? validResult()
    : invalidResult(AUTH_VALIDATION_MESSAGES.passwordSpecialCharacter);
};

export const validateConfirmPassword = (
  value: string,
  password: string,
): AuthFieldValidationResult => {
  if (value.length === 0) {
    return invalidResult(AUTH_VALIDATION_MESSAGES.confirmPasswordRequired);
  }

  return value === password
    ? validResult()
    : invalidResult(AUTH_VALIDATION_MESSAGES.confirmPasswordMismatch);
};

export const validateLoginForm = (
  values: LoginFormValues,
): LoginFormValidationResult => {
  const fields = {
    email: validateEmail(values.email),
    password: validateLoginPassword(values.password),
  };

  return {
    fields,
    isValid: fields.email.isValid && fields.password.isValid,
  };
};

export const validateRegistrationForm = (
  values: RegistrationFormValues,
): RegistrationFormValidationResult => {
  const fields = {
    confirmPassword: validateConfirmPassword(
      values.confirmPassword,
      values.password,
    ),
    email: validateEmail(values.email),
    password: validateRegistrationPassword(values.password),
    username: validateUsername(values.username),
  };

  return {
    fields,
    isValid:
      fields.confirmPassword.isValid &&
      fields.email.isValid &&
      fields.password.isValid &&
      fields.username.isValid,
  };
};
