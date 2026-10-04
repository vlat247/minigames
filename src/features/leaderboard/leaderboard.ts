import {
  createBlockErrorState,
  createEmptyState,
  createSkeletonState,
} from '../../components/async-state/async-state';
import { createSectionHeading } from '../../components/section-heading/section-heading';
import { dispatchSnackbar } from '../../components/snackbar/snackbar-events';
import { isApiAbortError } from '../../services/api-client';
import { fetchLeaderboard } from '../../services/minigames-api';
import type { LeaderboardEntry } from '../../types/api';
import './leaderboard.scss';

const LEADERBOARD_ERROR_MESSAGE: string =
  'The leaderboard is unavailable right now. Please try again.';
const LEADERBOARD_SKELETON_ROWS: number = 5;

const avatarClassNames: readonly string[] = [
  'leaderboard__avatar--yellow',
  'leaderboard__avatar--green',
  'leaderboard__avatar--blue',
  'leaderboard__avatar--pink',
  'leaderboard__avatar--lavender',
];

const scoreFormatter: Intl.NumberFormat = new Intl.NumberFormat('en-US');

export interface LeaderboardSectionController {
  readonly destroy: () => void;
  readonly element: HTMLElement;
}

interface LeaderboardColumn {
  readonly className?: string;
  readonly detail?: string;
  readonly label: string;
}

const leaderboardColumns: readonly LeaderboardColumn[] = [
  { label: 'Rank' },
  { label: 'Player' },
  {
    className: 'leaderboard__games',
    detail: ' Played',
    label: 'Games',
  },
  { detail: 'Total ', label: 'Score' },
  { label: 'Streak' },
  { className: 'leaderboard__favorite', label: 'Favorite Game' },
];

const createColumn = (className: string): HTMLTableColElement => {
  const column: HTMLTableColElement = document.createElement('col');
  column.className = className;
  return column;
};

const createTableHeader = (): HTMLTableSectionElement => {
  const head: HTMLTableSectionElement = document.createElement('thead');
  const row: HTMLTableRowElement = document.createElement('tr');

  for (const column of leaderboardColumns) {
    const header: HTMLTableCellElement = document.createElement('th');
    header.scope = 'col';

    if (column.className !== undefined) {
      header.className = column.className;
    }

    if (column.detail === undefined) {
      header.textContent = column.label;
    } else if (column.detail.startsWith(' ')) {
      header.append(column.label);
      const detail: HTMLSpanElement = document.createElement('span');
      detail.className = 'leaderboard__header-detail';
      detail.textContent = column.detail;
      header.append(detail);
    } else {
      const detail: HTMLSpanElement = document.createElement('span');
      detail.className = 'leaderboard__header-detail';
      detail.textContent = column.detail;
      header.append(detail, column.label);
    }

    row.append(header);
  }

  head.append(row);
  return head;
};

const getPlayerInitials = (playerName: string): string => {
  const nameParts: readonly string[] = playerName
    .trim()
    .split(/[\s_-]+/u)
    .filter((part: string): boolean => part.length > 0);

  return nameParts.length > 1
    ? nameParts
        .slice(0, 2)
        .map((part: string): string => [...part][0] ?? '')
        .join('')
        .toUpperCase()
    : [...(nameParts[0] ?? '?')].slice(0, 2).join('').toUpperCase();
};

const createTextCell = (
  className: string,
  text: string,
): HTMLTableCellElement => {
  const cell: HTMLTableCellElement = document.createElement('td');
  cell.className = className;
  cell.textContent = text;
  return cell;
};

const createPlayerCell = (
  entry: LeaderboardEntry,
  index: number,
): HTMLTableCellElement => {
  const cell: HTMLTableCellElement = document.createElement('td');
  const content: HTMLSpanElement = document.createElement('span');
  const avatar: HTMLSpanElement = document.createElement('span');
  const name: HTMLSpanElement = document.createElement('span');
  const avatarClassName: string =
    avatarClassNames[index % avatarClassNames.length] ??
    'leaderboard__avatar--yellow';

  cell.className = 'leaderboard__player';
  content.className = 'leaderboard__player-content';
  avatar.className = `leaderboard__avatar ${avatarClassName}`;
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = getPlayerInitials(entry.playerName);
  name.className = 'leaderboard__player-name';
  name.textContent = entry.playerName;
  content.append(avatar, name);
  cell.append(content);

  return cell;
};

const createStreakCell = (streakDays: number): HTMLTableCellElement => {
  const cell: HTMLTableCellElement = document.createElement('td');
  const icon: HTMLSpanElement = document.createElement('span');
  const dayLabel: string = streakDays === 1 ? 'day' : 'days';
  cell.className = 'leaderboard__streak';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '🔥';
  cell.append(icon, ` ${streakDays} ${dayLabel}`);
  return cell;
};

