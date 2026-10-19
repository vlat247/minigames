import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createGameComment,
  fetchCategories,
  fetchFeaturedGames,
  fetchGameComments,
  fetchGameDetails,
  fetchLeaderboard,
  fetchLibraryGames,
  toggleCommentLike,
  toggleGameFavorite,
} from './minigames-api';
import { getApiJson, postApiJson } from './api-client';

vi.mock('./api-client', () => ({
  getApiJson: vi.fn(),
  postApiJson: vi.fn(),
}));

const getApiJsonMock = vi.mocked(getApiJson);
const postApiJsonMock = vi.mocked(postApiJson);

beforeEach(() => {
  getApiJsonMock.mockReset();
  postApiJsonMock.mockReset();
});

describe('MiniGames read requests', () => {
  it('requests categories, leaderboard, and featured games', () => {
    const signal = new AbortController().signal;

    void fetchCategories({ signal });
    void fetchLeaderboard({ signal });
    void fetchFeaturedGames({ signal });

    expect(getApiJsonMock).toHaveBeenNthCalledWith(1, '/api/categories', {
      signal,
    });
    expect(getApiJsonMock).toHaveBeenNthCalledWith(2, '/api/leaderboard', {
      signal,
    });
    expect(getApiJsonMock).toHaveBeenNthCalledWith(
      3,
      '/api/games?featured=true',
      { signal },
    );
  });

  it('serializes library filters in the backend query', () => {
    const signal = new AbortController().signal;

    void fetchLibraryGames(
      { category: 'cozy games', limit: 12, page: 2, sort: 'rating-desc' },
      { signal },
    );

    expect(getApiJsonMock).toHaveBeenCalledWith(
      '/api/games?category=cozy+games&limit=12&page=2&sort=rating-desc',
      { signal },
    );
  });

  it('personalizes details only when an email is provided', () => {
    const signal = new AbortController().signal;

    void fetchGameDetails('cozy/game', {
      signal,
      userEmail: 'player+tag@example.com',
    });
    void fetchGameDetails('guest-game');

    expect(getApiJsonMock).toHaveBeenNthCalledWith(
      1,
      '/api/games/cozy%2Fgame?userEmail=player%2Btag%40example.com',
      { signal },
    );
    expect(getApiJsonMock).toHaveBeenNthCalledWith(2, '/api/games/guest-game', {
      signal: undefined,
    });
  });

  it('serializes personalized latest-comment options', () => {
    const signal = new AbortController().signal;

    void fetchGameComments('cozy-game', {
      limit: 3,
      signal,
      sort: 'newest',
      userEmail: 'player@example.com',
    });

    expect(getApiJsonMock).toHaveBeenCalledWith(
      '/api/games/cozy-game/comments?limit=3&sort=newest&userEmail=player%40example.com',
      { signal },
    );
  });
});

describe('MiniGames authenticated mutations', () => {
  it('toggles a game favorite with the session email', () => {
    const signal = new AbortController().signal;

    void toggleGameFavorite('cozy/game', 'player@example.com', { signal });

    expect(postApiJsonMock).toHaveBeenCalledWith(
      '/api/games/cozy%2Fgame/favorite',
      {
        body: { userEmail: 'player@example.com' },
        signal,
      },
    );
  });

  it('submits the authenticated comment payload', () => {
    const signal = new AbortController().signal;
    const input = {
      authorName: 'Player',
      text: 'A calm little game.',
      userEmail: 'player@example.com',
    };

    void createGameComment('cozy-game', input, { signal });

    expect(postApiJsonMock).toHaveBeenCalledWith(
      '/api/games/cozy-game/comments',
      { body: input, signal },
    );
  });

  it('toggles a comment like with encoded identity values', () => {
    const signal = new AbortController().signal;

    void toggleCommentLike('comment/id', 'player@example.com', { signal });

    expect(postApiJsonMock).toHaveBeenCalledWith(
      '/api/comments/comment%2Fid/like',
      {
        body: { userEmail: 'player@example.com' },
        signal,
      },
    );
  });
});
