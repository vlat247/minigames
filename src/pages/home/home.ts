import { createHeader } from '../../components/header/header';

export const homePage = (): HTMLElement => {
  const page: HTMLDivElement = document.createElement('div');
  page.className = 'home-page';

  const main: HTMLElement = document.createElement('main');
  main.id = 'main-content';

  page.append(createHeader(), main);

  return page;
};
