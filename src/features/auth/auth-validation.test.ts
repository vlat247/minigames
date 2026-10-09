import { describe, expect, it } from 'vitest';

import {
  AUTH_VALIDATION_MESSAGES,
  validateConfirmPassword,
  validateEmail,
  validateLoginForm,
  validateLoginPassword,
  validateRegistrationForm,
  validateRegistrationPassword,
  validateUsername,
  type AuthFieldValidationResult,
  type LoginFormValues,
  type RegistrationFormValues,
} from './auth-validation';

const VALID_RESULT: AuthFieldValidationResult = {
  error: null,
  isValid: true,
};

const invalidResult = (error: string): AuthFieldValidationResult => ({
  error,
  isValid: false,
});

const VALID_LOGIN: LoginFormValues = {
  email: 'player@example.com',
  password: 'secret',
};

const VALID_REGISTRATION: RegistrationFormValues = {
  confirmPassword: 'Secret1!',
  email: 'player@example.com',
  password: 'Secret1!',
  username: 'Player1',
};

describe('validateEmail', () => {
  it.each(['', ' ', '\t\n'])('requires a non-blank email: %j', (email) => {
    expect(validateEmail(email)).toEqual(
      invalidResult(AUTH_VALIDATION_MESSAGES.emailRequired),
    );
  });

  it.each([
    'player@example.com',
    'player+tag@example.co.uk',
    'first.last@example.travel',
    'x@y.z',
  ])('accepts a standard email address: %s', (email) => {
    expect(validateEmail(email)).toEqual(VALID_RESULT);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateEmail('  player@example.com\t')).toEqual(VALID_RESULT);
  });

  it.each([
    'player',
    'player@',
    '@example.com',
    'player@example',
    'player @example.com',
    'player@example .com',
    'player@@example.com',
  ])('rejects a malformed email address: %s', (email) => {
    expect(validateEmail(email)).toEqual(
      invalidResult(AUTH_VALIDATION_MESSAGES.emailInvalid),
    );
  });
});

describe('validateUsername', () => {
  it.each(['', ' ', '\t\n'])(
    'requires a non-blank username: %j',
    (username) => {
      expect(validateUsername(username)).toEqual(
        invalidResult(AUTH_VALIDATION_MESSAGES.usernameRequired),
      );
    },
  );

  it.each(['Ab', 'Ada', 'Player1', `A${'a'.repeat(29)}`])(
    'accepts a valid username at and within its boundaries: %s',
    (username) => {
      expect(validateUsername(username)).toEqual(VALID_RESULT);
    },
  );

  it('trims surrounding whitespace before validating', () => {
    expect(validateUsername('  Player1\t')).toEqual(VALID_RESULT);
  });

  it.each(['A', `A${'a'.repeat(30)}`])(
    'enforces the 2–30 character limit after trimming: %s',
    (username) => {
      expect(validateUsername(username)).toEqual(
        invalidResult(AUTH_VALIDATION_MESSAGES.usernameLength),
      );
    },
  );

  it.each(['ada', '1Player', '_Player'])(
    'requires the first character to be an uppercase English letter: %s',
    (username) => {
      expect(validateUsername(username)).toEqual(
        invalidResult(AUTH_VALIDATION_MESSAGES.usernameUppercase),
      );
    },
  );

  it.each(['Player_Name', 'Player Name', 'Player-', 'Aáda', 'Aда'])(
    'allows English letters and digits only: %s',
    (username) => {
      expect(validateUsername(username)).toEqual(
        invalidResult(AUTH_VALIDATION_MESSAGES.usernameAllowedCharacters),
      );
    },
  );
});

describe('validateLoginPassword', () => {
  it('requires a password', () => {
    expect(validateLoginPassword('')).toEqual(
      invalidResult(AUTH_VALIDATION_MESSAGES.passwordRequired),
    );
  });

  it.each(['1', '12345', ' A  '])(
    'rejects a password shorter than six characters without trimming: %j',
    (password) => {
      expect(validateLoginPassword(password)).toEqual(
        invalidResult(AUTH_VALIDATION_MESSAGES.loginPasswordLength),
      );
    },
  );

  it.each(['123456', 'simple password', ' '.repeat(6), 'пароль'])(
    'applies no registration-strength rules to a long-enough login password: %j',
    (password) => {
      expect(validateLoginPassword(password)).toEqual(VALID_RESULT);
    },
  );
});

