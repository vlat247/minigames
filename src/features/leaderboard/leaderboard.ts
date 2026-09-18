import { createSectionHeading } from '../../components/section-heading/section-heading';
import './leaderboard.scss';

interface LeaderboardEntry {
  avatarClass: string;
  favoriteGame: string;
  gamesPlayed: number;
  initials: string;
  playerName: string;
  rank: number;
  score: number;
  streakDays: number;
}

const leaderboardEntries: LeaderboardEntry[] = [
  {
    avatarClass: 'leaderboard__avatar--yellow',
    favoriteGame: 'Heartopia',
    gamesPlayed: 142,
    initials: 'AP',
    playerName: 'Alex_Pro99',
    rank: 1,
    score: 94_250,
    streakDays: 12,
  },
  {
    avatarClass: 'leaderboard__avatar--green',
    favoriteGame: 'Cat Mail Co.',
    gamesPlayed: 118,
    initials: 'CG',
    playerName: 'CozyGamer_x',
    rank: 2,
    score: 81_400,
    streakDays: 8,
  },
  {
    avatarClass: 'leaderboard__avatar--blue',
    favoriteGame: 'Tiny Glade',
    gamesPlayed: 98,
    initials: 'MM',
    playerName: 'MatchMaster',
    rank: 3,
    score: 72_110,
    streakDays: 5,
  },
  {
    avatarClass: 'leaderboard__avatar--pink',
    favoriteGame: 'Whisper of the House',
    gamesPlayed: 87,
    initials: 'BP',
    playerName: 'BubblePop',
    rank: 4,
    score: 65_900,
    streakDays: 3,
  },
  {
    avatarClass: 'leaderboard__avatar--lavender',
    favoriteGame: 'Cat Chess',
    gamesPlayed: 74,
    initials: 'SG',
    playerName: 'SudokuGod',
    rank: 5,
    score: 59_320,
    streakDays: 2,
  },
];

const scoreFormatter: Intl.NumberFormat = new Intl.NumberFormat('en-US');

const createLeaderboardRow = (entry: LeaderboardEntry): string => `
  <tr>
    <td class="leaderboard__rank">#${entry.rank}</td>
    <td class="leaderboard__player">
      <span class="leaderboard__player-content">
        <span class="leaderboard__avatar ${entry.avatarClass}" aria-hidden="true">${entry.initials}</span>
        <span class="leaderboard__player-name">${entry.playerName}</span>
      </span>
    </td>
    <td class="leaderboard__games">${entry.gamesPlayed}</td>
    <td class="leaderboard__score">${scoreFormatter.format(entry.score)}</td>
    <td class="leaderboard__streak"><span aria-hidden="true">🔥</span> ${entry.streakDays} days</td>
    <td class="leaderboard__favorite"><span>${entry.favoriteGame}</span></td>
  </tr>
`;

export const createLeaderboardSection = (): HTMLElement => {
  const section: HTMLElement = document.createElement('section');
  section.className = 'leaderboard';
  section.setAttribute('aria-labelledby', 'leaderboard-title');
  section.append(
    createSectionHeading({
      compactTitle: 'Top Players',
      id: 'leaderboard-title',
      title: 'Top Players This Week',
    }),
  );

  const tableWrapper: HTMLDivElement = document.createElement('div');
  tableWrapper.className = 'leaderboard__table-wrapper';
  tableWrapper.innerHTML = `
    <table class="leaderboard__table">
      <caption class="leaderboard__caption">Weekly MiniGames leaderboard</caption>
      <colgroup>
        <col class="leaderboard__column-rank" />
        <col class="leaderboard__column-player" />
        <col class="leaderboard__column-games" />
        <col class="leaderboard__column-score" />
        <col class="leaderboard__column-streak" />
        <col class="leaderboard__column-favorite" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Player</th>
          <th class="leaderboard__games" scope="col">Games<span class="leaderboard__header-detail"> Played</span></th>
          <th scope="col"><span class="leaderboard__header-detail">Total </span>Score</th>
          <th scope="col">Streak</th>
          <th class="leaderboard__favorite" scope="col">Favorite Game</th>
        </tr>
      </thead>
      <tbody>
        ${leaderboardEntries
          .map((entry: LeaderboardEntry): string => createLeaderboardRow(entry))
          .join('')}
      </tbody>
    </table>
  `;

  section.append(tableWrapper);

  return section;
};
