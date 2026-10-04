import { createEmptyState } from '../async-state/async-state';
import type {
  CommentsResponse,
  GameComment,
  GameDetails,
  GameRecord,
  GameSpecs,
} from '../../types/api';
import { getAppPath } from '../../utils/paths';
import { formatRelativeTime } from '../../utils/relative-time';

export const GAME_DETAILS_TITLE_ID: string = 'game-details-title';

const heartIconPath: string = getAppPath('/assets/icons/heart.png');
const starIconPath: string = getAppPath('/assets/icons/star.png');
const likesFormatter: Intl.NumberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact',
});
const scoreFormatter: Intl.NumberFormat = new Intl.NumberFormat('en-US');
const recordMedals: readonly string[] = ['🥇', '🥈', '🥉'];
const avatarModifiers: readonly string[] = ['blue', 'yellow', 'pink'];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isGameSpecs = (value: unknown): value is GameSpecs => {
  return (
    isRecord(value) &&
    isNonEmptyString(value.duration) &&
    isNonEmptyString(value.genre) &&
    isNonEmptyString(value.players) &&
    isNonEmptyString(value.price)
  );
};

const isGameRecord = (value: unknown): value is GameRecord => {
  return (
    isRecord(value) &&
    isNonEmptyString(value.achievedAt) &&
    isNonEmptyString(value.playerName) &&
    isFiniteNumber(value.position) &&
    isFiniteNumber(value.score)
  );
};

export const isGameDetailsPayload = (value: unknown): value is GameDetails => {
  return (
    isRecord(value) &&
    isNonEmptyString(value.fullDescription) &&
    isNonEmptyString(value.heroImage) &&
    typeof value.isLikedByCurrentUser === 'boolean' &&
    isFiniteNumber(value.likesCount) &&
    isNonEmptyString(value.name) &&
    isFiniteNumber(value.rating) &&
    isNonEmptyString(value.slug) &&
    isGameSpecs(value.specs) &&
    Array.isArray(value.topRecords) &&
    value.topRecords.every((record: unknown): boolean => isGameRecord(record))
  );
};

const isGameComment = (value: unknown): value is GameComment => {
  return (
    isRecord(value) &&
    typeof value.authorName === 'string' &&
    isNonEmptyString(value.commentId) &&
    isNonEmptyString(value.createdAt) &&
    typeof value.isLikedByCurrentUser === 'boolean' &&
    isFiniteNumber(value.likesCount) &&
    typeof value.text === 'string'
  );
};

export const isCommentsResponsePayload = (
  value: unknown,
): value is CommentsResponse => {
  return !isRecord(value) || !Array.isArray(value.data) || !isRecord(value.meta)
    ? false
    : value.data.every((comment: unknown): boolean => isGameComment(comment)) &&
        isFiniteNumber(value.meta.returnedCount) &&
        isFiniteNumber(value.meta.totalComments);
};

const createIcon = (path: string, className: string): HTMLImageElement => {
  const icon: HTMLImageElement = document.createElement('img');
  icon.className = className;
  icon.src = path;
  icon.alt = '';
  icon.ariaHidden = 'true';
  return icon;
};

const createStat = (
  className: string,
  iconPath: string,
  label: string,
  value: string,
): HTMLSpanElement => {
  const stat: HTMLSpanElement = document.createElement('span');
  stat.className = className;
  stat.setAttribute('role', 'img');
  stat.setAttribute('aria-label', label);
  stat.append(
    createIcon(iconPath, 'game-info__stat-icon'),
    document.createTextNode(value),
  );
  return stat;
};

const createSpec = (label: string, value: string): HTMLDivElement => {
  const item: HTMLDivElement = document.createElement('div');
  const term: HTMLElement = document.createElement('dt');
  const description: HTMLElement = document.createElement('dd');
  term.textContent = label;
  description.textContent = value;
  item.append(term, description);
  return item;
};