describe('validateRegistrationPassword', () => {
  it('requires a password', () => {
    expect(validateRegistrationPassword('')).toEqual(
      invalidResult(AUTH_VALIDATION_MESSAGES.passwordRequired),
    );
  });

  it.each(['A1!', 'Ab1! '])(
    'requires at least six characters without trimming: %j',
    (password) => {
      expect(validateRegistrationPassword(password)).toEqual(
        invalidResult(AUTH_VALIDATION_MESSAGES.passwordLength),
      );
    },
  );

  it.each(['Abcd1 ', 'Abcd1\n', 'Ábcd1!', 'Abcd1!🙂'])(
    'rejects whitespace and non-ASCII characters: %j',
    (password) => {
      expect(validateRegistrationPassword(password)).toEqual(
        invalidResult(AUTH_VALIDATION_MESSAGES.passwordAllowedCharacters),
      );
    },
  );

  it('requires an uppercase English letter', () => {
    expect(validateRegistrationPassword('secret1!')).toEqual(
      invalidResult(AUTH_VALIDATION_MESSAGES.passwordUppercase),
    );
  });

  it('requires a digit', () => {
    expect(validateRegistrationPassword('Secret!')).toEqual(
      invalidResult(AUTH_VALIDATION_MESSAGES.passwordDigit),
    );
  });

  it('requires a special character', () => {
    expect(validateRegistrationPassword('Secret1')).toEqual(
      invalidResult(AUTH_VALIDATION_MESSAGES.passwordSpecialCharacter),
    );
  });

  it.each(['Secret1!', 'A1!aaa', 'Password9~', 'Strong2[]'])(
    'accepts English letters, digits, and ASCII special characters: %s',
    (password) => {
      expect(validateRegistrationPassword(password)).toEqual(VALID_RESULT);
    },
  );
});

describe('validateConfirmPassword', () => {
  it('requires confirmation before checking a match', () => {
    expect(validateConfirmPassword('', '')).toEqual(
      invalidResult(AUTH_VALIDATION_MESSAGES.confirmPasswordRequired),
    );
  });

  it('requires an exact, case-sensitive match without trimming', () => {
    expect(validateConfirmPassword('Secret1! ', 'Secret1!')).toEqual(
      invalidResult(AUTH_VALIDATION_MESSAGES.confirmPasswordMismatch),
    );
    expect(validateConfirmPassword('secret1!', 'Secret1!')).toEqual(
      invalidResult(AUTH_VALIDATION_MESSAGES.confirmPasswordMismatch),
    );
  });

  it('validates only the match instead of repeating password rules', () => {
    expect(validateConfirmPassword('weak', 'weak')).toEqual(VALID_RESULT);
  });
});

describe('validateLoginForm', () => {
  it('enables submission only when every login field is valid', () => {
    const result = validateLoginForm(VALID_LOGIN);

    expect(result).toEqual({
      fields: {
        email: VALID_RESULT,
        password: VALID_RESULT,
      },
      isValid: true,
    });
  });

  it.each([
    { email: '', password: 'secret' },
    { email: 'not-an-email', password: 'secret' },
    { email: 'player@example.com', password: '' },
    { email: 'player@example.com', password: 'short' },
  ])('keeps submission disabled for invalid values: %j', (values) => {
    expect(validateLoginForm(values).isValid).toBe(false);
  });

  it('uses trimmed email validation without trimming the password', () => {
    expect(
      validateLoginForm({
        email: ' player@example.com ',
        password: ' '.repeat(6),
      }).isValid,
    ).toBe(true);
  });
});

describe('validateRegistrationForm', () => {
  it('enables submission only when every registration field is valid', () => {
    const result = validateRegistrationForm(VALID_REGISTRATION);

    expect(result).toEqual({
      fields: {
        confirmPassword: VALID_RESULT,
        email: VALID_RESULT,
        password: VALID_RESULT,
        username: VALID_RESULT,
      },
      isValid: true,
    });
  });

  it.each([
    {
      confirmPassword: 'Secret1!',
      email: '',
      password: 'Secret1!',
      username: 'Player1',
    },
    {
      confirmPassword: 'Secret1!',
      email: 'bad',
      password: 'Secret1!',
      username: 'Player1',
    },
    {
      confirmPassword: 'Secret1!',
      email: 'player@example.com',
      password: '',
      username: 'Player1',
    },
    {
      confirmPassword: 'different',
      email: 'player@example.com',
      password: 'Secret1!',
      username: 'Player1',
    },
    {
      confirmPassword: 'Secret1!',
      email: 'player@example.com',
      password: 'Secret1!',
      username: '',
    },
  ])('keeps submission disabled for invalid values: %j', (values) => {
    expect(validateRegistrationForm(values).isValid).toBe(false);
  });

  it('uses trimmed email and username validation', () => {
    expect(
      validateRegistrationForm({
        ...VALID_REGISTRATION,
        email: ' player@example.com ',
        username: ' Player1 ',
      }).isValid,
    ).toBe(true);
  });

  it('revalidates confirmation against the current password', () => {
    const initialResult = validateRegistrationForm(VALID_REGISTRATION);
    const changedPasswordResult = validateRegistrationForm({
      ...VALID_REGISTRATION,
      password: 'Changed2!',
    });

    expect(initialResult.fields.confirmPassword).toEqual(VALID_RESULT);
    expect(changedPasswordResult.fields.confirmPassword).toEqual(
      invalidResult(AUTH_VALIDATION_MESSAGES.confirmPasswordMismatch),
    );
    expect(changedPasswordResult.isValid).toBe(false);
  });
});
