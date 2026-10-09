import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createLeaderboardSection,
  type LeaderboardSectionController,
} from './leaderboard';
import {
  SNACKBAR_SHOW_EVENT,
  isSnackbarRequestDetail,
} from '../../components/snackbar/snackbar-events';
import type { SnackbarOptions } from '../../components/snackbar/snackbar';
import { ApiAbortError } from '../../services/api-client';
import { fetchLeaderboard } from '../../services/minigames-api';
import type { LeaderboardEntry, LeaderboardResponse } from '../../types/api';

vi.mock('../../services/minigames-api', () => ({
  fetchLeaderboard: vi.fn(),
}));

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value | PromiseLike<Value>) => void;
}

interface PromiseWithResolversConstructor extends PromiseConstructor {
  readonly withResolvers: <Value>() => {
    readonly promise: Promise<Value>;
    readonly reject: (reason?: unknown) => void;
    readonly resolve: (value: Value | PromiseLike<Value>) => void;
  };
}

const fetchLeaderboardMock = vi.mocked(fetchLeaderboard);
const controllers: LeaderboardSectionController[] = [];

const createDeferred = <Value>(): Deferred<Value> => {
  const promiseConstructor = Promise as PromiseWithResolversConstructor;
  const { promise, resolve } = promiseConstructor.withResolvers<Value>();
  return { promise, resolve };
};

const settleRequests = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createEntry = (
  overrides: Partial<LeaderboardEntry> = {},
): LeaderboardEntry => ({
  favoriteGameName: 'Tiny Gardens',
  favoriteGameSlug: 'tiny-gardens',
  gamesPlayed: 12,
  playerName: 'Ada Lovelace',
  rank: 1,
  streakDays: 4,
  totalScore: 94_250,
  ...overrides,
});

const createResponse = (
  data: readonly LeaderboardEntry[],
): LeaderboardResponse => ({
  data,
  meta: {
    description: 'Weekly leaderboard',
    totalItems: data.length,
  },
});

const createController = (): LeaderboardSectionController => {
  const controller = createLeaderboardSection();
  controllers.push(controller);
  document.body.append(controller.element);
  return controller;
};

afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.destroy();
  }
  fetchLeaderboardMock.mockReset();
});

describe('leaderboard section', () => {
  it('renders accessible, formatted leaderboard rows', async () => {
    const blankPlayerName: string = ' '.repeat(3);
    fetchLeaderboardMock.mockResolvedValue(
      createResponse([
        createEntry(),
        createEntry({
          playerName: 'CozyGamer_x',
          rank: 2,
          streakDays: 1,
          totalScore: 81_400,
        }),
        createEntry({ playerName: 'xy', rank: 3, streakDays: 0 }),
        createEntry({ playerName: blankPlayerName, rank: 4 }),
      ]),
    );

    const controller = createController();
    expect(controller.element.textContent).toContain(
      'Loading weekly leaderboard',
    );
    await settleRequests();

    const table = controller.element.querySelector('table');
    const rows = controller.element.querySelectorAll(':scope tbody tr');
    const avatars = controller.element.querySelectorAll('.leaderboard__avatar');
    expect(table?.querySelector('caption')?.textContent).toBe(
      'Weekly MiniGames leaderboard',
    );
    expect(table?.querySelectorAll('th')).toHaveLength(6);
    expect(rows).toHaveLength(4);
    expect(rows[0]?.textContent).toContain('#1');
    expect(rows[0]?.textContent).toContain('94,250');
    expect(rows[0]?.textContent).toContain('4 days');
    expect(rows[1]?.textContent).toContain('1 day');
    expect([...avatars].map((avatar) => avatar.textContent)).toEqual([
      'AL',
      'CX',
      'XY',
      '?',
    ]);
    expect(avatars[1]?.classList.contains('leaderboard__avatar--green')).toBe(
      true,
    );
  });

  it('renders an empty state when no rankings are returned', async () => {
    fetchLeaderboardMock.mockResolvedValue(createResponse([]));

    const controller = createController();
    await settleRequests();

    expect(
      controller.element.querySelector('[data-async-state="empty"]'),
    ).not.toBeNull();
    expect(controller.element.textContent).toContain(
      'No leaderboard results yet',
    );
  });

  it('shows failure feedback and retries the request', async () => {
    const snackbarMessages: SnackbarOptions[] = [];
    const eventController = new AbortController();
    const listener = (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (isSnackbarRequestDetail(detail)) {
        snackbarMessages.push(detail);
      }
    };
    document.addEventListener(SNACKBAR_SHOW_EVENT, listener, {
      signal: eventController.signal,
    });
    fetchLeaderboardMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(createResponse([createEntry()]));

    const controller = createController();
    await settleRequests();

    expect(
      controller.element.querySelector('[data-async-state="error"]'),
    ).not.toBeNull();
    expect(snackbarMessages).toEqual([
      {
        message: 'The leaderboard is unavailable right now. Please try again.',
        variant: 'error',
      },
    ]);

    controller.element.querySelector<HTMLButtonElement>('button')?.click();
    expect(fetchLeaderboardMock).toHaveBeenCalledTimes(2);
    expect(controller.element.textContent).toContain(
      'Loading weekly leaderboard',
    );
    await settleRequests();
    expect(controller.element.querySelectorAll(':scope tbody tr')).toHaveLength(
      1,
    );
    eventController.abort();
  });

  it('keeps loading feedback for an aborted request without an error notice', async () => {
    const snackbarMessages: SnackbarOptions[] = [];
    const eventController = new AbortController();
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
    fetchLeaderboardMock.mockRejectedValue(
      new ApiAbortError('https://example.test/leaderboard', new Error('abort')),
    );

    const controller = createController();
    await settleRequests();

    expect(controller.element.textContent).toContain(
      'Loading weekly leaderboard',
    );
    expect(snackbarMessages).toEqual([]);
    eventController.abort();
  });

  it('aborts and ignores a pending response after destruction', async () => {
    const request = createDeferred<LeaderboardResponse>();
    fetchLeaderboardMock.mockReturnValue(request.promise);
    const controller = createController();
    const signal = fetchLeaderboardMock.mock.calls[0]?.[0]?.signal;

    controller.destroy();
    expect(signal?.aborted).toBe(true);
    request.resolve(createResponse([createEntry()]));
    await settleRequests();

    expect(controller.element.querySelector('table')).toBeNull();
    expect(controller.element.textContent).toContain(
      'Loading weekly leaderboard',
    );
  });
});
