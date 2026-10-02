import { getAppPath, getRoutePath } from '../utils/paths';

export interface RouteView {
  readonly content: Node;
  readonly dispose?: () => void;
}

export type RouteHandler = () => RouteView;
export type RouteChangeHandler = (path: string) => void;

interface Route {
  handler: RouteHandler;
  path: string;
}

export class Router {
  private activeView: RouteView | undefined;

  private isStarted: boolean = false;

  private readonly outlet: HTMLElement;

  private readonly routeChangeHandler: RouteChangeHandler | undefined;

  private readonly routes: Route[] = [];

  private readonly handleDocumentClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const anchor: HTMLAnchorElement | null =
      event.target.closest('a[data-link]');
    if (anchor === null || event.defaultPrevented) {
      return;
    }

    event.preventDefault();
    this.navigate(anchor.pathname);
  };

  private readonly renderCurrentRoute = (): void => {
    const currentPath: string = getRoutePath(globalThis.location.pathname);
    const matchedRoute: Route | undefined = this.routes.find(
      (route: Route): boolean => route.path === currentPath,
    );
    const fallbackRoute: Route | undefined = this.routes.find(
      (route: Route): boolean => route.path === '*',
    );
    const route: Route | undefined = matchedRoute ?? fallbackRoute;

    if (route === undefined) {
      return;
    }

    const activePath: string = matchedRoute === undefined ? '' : currentPath;
    this.activeView?.dispose?.();
    this.activeView = undefined;

    const nextView: RouteView = route.handler();
    this.outlet.replaceChildren(nextView.content);
    this.activeView = nextView;
    this.routeChangeHandler?.(activePath);
  };

  public constructor(
    outlet: HTMLElement,
    routeChangeHandler?: RouteChangeHandler,
  ) {
    this.outlet = outlet;
    this.routeChangeHandler = routeChangeHandler;
  }

  public addRoute(path: string, handler: RouteHandler): void {
    this.routes.push({ handler, path });
  }

  public navigate(path: string): void {
    const routePath: string = getRoutePath(path);
    globalThis.history.pushState(null, '', getAppPath(routePath));
    this.renderCurrentRoute();
  }

  public start(): void {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;
    globalThis.addEventListener('popstate', this.renderCurrentRoute);
    document.addEventListener('click', this.handleDocumentClick);
    this.renderCurrentRoute();
  }

  public stop(): void {
    if (!this.isStarted) {
      return;
    }

    globalThis.removeEventListener('popstate', this.renderCurrentRoute);
    document.removeEventListener('click', this.handleDocumentClick);
    this.activeView?.dispose?.();
    this.activeView = undefined;
    this.outlet.replaceChildren();
    this.isStarted = false;
  }
}
