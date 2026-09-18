import { createSectionHeading } from '../../components/section-heading/section-heading';
import './new-games.scss';

interface GameCardData {
  image: string;
  likes: string;
  name: string;
  rating: number;
}

const games: GameCardData[] = [
  {
    image: '/assets/images/games/cat-mail-co-card.jpg',
    likes: '38.2K',
    name: 'Cat Mail Co.',
    rating: 4.9,
  },
  {
    image: '/assets/images/games/islanders-new-shores-card.jpg',
    likes: '54.2K',
    name: 'ISLANDERS: New Shores',
    rating: 4.9,
  },
  {
    image: '/assets/images/games/vacation-cafe-simulator-card.jpg',
    likes: '28.8K',
    name: 'Vacation Cafe Simulator',
    rating: 4.8,
  },
  {
    image: '/assets/images/games/winter-burrow-card.jpg',
    likes: '32.4K',
    name: 'Winter Burrow',
    rating: 4.9,
  },
  {
    image: '/assets/images/games/heartopia-card.jpg',
    likes: '46.8K',
    name: 'Heartopia',
    rating: 4.6,
  },
];

const createCarouselControls = (): HTMLElement => {
  const controls: HTMLDivElement = document.createElement('div');
  controls.className = 'new-games__controls';
  controls.innerHTML = `
    <button class="new-games__arrow" type="button" aria-label="Previous games">←</button>
    <button class="new-games__arrow" type="button" aria-label="Next games">→</button>
  `;

  return controls;
};

const createGameCard = (game: GameCardData, index: number): HTMLElement => {
  const card: HTMLElement = document.createElement('article');
  card.className = `game-card game-card--${index + 1}`;
  card.innerHTML = `
    <img class="game-card__image" src="${game.image}" alt="${game.name}" />
    <div class="game-card__info">
      <h3 class="game-card__title" title="${game.name}">${game.name}</h3>
      <div class="game-card__meta">
        <span aria-label="Rated ${game.rating} out of 5"><span aria-hidden="true">★</span> ${game.rating}</span>
        <span aria-label="${game.likes} likes"><span aria-hidden="true">♥</span> ${game.likes}</span>
      </div>
    </div>
  `;

  return card;
};

export const createNewGamesSection = (): HTMLElement => {
  const section: HTMLElement = document.createElement('section');
  section.className = 'new-games';
  section.setAttribute('aria-labelledby', 'new-games-title');

  const track: HTMLDivElement = document.createElement('div');
  track.className = 'new-games__track';
  track.setAttribute('aria-label', 'New games preview');
  track.append(
    ...games.map((game: GameCardData, index: number): HTMLElement =>
      createGameCard(game, index),
    ),
  );

  section.append(
    createSectionHeading({
      controls: createCarouselControls(),
      id: 'new-games-title',
      title: 'New Games',
    }),
    track,
  );

  return section;
};
