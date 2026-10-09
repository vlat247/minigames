import type { ApiErrorPayload } from '../types/api';

export const API_BASE_URL: string =
  'https://faxb76kxra.execute-api.eu-central-1.amazonaws.com';

export interface ApiRequestOptions {
  readonly signal?: AbortSignal;
}

export interface ApiJsonRequestOptions extends ApiRequestOptions {
  readonly body: unknown;
}

export class ApiError extends Error {
  public readonly url: string;

  public constructor(message: string, url: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ApiError';
    this.url = url;
  }
}

export class ApiAbortError extends ApiError {
  public constructor(url: string, cause: unknown) {
    super('The API request was cancelled.', url, { cause });
    this.name = 'ApiAbortError';
  }
}

export class ApiHttpError extends ApiError {
  public readonly payload: unknown;

  public readonly status: number;

  public readonly statusText: string;

  public constructor(
    response: Response,
    url: string,
    message: string,
    payload: unknown,
  ) {
    super(message, url);
    this.name = 'ApiHttpError';
    this.payload = payload;
    this.status = response.status;
    this.statusText = response.statusText;
  }
}

export class ApiNetworkError extends ApiError {
  public constructor(url: string, cause: unknown) {
    super('Unable to reach the MiniGames API.', url, { cause });
    this.name = 'ApiNetworkError';
  }
}

export class ApiResponseError extends ApiError {
  public constructor(url: string, cause: unknown) {
    super('The MiniGames API returned an invalid JSON response.', url, {
      cause,
    });
    this.name = 'ApiResponseError';
  }
}

interface ParsedErrorResponse {
  readonly message: string;
  readonly payload: unknown;
}

const isApiErrorPayload = (value: unknown): value is ApiErrorPayload => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  );
};

const getFallbackErrorMessage = (response: Response): string => {
  return response.statusText.length > 0
    ? response.statusText
    : `The MiniGames API request failed with status ${response.status}.`;
};

const parseErrorResponse = async (
  response: Response,
  url: string,
  signal?: AbortSignal,
): Promise<ParsedErrorResponse> => {
  const fallbackMessage: string = getFallbackErrorMessage(response);

  try {
    const payload: unknown = await response.json();

    return {
      message: isApiErrorPayload(payload) ? payload.error : fallbackMessage,
      payload,
    };
  } catch (error: unknown) {
    if (signal?.aborted === true || isNativeAbortError(error)) {
      throw new ApiAbortError(url, error);
    }

    return { message: fallbackMessage, payload: undefined };
  }
};

const isNativeAbortError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === 'AbortError';
};

export const isApiAbortError = (error: unknown): error is ApiAbortError => {
  return error instanceof ApiAbortError;
};

const parseSuccessResponse = async <TResponse>(
  response: Response,
  url: string,
  signal?: AbortSignal,
): Promise<TResponse> => {
  try {
    const payload: unknown = await response.json();
    return payload as TResponse;
  } catch (error: unknown) {
    if (signal?.aborted === true || isNativeAbortError(error)) {
      throw new ApiAbortError(url, error);
    }

    throw new ApiResponseError(url, error);
  }
};

const requestApiJson = async <TResponse>(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<TResponse> => {
  const url: string = new URL(path, API_BASE_URL).href;
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      signal,
    });
  } catch (error: unknown) {
    if (signal?.aborted === true || isNativeAbortError(error)) {
      throw new ApiAbortError(url, error);
    }

    throw new ApiNetworkError(url, error);
  }

  if (!response.ok) {
    const parsedError: ParsedErrorResponse = await parseErrorResponse(
      response,
      url,
      signal,
    );
    throw new ApiHttpError(
      response,
      url,
      parsedError.message,
      parsedError.payload,
    );
  }

  return parseSuccessResponse<TResponse>(response, url, signal);
};

export const getApiJson = <TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> => {
  return requestApiJson<TResponse>(
    path,
    {
      headers: { Accept: 'application/json' },
      method: 'GET',
    },
    options.signal,
  );
};

export const postApiJson = <TResponse>(
  path: string,
  options: ApiJsonRequestOptions,
): Promise<TResponse> => {
  return requestApiJson<TResponse>(
    path,
    {
      body: JSON.stringify(options.body),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
    options.signal,
  );
};
