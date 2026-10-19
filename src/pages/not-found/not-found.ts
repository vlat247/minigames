import type { RouteView } from '../../app/router';
import { getAppPath } from '../../utils/paths';
import './not-found.scss';

export const notFoundPage = (): RouteView => {
  const content: HTMLElement = document.createElement('section');
  content.className = 'not-found-page';
  content.setAttribute('aria-labelledby', 'not-found-title');
  content.innerHTML = `
    <div class="not-found-page__content">
      <p class="not-found-page__code" aria-hidden="true">404</p>
      <h1 id="not-found-title">Page not found</h1>
      <p>The requested address does not exist or may have moved.</p>
      <a class="btn btn--primary" href="${getAppPath('/')}" data-link>Return to Home Page</a>
    </div>
  `;

  return { content };
};
