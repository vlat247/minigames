import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API_BASE_URL,
  ApiAbortError,
  ApiHttpError,
  ApiNetworkError,
  ApiResponseError,
  getApiJson,
  isApiAbortError,
} from './api-client';

const fetchMock = vi.fn<typeof fetch>();

describe('getApiJson', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests JSON with GET and returns the parsed response', async () => {
    const payload = { games: [{ id: 7, name: 'Snake' }] };
    fetchMock.mockResolvedValueOnce(
      Response.json(payload, {
        status: 200,
      }),
    );

    await expect(getApiJson<typeof payload>('/games?limit=1')).resolves.toEqual(
      payload,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/games?limit=1`, {
      headers: { Accept: 'application/json' },
      method: 'GET',
      signal: undefined,
    });
  });

  it('throws an HTTP error with the API message and response details', async () => {
    const payload = { error: 'Game not found.' };
    fetchMock.mockResolvedValueOnce(
      Response.json(payload, {
        status: 404,
        statusText: 'Not Found',
      }),
    );

    const request = getApiJson('/games/unknown');

    await expect(request).rejects.toBeInstanceOf(ApiHttpError);
    await expect(request).rejects.toMatchObject({
      message: payload.error,
      name: 'ApiHttpError',
      payload,
      status: 404,
      statusText: 'Not Found',
      url: `${API_BASE_URL}/games/unknown`,
    });
  });

  it('uses the status fallback when an error body is not valid JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('service unavailable', { status: 503 }),
    );

    await expect(getApiJson('/games')).rejects.toMatchObject({
      message: 'The MiniGames API request failed with status 503.',
      name: 'ApiHttpError',
      payload: undefined,
      status: 503,
    });
  });

  it('uses the HTTP status text when a parsed error has no API message', async () => {
    const payload = { detail: 'Internal details are not user-facing.' };
    fetchMock.mockResolvedValueOnce(
      Response.json(payload, {
        status: 429,
        statusText: 'Too Many Requests',
      }),
    );

    await expect(getApiJson('/games')).rejects.toMatchObject({
      message: 'Too Many Requests',
      payload,
      status: 429,
    });
  });

  it('wraps invalid JSON from a successful response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>not JSON</html>', { status: 200 }),
    );

    const request = getApiJson('/games');

    await expect(request).rejects.toBeInstanceOf(ApiResponseError);
    await expect(request).rejects.toMatchObject({
      message: 'The MiniGames API returned an invalid JSON response.',
      name: 'ApiResponseError',
      url: `${API_BASE_URL}/games`,
    });
  });

  it('wraps fetch failures as network errors and preserves the cause', async () => {
    const cause = new TypeError('Connection reset');
    fetchMock.mockRejectedValueOnce(cause);

    const request = getApiJson('/games');

    await expect(request).rejects.toBeInstanceOf(ApiNetworkError);
    await expect(request).rejects.toMatchObject({
      cause,
      message: 'Unable to reach the MiniGames API.',
      name: 'ApiNetworkError',
      url: `${API_BASE_URL}/games`,
    });
  });

  it('recognizes a native fetch abort without requiring an aborted signal', async () => {
    const cause = new DOMException('Request aborted', 'AbortError');
    fetchMock.mockRejectedValueOnce(cause);

    const request = getApiJson('/games');

    await expect(request).rejects.toBeInstanceOf(ApiAbortError);
    await expect(request).rejects.toMatchObject({
      cause,
      message: 'The API request was cancelled.',
      name: 'ApiAbortError',
      url: `${API_BASE_URL}/games`,
    });
    expect(isApiAbortError(new ApiAbortError('/games', cause))).toBe(true);
    expect(isApiAbortError(new Error('Different failure'))).toBe(false);
  });

  it('turns response parsing failures into abort errors when the signal aborts', async () => {
    const controller = new AbortController();
    const response = new Response('{}', { status: 200 });
    const parseCause = new TypeError('Body reading stopped');

    vi.spyOn(response, 'json').mockImplementation(async () => {
      controller.abort();
      throw parseCause;
    });
    fetchMock.mockResolvedValueOnce(response);

    await expect(
      getApiJson('/games', { signal: controller.signal }),
    ).rejects.toMatchObject({
      cause: parseCause,
      message: 'The API request was cancelled.',
      name: 'ApiAbortError',
    });
  });
});
