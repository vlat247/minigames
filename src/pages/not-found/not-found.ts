import type { RouteView } from '../../app/router';
import { getAppPath } from '../../utils/paths';

export const notFoundPage = (): RouteView => {
  const content: HTMLDivElement = document.createElement('div');
  content.className = 'not-found-page';
  content.innerHTML = `
    <h1>404 - Not Found</h1>
    <p>The page you are looking for does not exist.</p>
    <a href="${getAppPath('/')}" data-link>Return Home</a>
  `;

  return { content };
};
