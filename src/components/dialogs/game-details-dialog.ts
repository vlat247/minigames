import { GAME_DETAILS_OPEN_EVENT } from './game-details-events';
import { getAppPath } from '../../utils/paths';
import './game-details-dialog.scss';

const DIALOG_TRANSITION_DURATION_MS: number = 240;
const COMMENT_TEXTAREA_MAX_HEIGHT_PX: number = 88;

interface GameComment {
  readonly author: string;
  readonly avatarColor: string;
  readonly likes: number;
  readonly text: string;
  readonly timeAgo: string;
}

interface GameRecord {
  readonly medal: string;
  readonly player: string;
  readonly score: string;
  readonly timeAgo: string;
}

export interface GameDetailsDialogController {
  readonly destroy: () => void;
  readonly element: HTMLDialogElement;
}

const records: readonly GameRecord[] = [
  {
    medal: '🥇',
    player: 'ForestSpirit',
    score: '356,700 pts',
    timeAgo: '2 days ago',
  },
  {
    medal: '🥈',
    player: 'TeaBrewer',
    score: '332,400 pts',
    timeAgo: '5 days ago',
  },
  {
    medal: '🥉',
    player: 'HerbalistPath',
    score: '308,900 pts',
    timeAgo: '1 week ago',
  },
];

const comments: readonly GameComment[] = [
  {
    author: 'ForestDweller',
    avatarColor: 'blue',
    likes: 12,
    text: "The hand-drawn art is absolutely magical 🍄 Every location feels like a page from a children's storybook. The mushroom village made me cry happy tears!",
    timeAgo: '3 hours ago',
  },
  {
    author: 'HerbalTeaLover',
    avatarColor: 'yellow',
    likes: 5,
    text: 'Perfect cozy evening game — brew a cup of chamomile, wrap in a blanket and help the little Tukoni prepare for winter. The puzzles are gentle but satisfying.',
    timeAgo: '1 day ago',
  },
  {
    author: 'CottageCoreMia',
    avatarColor: 'pink',
    likes: 8,
    text: 'I want to live inside this game forever 🌿 The NPCs are so charming, the tea recipes are real, and the atmosphere is pure warmth and calm.',
    timeAgo: '2 days ago',
  },
];

const createRecordsMarkup = (): string => {
  return records
    .map(
      (record: GameRecord): string => `
        <li class="game-records__item">
          <span class="game-records__medal" aria-hidden="true">${record.medal}</span>
          <strong>${record.player}</strong>
          <span class="game-records__score">${record.score}</span>
          <span class="game-records__time">${record.timeAgo}</span>
        </li>
      `,
    )
    .join('');
};

const createCommentsMarkup = (): string => {
  return comments
    .map(
      (comment: GameComment, index: number): string => `
        <article class="game-comment">
          <header class="game-comment__header">
            <span class="game-avatar game-avatar--${comment.avatarColor}" aria-hidden="true">${comment.author.charAt(0)}</span>
            <strong>${comment.author}</strong>
            <time>${comment.timeAgo}</time>
          </header>
          <p>${comment.text}</p>
          <button
            class="game-comment__like"
            type="button"
            data-comment-like="${index}"
            data-default-likes="${comment.likes}"
            aria-label="Like comment by ${comment.author}"
            aria-pressed="false"
          >
            <span class="material-symbols-rounded" aria-hidden="true">favorite</span>
            <span data-like-count>${comment.likes}</span>
          </button>
        </article>
      `,
    )
    .join('');
};

const toggleCommentLike = (button: HTMLButtonElement): void => {
  const isActive: boolean = button.ariaPressed !== 'true';
  const defaultLikes: number = Number(button.dataset.defaultLikes ?? 0);
  const count: HTMLElement | null = button.querySelector('[data-like-count]');

  button.ariaPressed = String(isActive);
  button.classList.toggle('game-comment__like--active', isActive);
  if (count !== null) {
    count.textContent = String(defaultLikes + (isActive ? 1 : 0));
  }
};

