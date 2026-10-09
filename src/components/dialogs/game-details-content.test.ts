import { describe, expect, it, vi } from 'vitest';

import {
  createAvatarColorRegistry,
  createCommentComposer,
  createCommentElements,
  createGameDetailsFragment,
  getAvatarInitial,
  resizeCommentTextarea,
  updateCommentComposerState,
  updateCommentLikeControl,
  updateGameFavoriteControls,
} from './game-details-content';
import type { GameComment, GameDetails } from '../../types/api';

const game: GameDetails = {
  fullDescription: 'A calm game about arranging tiny gardens.',
  heroImage: '/assets/images/games/tiny-gardens.webp',
  isLikedByCurrentUser: false,
  likesCount: 1234,
  name: 'Tiny Gardens',
  rating: 4.8,
  slug: 'tiny-gardens',
  specs: {
    duration: '10 minutes',
    genre: 'Puzzle',
    players: '1',
    price: 'Free',
  },
  topRecords: [],
};

const createComment = (overrides: Partial<GameComment> = {}): GameComment => ({
  authorName: 'Ada',
  commentId: 'comment-1',
  createdAt: '2026-10-08T12:00:00.000Z',
  isLikedByCurrentUser: false,
  likesCount: 2,
  text: 'A thoughtful comment.',
  ...overrides,
});

const getRequiredElement = <ElementType extends Element>(
  root: ParentNode,
  selector: string,
): ElementType => {
  const element: ElementType | null = root.querySelector<ElementType>(selector);
  if (element === null) {
    throw new Error(`Expected an element matching ${selector}.`);
  }

  return element;
};

describe('game details content', () => {
  it('renders an actionable favorite control and updates only from supplied state', () => {
    const container: HTMLDivElement = document.createElement('div');
    container.append(createGameDetailsFragment(game));
    const button: HTMLButtonElement = getRequiredElement<HTMLButtonElement>(
      container,
      '[data-game-favorite]',
    );
    const count: HTMLElement = getRequiredElement<HTMLElement>(
      container,
      '[data-game-favorite-count]',
    );

    expect(button.disabled).toBe(false);
    expect(button.ariaPressed).toBe('false');
    expect(button.getAttribute('aria-label')).toContain(
      'Add Tiny Gardens to favorites',
    );
    expect(count.textContent).toBe('1.2K');

    updateGameFavoriteControls(button, count, {
      gameName: game.name,
      isFavorited: true,
      isPending: true,
      likesCount: 1235,
    });

    expect(button.disabled).toBe(true);
    expect(button.ariaBusy).toBe('true');
    expect(button.ariaPressed).toBe('true');
    expect(button.classList).toContain('game-info__favorite--active');
    expect(button.querySelector('[data-favorite-label]')?.textContent).toBe(
      'Remove from Favorites',
    );
    expect(count.textContent).toBe('1.2K');
  });

  it('renders personalized comment-like buttons with integration hooks', () => {
    const [element] = createCommentElements(
      [
        createComment({
          isLikedByCurrentUser: true,
          likesCount: 7,
        }),
      ],
      () => 'lavender',
    );
    if (element === undefined) {
      throw new Error('Expected a rendered comment.');
    }

    const button: HTMLButtonElement = getRequiredElement<HTMLButtonElement>(
      element,
      '[data-comment-like]',
    );

    expect(button.type).toBe('button');
    expect(button.dataset.commentId).toBe('comment-1');
    expect(button.ariaPressed).toBe('true');
    expect(button.disabled).toBe(false);
    expect(
      getRequiredElement(element, '[data-comment-like-count]').textContent,
    ).toBe('7');
    expect(getRequiredElement(element, '.game-avatar').classList).toContain(
      'game-avatar--lavender',
    );

    updateCommentLikeControl(button, {
      isLikedByCurrentUser: false,
      isPending: true,
      likesCount: 6,
    });

    expect(button.disabled).toBe(true);
    expect(button.ariaPressed).toBe('false');
    expect(button.getAttribute('aria-label')).toContain('6 likes');
    expect(
      getRequiredElement(button, '[data-comment-like-count]').textContent,
    ).toBe('6');
  });

  it('assigns one random token color per normalized commenter', () => {
    const random = vi
      .fn<() => number>()
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.8);
    const resolveColor = createAvatarColorRegistry(random);
    const adaComment = createComment();

    expect(resolveColor(adaComment)).toBe('green');
    expect(
      resolveColor(
        createComment({ authorName: '  ADA ', commentId: 'comment-2' }),
      ),
    ).toBe('green');
    expect(
      resolveColor(
        createComment({ authorName: 'Grace', commentId: 'comment-3' }),
      ),
    ).toBe('lavender');
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('builds an accessible authenticated comment composer and renders state', () => {
    const composer = createCommentComposer('  ada lovelace  ');

    expect(getAvatarInitial('  émilie')).toBe('É');
    expect(composer.avatar.textContent).toBe('A');
    expect(composer.textarea.maxLength).toBe(500);
    expect(composer.textarea.required).toBe(true);
    expect(composer.submitButton.type).toBe('submit');
    expect(composer.status.getAttribute('role')).toBe('status');
    expect(composer.status.hidden).toBe(true);

    updateCommentComposerState(composer, {
      isPending: true,
      message: 'Could not post your comment.',
      tone: 'error',
    });

    expect(composer.element.ariaBusy).toBe('true');
    expect(composer.textarea.disabled).toBe(true);
    expect(composer.submitButton.disabled).toBe(true);
    expect(composer.status.hidden).toBe(false);
    expect(composer.status.getAttribute('role')).toBe('alert');
    expect(composer.status.classList).toContain(
      'game-comment-composer__status--error',
    );

    Object.defineProperty(composer.textarea, 'scrollHeight', {
      configurable: true,
      value: 72,
    });
    resizeCommentTextarea(composer.textarea);
    expect(composer.textarea.style.height).toBe('72px');
  });
});