const createRecordItem = (
  record: GameRecord,
  nowInMilliseconds: number,
): HTMLLIElement => {
  const item: HTMLLIElement = document.createElement('li');
  const position: HTMLSpanElement = document.createElement('span');
  const player: HTMLElement = document.createElement('strong');
  const score: HTMLSpanElement = document.createElement('span');
  const achievedAt: HTMLTimeElement = document.createElement('time');
  const normalizedPosition: number = Math.max(1, Math.trunc(record.position));

  item.className = 'game-records__item';
  position.className = 'game-records__medal';
  position.textContent =
    recordMedals[normalizedPosition - 1] ?? `#${normalizedPosition}`;
  position.setAttribute('aria-label', `Position ${normalizedPosition}`);
  player.textContent = record.playerName;
  score.className = 'game-records__score';
  score.textContent = `${scoreFormatter.format(record.score)} pts`;
  achievedAt.className = 'game-records__time';
  achievedAt.dateTime = record.achievedAt;
  achievedAt.textContent = formatRelativeTime(
    record.achievedAt,
    nowInMilliseconds,
  );
  item.append(position, player, score, achievedAt);
  return item;
};

const createRecordsSection = (
  records: readonly GameRecord[],
  nowInMilliseconds: number,
): HTMLElement => {
  const section: HTMLElement = document.createElement('section');
  const title: HTMLHeadingElement = document.createElement('h3');
  const icon: HTMLSpanElement = document.createElement('span');
  section.className = 'game-records';
  section.setAttribute('aria-labelledby', 'game-records-title');
  title.id = 'game-records-title';
  icon.ariaHidden = 'true';
  icon.textContent = '🏆';
  title.append(icon, document.createTextNode(' Top Records'));
  section.append(title);

  if (records.length === 0) {
    section.append(
      createEmptyState({
        message: 'No player records have been posted for this game yet.',
        title: 'No records yet',
      }),
    );
    return section;
  }

  const list: HTMLOListElement = document.createElement('ol');
  list.append(
    ...records.map((record: GameRecord): HTMLLIElement =>
      createRecordItem(record, nowInMilliseconds),
    ),
  );
  section.append(list);
  return section;
};

export const createGameDetailsFragment = (
  game: GameDetails,
): DocumentFragment => {
  const fragment: DocumentFragment = document.createDocumentFragment();
  const hero: HTMLDivElement = document.createElement('div');
  const heroImage: HTMLImageElement = document.createElement('img');
  const content: HTMLDivElement = document.createElement('div');
  const info: HTMLElement = document.createElement('section');
  const heading: HTMLDivElement = document.createElement('div');
  const title: HTMLHeadingElement = document.createElement('h2');
  const stats: HTMLDivElement = document.createElement('div');
  const description: HTMLParagraphElement = document.createElement('p');
  const specs: HTMLDListElement = document.createElement('dl');
  const actions: HTMLDivElement = document.createElement('div');
  const playButton: HTMLButtonElement = document.createElement('button');
  const favoriteButton: HTMLButtonElement = document.createElement('button');
  const favoriteLabel: HTMLSpanElement = document.createElement('span');
  const displayRating: string = game.rating.toFixed(1);
  const displayLikes: string = likesFormatter.format(game.likesCount);
  const favoriteAction: string = game.isLikedByCurrentUser ? 'Remove' : 'Add';
  const nowInMilliseconds: number = Date.now();

  hero.className = 'game-details-dialog__hero';
  heroImage.src = getAppPath(game.heroImage);
  heroImage.alt = `${game.name} game artwork`;
  heroImage.decoding = 'async';
  hero.append(heroImage);

  content.className = 'game-details-dialog__content';
  info.className = 'game-info';
  info.setAttribute('aria-labelledby', GAME_DETAILS_TITLE_ID);
  heading.className = 'game-info__heading';
  title.id = GAME_DETAILS_TITLE_ID;
  title.textContent = game.name;
  stats.className = 'game-info__stats';
  stats.setAttribute('role', 'group');
  stats.setAttribute('aria-label', 'Game rating and likes');
  stats.append(
    createStat(
      'game-info__rating',
      starIconPath,
      `Rated ${displayRating} out of 5`,
      displayRating,
    ),
    createStat(
      'game-info__likes',
      heartIconPath,
      `${displayLikes} likes`,
      displayLikes,
    ),
  );
  heading.append(title, stats);

  description.className = 'game-info__description';
  description.textContent = game.fullDescription;
  specs.className = 'game-specs';
  specs.append(
    createSpec('Genre', game.specs.genre),
    createSpec('Players', game.specs.players),
    createSpec('Duration', game.specs.duration),
    createSpec('Price', game.specs.price),
  );

  actions.className = 'game-info__actions';
  playButton.className = 'btn btn--primary game-info__play';
  playButton.type = 'button';
  playButton.textContent = 'Play Now';
  favoriteButton.className = 'btn btn--secondary game-info__favorite';
  favoriteButton.classList.toggle(
    'game-info__favorite--active',
    game.isLikedByCurrentUser,
  );
  favoriteButton.type = 'button';
  favoriteButton.disabled = true;
  favoriteButton.ariaPressed = String(game.isLikedByCurrentUser);
  favoriteButton.setAttribute(
    'aria-label',
    `${favoriteAction} ${game.name} ${favoriteAction === 'Add' ? 'to' : 'from'} favorites. Sign in to change favorites.`,
  );
  favoriteButton.title = 'Sign in to manage favorites';
  favoriteLabel.dataset.favoriteLabel = '';
  favoriteLabel.textContent = `${favoriteAction} ${favoriteAction === 'Add' ? 'to' : 'from'} Favorites`;
  favoriteButton.append(
    createIcon(heartIconPath, 'game-info__favorite-icon'),
    favoriteLabel,
  );
  actions.append(playButton, favoriteButton);

  info.append(heading, description, specs, actions);
  content.append(
    info,
    createRecordsSection(game.topRecords, nowInMilliseconds),
  );
  fragment.append(hero, content);
  return fragment;
};

