import { createSectionHeading } from '../../components/section-heading/section-heading';
import { getAppPath } from '../../utils/paths';
import { featuredGames, type FeaturedGame } from './new-games-data';
import './new-games.scss';

const createCarouselControls = (): HTMLElement => {
  const controls: HTMLDivElement = document.createElement('div');
  controls.className = 'new-games__controls';
  controls.innerHTML = `
    <button class="new-games__arrow" type="button" aria-label="Previous games">←</button>
    <button class="new-games__arrow" type="button" aria-label="Next games">→</button>
  `;

  return controls;
};

const createGameCard = (game: FeaturedGame, index: number): HTMLElement => {
  const card: HTMLElement = document.createElement('article');
  card.className = `game-card game-card--${index + 1}`;
  card.innerHTML = `
    <img class="game-card__image" src="${getAppPath(game.image)}" alt="${game.name}" />
    <div class="game-card__info">
      <h3 class="game-card__title" title="${game.name}">${game.name}</h3>
      <div class="game-card__meta">
        <span role="img" aria-label="Rated ${game.rating} out of 5"><span aria-hidden="true">★</span> ${game.rating}</span>
        <span role="img" aria-label="${game.likes} likes"><span aria-hidden="true">♥</span> ${game.likes}</span>
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
  track.setAttribute('role', 'group');
  track.setAttribute('aria-label', 'New games preview');
  track.append(
    ...featuredGames
      .slice(0, 5)
      .map((game: FeaturedGame, index: number): HTMLElement =>
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