const createFavoriteCell = (favoriteGameName: string): HTMLTableCellElement => {
  const cell: HTMLTableCellElement = document.createElement('td');
  const label: HTMLSpanElement = document.createElement('span');
  cell.className = 'leaderboard__favorite';
  label.textContent = favoriteGameName;
  cell.append(label);
  return cell;
};

const createLeaderboardRow = (
  entry: LeaderboardEntry,
  index: number,
): HTMLTableRowElement => {
  const row: HTMLTableRowElement = document.createElement('tr');
  row.append(
    createTextCell('leaderboard__rank', `#${entry.rank}`),
    createPlayerCell(entry, index),
    createTextCell('leaderboard__games', String(entry.gamesPlayed)),
    createTextCell(
      'leaderboard__score',
      scoreFormatter.format(entry.totalScore),
    ),
    createStreakCell(entry.streakDays),
    createFavoriteCell(entry.favoriteGameName),
  );
  return row;
};

const createLeaderboardTable = (
  entries: readonly LeaderboardEntry[],
): HTMLDivElement => {
  const tableWrapper: HTMLDivElement = document.createElement('div');
  const table: HTMLTableElement = document.createElement('table');
  const caption: HTMLTableCaptionElement = document.createElement('caption');
  const columnGroup: HTMLTableColElement = document.createElement('colgroup');
  const body: HTMLTableSectionElement = document.createElement('tbody');

  tableWrapper.className = 'leaderboard__table-wrapper';
  table.className = 'leaderboard__table';
  caption.className = 'leaderboard__caption';
  caption.textContent = 'Weekly MiniGames leaderboard';
  columnGroup.append(
    createColumn('leaderboard__column-rank'),
    createColumn('leaderboard__column-player'),
    createColumn('leaderboard__column-games'),
    createColumn('leaderboard__column-score'),
    createColumn('leaderboard__column-streak'),
    createColumn('leaderboard__column-favorite'),
  );

  for (const [index, entry] of entries.entries()) {
    body.append(createLeaderboardRow(entry, index));
  }

  table.append(caption, columnGroup, createTableHeader(), body);
  tableWrapper.append(table);
  return tableWrapper;
};

export const createLeaderboardSection = (): LeaderboardSectionController => {
  const section: HTMLElement = document.createElement('section');
  const content: HTMLDivElement = document.createElement('div');
  let activeRequest: AbortController | undefined;
  let isDestroyed: boolean = false;
  let requestVersion: number = 0;

  section.className = 'leaderboard';
  section.setAttribute('aria-labelledby', 'leaderboard-title');
  content.className = 'leaderboard__content';
  section.append(
    createSectionHeading({
      compactTitle: 'Top Players',
      id: 'leaderboard-title',
      title: 'Top Players This Week',
    }),
    content,
  );

  const renderLoadingState = (): void => {
    content.replaceChildren(
      createSkeletonState({
        itemCount: LEADERBOARD_SKELETON_ROWS,
        label: 'Loading weekly leaderboard',
        variant: 'rows',
      }),
    );
  };

  const loadLeaderboard = async (): Promise<void> => {
    activeRequest?.abort();
    const request: AbortController = new AbortController();
    const currentVersion: number = requestVersion + 1;
    activeRequest = request;
    requestVersion = currentVersion;
    renderLoadingState();

    try {
      const response = await fetchLeaderboard({ signal: request.signal });

      if (
        currentVersion !== requestVersion ||
        isDestroyed ||
        request.signal.aborted
      ) {
        return;
      }

      content.replaceChildren(
        response.data.length === 0
          ? createEmptyState({
              message: "Check back later for this week's player rankings.",
              title: 'No leaderboard results yet',
            })
          : createLeaderboardTable(response.data),
      );
    } catch (error: unknown) {
      if (
        currentVersion !== requestVersion ||
        isDestroyed ||
        request.signal.aborted ||
        isApiAbortError(error)
      ) {
        return;
      }

      content.replaceChildren(
        createBlockErrorState({
          message: LEADERBOARD_ERROR_MESSAGE,
          onRetry: (): void => {
            void loadLeaderboard();
          },
          title: 'Unable to load the leaderboard',
        }),
      );
      dispatchSnackbar({
        message: LEADERBOARD_ERROR_MESSAGE,
        variant: 'error',
      });
    } finally {
      if (activeRequest === request) {
        activeRequest = undefined;
      }
    }
  };

  void loadLeaderboard();

  return {
    destroy: (): void => {
      isDestroyed = true;
      requestVersion += 1;
      activeRequest?.abort();
      activeRequest = undefined;
    },
    element: section,
  };
};
