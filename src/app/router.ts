import { getAppPath, getRoutePath } from '../utils/paths';
import { normalizeUrlState, parseUrlState, type UrlState } from './url-state';

export type NavigationType = 'initial' | 'pop' | 'push' | 'replace';

export interface RouteContext {
  readonly historyState: unknown;
  readonly isFallback: boolean;
  readonly navigate: (
    destination: string | URL,
    options?: NavigateOptions,
  ) => void;
  readonly navigationType: NavigationType;
  readonly path: string;
  readonly routePath: string;
  readonly state: UrlState;
  readonly url: URL;
}

export interface RouteView {
  readonly content: Node;
  readonly dispose?: () => void;
  readonly update?: (context: RouteContext) => void;
}

export type RouteHandler = (context: RouteContext) => RouteView;
export type RouteChangeHandler = (path: string) => void;
export type RouteChangeSubscriber = (context: RouteContext) => void;

export interface NavigateOptions {
  readonly historyState?: unknown;
  readonly replace?: boolean;
}

interface Route {
  handler: RouteHandler;
  path: string;
}

export class Router {
  private activeRoute: Route | undefined;

  private activeView: RouteView | undefined;

  private currentContext: RouteContext | undefined;

  private isStarted: boolean = false;

  private readonly outlet: HTMLElement;

  private readonly routeChangeHandler: RouteChangeHandler | undefined;

  private readonly routes: Route[] = [];

  private readonly subscribers: Set<RouteChangeSubscriber> =
    new Set<RouteChangeSubscriber>();

