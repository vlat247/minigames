import { afterEach, describe, expect, it } from 'vitest';

import {
  Router,
  type NavigationType,
  type RouteContext,
  type RouteView,
} from './router';

const activeRouters: Router[] = [];

const createView = (
  label: string,
  events?: string[],
): ((context: RouteContext) => RouteView) => {
  return (context: RouteContext): RouteView => {
    events?.push(
      `view:${context.navigationType}:${globalThis.location.pathname}`,
    );

    const content: HTMLElement = document.createElement('main');
    content.textContent = label;

    return { content };
  };
};

afterEach(() => {
  for (const router of activeRouters) {
    router.stop();
  }

  activeRouters.length = 0;
});

describe('Router navigation checkpoint', () => {
  it('runs once before initial, push, replace, and pop route processing', () => {
    const events: string[] = [];
    const navigationTypes: NavigationType[] = [];
    const outlet: HTMLElement = document.createElement('div');
    document.body.append(outlet);

    const router = new Router(
      outlet,
      (path: string): void => {
        events.push(`route-change:${path}`);
      },
      {
        beforeNavigation: (navigationType: NavigationType): void => {
          navigationTypes.push(navigationType);
          events.push(
            `before:${navigationType}:${globalThis.location.pathname}`,
          );
        },
      },
    );
    activeRouters.push(router);

    router.addRoute('/', createView('Home', events));
    router.addRoute('/library', createView('Library', events));
    router.addRoute('/about', createView('About', events));
    router.subscribe((context: RouteContext): void => {
      events.push(`subscriber:${context.navigationType}`);
    });

    router.start();

    expect(events).toEqual([
      'before:initial:/',
      'view:initial:/',
      'route-change:/',
      'subscriber:initial',
    ]);
    expect(outlet.textContent).toBe('Home');

    events.length = 0;
    router.navigate('/library', { historyState: { source: 'push' } });

    expect(events).toEqual([
      'before:push:/',
      'view:push:/library',
      'route-change:/library',
      'subscriber:push',
    ]);
    expect(globalThis.history.state).toEqual({ source: 'push' });
    expect(outlet.textContent).toBe('Library');

    events.length = 0;
    router.replace('/about', { source: 'replace' });

    expect(events).toEqual([
      'before:replace:/library',
      'view:replace:/about',
      'route-change:/about',
      'subscriber:replace',
    ]);
    expect(globalThis.history.state).toEqual({ source: 'replace' });
    expect(outlet.textContent).toBe('About');

    globalThis.history.replaceState({ source: 'pop' }, '', '/');
    events.length = 0;
    globalThis.dispatchEvent(new PopStateEvent('popstate'));

    expect(events).toEqual([
      'before:pop:/',
      'view:pop:/',
      'route-change:/',
      'subscriber:pop',
    ]);
    expect(router.getContext()?.historyState).toEqual({ source: 'pop' });
    expect(outlet.textContent).toBe('Home');
    expect(navigationTypes).toEqual(['initial', 'push', 'replace', 'pop']);
  });

  it('keeps the existing constructor and navigation behavior', () => {
    const outlet: HTMLElement = document.createElement('div');
    document.body.append(outlet);

    const router = new Router(outlet);
    activeRouters.push(router);
    router.addRoute('/', createView('Home'));
    router.addRoute('/library', createView('Library'));

    router.start();
    router.navigate('/library');

    expect(globalThis.location.pathname).toBe('/library');
    expect(router.getContext()?.navigationType).toBe('push');
    expect(outlet.textContent).toBe('Library');
  });
});