const createComment = (
  comment: GameComment,
  index: number,
  nowInMilliseconds: number,
): HTMLElement => {
  const article: HTMLElement = document.createElement('article');
  const header: HTMLElement = document.createElement('header');
  const avatar: HTMLSpanElement = document.createElement('span');
  const author: HTMLHeadingElement = document.createElement('h4');
  const createdAt: HTMLTimeElement = document.createElement('time');
  const text: HTMLParagraphElement = document.createElement('p');
  const likes: HTMLSpanElement = document.createElement('span');
  const likesCount: HTMLSpanElement = document.createElement('span');
  const normalizedLikes: number = Math.max(0, Math.trunc(comment.likesCount));
  const displayLikes: string = scoreFormatter.format(normalizedLikes);
  const authorName: string = comment.authorName.trim() || 'Anonymous player';
  const avatarModifier: string =
    avatarModifiers[index % avatarModifiers.length] ?? 'yellow';

  article.className = 'game-comment';
  article.dataset.commentId = comment.commentId;
  header.className = 'game-comment__header';
  avatar.className = `game-avatar game-avatar--${avatarModifier}`;
  avatar.ariaHidden = 'true';
  avatar.textContent = authorName.charAt(0).toUpperCase();
  author.className = 'game-comment__author';
  author.textContent = authorName;
  createdAt.dateTime = comment.createdAt;
  createdAt.textContent = formatRelativeTime(
    comment.createdAt,
    nowInMilliseconds,
  );
  header.append(avatar, author, createdAt);

  text.textContent = comment.text;
  likes.className = 'game-comment__like';
  likes.setAttribute(
    'aria-label',
    `${displayLikes} ${normalizedLikes === 1 ? 'like' : 'likes'}`,
  );
  likesCount.textContent = displayLikes;
  likes.append(
    createIcon(heartIconPath, 'game-comment__like-icon'),
    likesCount,
  );
  article.append(header, text, likes);
  return article;
};

export const createCommentElements = (
  comments: readonly GameComment[],
): readonly HTMLElement[] => {
  const nowInMilliseconds: number = Date.now();
  return comments.map((comment: GameComment, index: number): HTMLElement =>
    createComment(comment, index, nowInMilliseconds),
  );
};