  private readonly handleDocumentClick = (event: MouseEvent): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !(event.target instanceof Element)
    ) {
      return;
    }

    const anchor: HTMLAnchorElement | null =
      event.target.closest('a[data-link]');
    if (
      anchor === null ||
      anchor.hasAttribute('download') ||
      (anchor.target.length > 0 && anchor.target !== '_self')
    ) {
      return;
    }

    const url: URL = new URL(anchor.href, globalThis.location.href);
    if (!this.isAppUrl(url)) {
      return;
    }

    event.preventDefault();
    this.navigate(url);
  };

  private readonly handlePopState = (): void => {
    this.renderCurrentRoute('pop');
  };

  private readonly renderCurrentRoute = (
    navigationType: NavigationType,
  ): void => {
    const url: URL = new URL(globalThis.location.href);
    const currentPath: string = getRoutePath(url.pathname);
    const normalizedPath: string = this.normalizeRoutePath(currentPath);
    const matchedRoute: Route | undefined = this.routes.find(
      (route: Route): boolean => route.path === normalizedPath,
    );
    const homeAliasRoute: Route | undefined = this.routes.find(
      (route: Route): boolean =>
        normalizedPath === '/home' && route.path === '/',
    );
    const fallbackRoute: Route | undefined = this.routes.find(
      (route: Route): boolean => route.path === '*',
    );
    const route: Route | undefined =
      matchedRoute ?? homeAliasRoute ?? fallbackRoute;

    if (route === undefined) {
      return;
    }

    const isFallback: boolean = route === fallbackRoute;
    const canonicalUrl: URL = normalizeUrlState(url, {
      includeDialogs: true,
      includeLibraryState: !isFallback && route.path === '/library',
    });

    if (canonicalUrl.href !== url.href) {
      globalThis.history.replaceState(
        globalThis.history.state as unknown,
        '',
        canonicalUrl,
      );
    }

    const context: RouteContext = {
      historyState: globalThis.history.state as unknown,
      isFallback,
      navigate: (
        destination: string | URL,
        options: NavigateOptions = {},
      ): void => {
        this.navigate(destination, options);
      },
      navigationType,
      path: normalizedPath,
      routePath: isFallback ? '*' : route.path,
      state: parseUrlState(canonicalUrl),
      url: new URL(canonicalUrl),
    };
    const shouldReplaceView: boolean =
      this.activeRoute !== route ||
      (isFallback && this.currentContext?.path !== context.path);

    if (shouldReplaceView) {
      this.activeView?.dispose?.();
      this.activeView = undefined;

      const nextView: RouteView = route.handler(context);
      this.outlet.replaceChildren(nextView.content);
      this.activeView = nextView;
      this.activeRoute = route;
    } else {
      this.activeView?.update?.(context);
    }

    this.currentContext = context;
    this.routeChangeHandler?.(isFallback ? '' : route.path);

    if (this.currentContext !== context) {
      return;
    }

    const subscribers: Set<RouteChangeSubscriber> =
      new Set<RouteChangeSubscriber>(this.subscribers);
    for (const subscriber of subscribers) {
      subscriber(context);

      if (this.currentContext !== context) {
        return;
      }
    }
  };

  private readonly isAppUrl = (url: URL): boolean => {
    if (
      url.origin !== globalThis.location.origin ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return false;
    }

    const appRootPath: string = new URL(
      getAppPath('/'),
      globalThis.location.origin,
    ).pathname;
    const appRootWithoutTrailingSlash: string = appRootPath.endsWith('/')
      ? appRootPath.slice(0, -1)
      : appRootPath;
    if (
      appRootWithoutTrailingSlash.length > 0 &&
      url.pathname === appRootWithoutTrailingSlash
    ) {
      return true;
    }

    const routePath: string = getRoutePath(url.pathname);
    const resolvedPath: string = new URL(
      getAppPath(routePath),
      globalThis.location.origin,
    ).pathname;

    return resolvedPath === url.pathname;
  };

  private readonly normalizeRoutePath = (path: string): string => {
    const withLeadingSlash: string = path.startsWith('/') ? path : `/${path}`;

    return withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')
      ? withLeadingSlash.slice(0, -1)
      : withLeadingSlash;
  };

  private readonly resolveDestination = (destination: string | URL): URL => {
    if (destination instanceof URL) {
      return new URL(destination);
    }

    if (destination.length === 0) {
      return new URL(globalThis.location.href);
    }

    if (destination.startsWith('?') || destination.startsWith('#')) {
      return new URL(destination, globalThis.location.href);
    }

    const directUrl: URL = new URL(destination, globalThis.location.href);
    if (
      /^[a-z][a-z\d+.-]*:/i.test(destination) ||
      destination.startsWith('//')
    ) {
      return directUrl;
    }

    if (destination.startsWith('/') && this.isAppUrl(directUrl)) {
      return directUrl;
    }

    const routePath: string = destination.startsWith('/')
      ? destination
      : `/${destination}`;
    return new URL(getAppPath(routePath), globalThis.location.origin);
  };

  public constructor(
    outlet: HTMLElement,
    routeChangeHandler?: RouteChangeHandler,
  ) {
    this.outlet = outlet;
    this.routeChangeHandler = routeChangeHandler;
  }

  public addRoute(path: string, handler: RouteHandler): void {
    const normalizedPath: string =
      path === '*' ? path : this.normalizeRoutePath(path);

    if (
      this.routes.some((route: Route): boolean => route.path === normalizedPath)
    ) {
      throw new Error(`A route is already registered for "${normalizedPath}".`);
    }

    this.routes.push({ handler, path: normalizedPath });
  }

  public getContext(): RouteContext | undefined {
    return this.currentContext;
  }

  public navigate(
    destination: string | URL,
    options: NavigateOptions = {},
  ): void {
    const url: URL = this.resolveDestination(destination);
    if (!this.isAppUrl(url)) {
      throw new Error('Router navigation must stay within the application.');
    }

    const shouldReplace: boolean = options.replace === true;
    let historyState: unknown = null;
    if (Object.hasOwn(options, 'historyState')) {
      historyState = options.historyState;
    } else if (shouldReplace) {
      historyState = globalThis.history.state as unknown;
    }

    if (url.href === globalThis.location.href) {
      if (shouldReplace && Object.hasOwn(options, 'historyState')) {
        globalThis.history.replaceState(historyState, '', url);
        this.renderCurrentRoute('replace');
      }

      return;
    }

    if (shouldReplace) {
      globalThis.history.replaceState(historyState, '', url);
      this.renderCurrentRoute('replace');
      return;
    }

    globalThis.history.pushState(historyState, '', url);
    this.renderCurrentRoute('push');
  }

  public replace(
    destination: string | URL,
    historyState: unknown = globalThis.history.state as unknown,
  ): void {
    this.navigate(destination, { historyState, replace: true });
  }

  public subscribe(subscriber: RouteChangeSubscriber): () => void {
    this.subscribers.add(subscriber);

    return (): void => {
      this.subscribers.delete(subscriber);
    };
  }

  public start(): void {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;
    globalThis.addEventListener('popstate', this.handlePopState);
    document.addEventListener('click', this.handleDocumentClick);
    this.renderCurrentRoute('initial');
  }

  public stop(): void {
    if (!this.isStarted) {
      return;
    }

    globalThis.removeEventListener('popstate', this.handlePopState);
    document.removeEventListener('click', this.handleDocumentClick);
    this.activeView?.dispose?.();
    this.activeRoute = undefined;
    this.activeView = undefined;
    this.currentContext = undefined;
    this.subscribers.clear();
    this.outlet.replaceChildren();
    this.isStarted = false;
  }
}
