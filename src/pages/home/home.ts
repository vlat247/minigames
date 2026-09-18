import { createHeader } from '../../components/header/header';
import { createHeroSection } from '../../components/hero/hero';
import { createNewGamesSection } from '../../features/new-games/new-games';

export const homePage = (): HTMLElement => {
  const page: HTMLDivElement = document.createElement('div');
  page.className = 'home-page';

  const main: HTMLElement = document.createElement('main');
  main.id = 'main-content';
  main.append(createHeroSection(), createNewGamesSection());

  page.append(createHeader(), main);

  return page;
};