export const createGameDetailsDialog = (): GameDetailsDialogController => {
  const dialog: HTMLDialogElement = document.createElement('dialog');
  const eventController: AbortController = new AbortController();
  const { signal } = eventController;
  const heroImagePath: string = getAppPath(
    '/assets/images/games/tukoni-forest-keepers-hero.jpg',
  );

  dialog.className = 'game-details-dialog';
  dialog.setAttribute('aria-labelledby', 'game-details-title');
  dialog.innerHTML = `
    <div class="game-details-dialog__hero">
      <img src="${heroImagePath}" alt="A hand-drawn forest scene from Tukoni: Forest Keepers" />
      <button class="game-details-dialog__close" type="button" data-dialog-close aria-label="Close game details">
        <span class="material-symbols-rounded" aria-hidden="true">close</span>
      </button>
    </div>

    <div class="game-details-dialog__content">
      <section class="game-info" aria-labelledby="game-details-title">
        <div class="game-info__heading">
          <h2 id="game-details-title">Tukoni: Forest Keepers</h2>
          <div class="game-info__stats" aria-label="Game rating and likes">
            <span class="game-info__rating"><span class="material-symbols-rounded" aria-hidden="true">star</span>4.9</span>
            <span class="game-info__likes"><span class="material-symbols-rounded" aria-hidden="true">favorite</span>31.2K</span>
          </div>
        </div>

        <p class="game-info__description">Tukoni: Forest Keepers — a cozy hand-drawn puzzle-adventure. You are Traveller, a little forest spirit on an important mission. Wander storybook meadows, visit mushroom villages, meet adorable inhabitants, solve gentle hand-crafted puzzles, brew herbal teas and help the Tukoni forest prepare peacefully for the coming winter.</p>

        <dl class="game-specs">
          <div><dt>Genre</dt><dd>Puzzle</dd></div>
          <div><dt>Players</dt><dd>Solo</dd></div>
          <div><dt>Duration</dt><dd>40–90 min</dd></div>
          <div><dt>Price</dt><dd>Free</dd></div>
        </dl>

        <div class="game-info__actions">
          <button class="btn btn--primary game-info__play" type="button">Play Now</button>
          <button class="btn btn--secondary game-info__favorite" type="button" data-favorite aria-pressed="false" aria-label="Add Tukoni: Forest Keepers to favorites">
            <span class="material-symbols-rounded" aria-hidden="true">favorite</span>
            <span data-favorite-label>Add to Favorites</span>
          </button>
        </div>
      </section>

      <section class="game-records" aria-labelledby="game-records-title">
        <h3 id="game-records-title"><span aria-hidden="true">🏆</span> Top Records</h3>
        <ol>${createRecordsMarkup()}</ol>
      </section>

      <section class="game-comments" aria-labelledby="game-comments-title">
        <h3 id="game-comments-title">Comments (${comments.length})</h3>
        <form class="game-comment-form">
          <span class="game-avatar game-avatar--yellow" aria-hidden="true">U</span>
          <label class="game-comment-form__field">
            <span class="game-comment-form__label">Write a comment</span>
            <textarea name="comment" rows="1" placeholder="Write a comment..."></textarea>
          </label>
          <button class="game-comment-form__submit" type="submit" aria-label="Submit comment">
            <span class="material-symbols-rounded" aria-hidden="true">send</span>
          </button>
        </form>
        <div class="game-comments__list">${createCommentsMarkup()}</div>
      </section>
    </div>
  `;

  const favoriteButton: HTMLButtonElement | null =
    dialog.querySelector('[data-favorite]');
  const favoriteLabel: HTMLElement | null = dialog.querySelector(
    '[data-favorite-label]',
  );
  const textarea: HTMLTextAreaElement | null = dialog.querySelector('textarea');
  const likeButtons: NodeListOf<HTMLButtonElement> = dialog.querySelectorAll(
    '[data-comment-like]',
  );

  let returnFocusElement: HTMLElement | null = null;
  let closeTimer: number | undefined;
  let openAnimationFrame: number | undefined;

  const resetTransientState = (): void => {
    if (favoriteButton !== null && favoriteLabel !== null) {
      favoriteButton.ariaPressed = 'false';
      favoriteButton.classList.remove('game-info__favorite--active');
      favoriteButton.setAttribute(
        'aria-label',
        'Add Tukoni: Forest Keepers to favorites',
      );
      favoriteLabel.textContent = 'Add to Favorites';
    }

    for (const likeButton of likeButtons) {
      likeButton.ariaPressed = 'false';
      likeButton.classList.remove('game-comment__like--active');
      const count: HTMLElement | null =
        likeButton.querySelector('[data-like-count]');
      if (count !== null) {
        count.textContent = likeButton.dataset.defaultLikes ?? '0';
      }
    }

    if (textarea === null) {
      return;
    }

    textarea.value = '';
    textarea.style.removeProperty('height');
    textarea.style.removeProperty('overflow-y');
  };

  const finishClose = (): void => {
    closeTimer = undefined;
    if (!dialog.open) {
      return;
    }

    dialog.close();
    dialog.classList.remove('game-details-dialog--closing');
    document.body.classList.remove('dialog-open');
    returnFocusElement?.focus();
    returnFocusElement = null;
  };

  const closeDialog = (): void => {
    if (
      !dialog.open ||
      dialog.classList.contains('game-details-dialog--closing')
    ) {
      return;
    }

    dialog.classList.add('game-details-dialog--closing');
    dialog.classList.remove('game-details-dialog--visible');
    closeTimer = globalThis.setTimeout(
      finishClose,
      DIALOG_TRANSITION_DURATION_MS,
    );
  };

  const openDialog = (): void => {
    if (closeTimer !== undefined) {
      globalThis.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
    if (openAnimationFrame !== undefined) {
      globalThis.cancelAnimationFrame(openAnimationFrame);
      openAnimationFrame = undefined;
    }

    resetTransientState();
    dialog.scrollTop = 0;

    if (dialog.open) {
      dialog.classList.remove('game-details-dialog--closing');
      openAnimationFrame = globalThis.requestAnimationFrame((): void => {
        dialog.classList.add('game-details-dialog--visible');
        openAnimationFrame = undefined;
      });
      return;
    }

    returnFocusElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    document.body.classList.add('dialog-open');
    openAnimationFrame = globalThis.requestAnimationFrame((): void => {
      dialog.classList.add('game-details-dialog--visible');
      openAnimationFrame = undefined;
    });
  };

  const toggleFavorite = (): void => {
    if (favoriteButton === null || favoriteLabel === null) {
      return;
    }

    const isActive: boolean = favoriteButton.ariaPressed !== 'true';
    favoriteButton.ariaPressed = String(isActive);
    favoriteButton.classList.toggle('game-info__favorite--active', isActive);
    favoriteButton.setAttribute(
      'aria-label',
      isActive
        ? 'Remove Tukoni: Forest Keepers from favorites'
        : 'Add Tukoni: Forest Keepers to favorites',
    );
    favoriteLabel.textContent = isActive
      ? 'Remove from Favorites'
      : 'Add to Favorites';
  };

  dialog.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (event.target.closest('[data-dialog-close]') !== null) {
        closeDialog();
        return;
      }

      if (event.target.closest('[data-favorite]') !== null) {
        toggleFavorite();
        return;
      }

      const likeButton: HTMLButtonElement | null = event.target.closest(
        'button[data-comment-like]',
      );
      if (likeButton !== null) {
        toggleCommentLike(likeButton);
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
    },
    { signal },
  );

  dialog.addEventListener(
    'cancel',
    (event: Event): void => {
      event.preventDefault();
      closeDialog();
    },
    { signal },
  );

  dialog.querySelector('form')?.addEventListener(
    'submit',
    (event: SubmitEvent): void => {
      event.preventDefault();
    },
    { signal },
  );

  textarea?.addEventListener(
    'input',
    (): void => {
      textarea.style.height = 'auto';
      const nextHeight: number = Math.min(
        textarea.scrollHeight,
        COMMENT_TEXTAREA_MAX_HEIGHT_PX,
      );
      textarea.style.height = `${nextHeight}px`;
      textarea.style.overflowY =
        textarea.scrollHeight > COMMENT_TEXTAREA_MAX_HEIGHT_PX
          ? 'auto'
          : 'hidden';
    },
    { signal },
  );

  document.addEventListener(GAME_DETAILS_OPEN_EVENT, openDialog, { signal });

  return {
    destroy: (): void => {
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
        'game-details-dialog--closing',
        'game-details-dialog--visible',
      );
      document.body.classList.remove('dialog-open');
      returnFocusElement = null;
    },
    element: dialog,
  };
};
