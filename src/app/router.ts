export type RouteHandler = () => HTMLElement | string;

interface Route {
  handler: RouteHandler;
  path: string;
}

export class Router {
  private readonly rootElement: HTMLElement;

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

    const content: HTMLElement | string = route.handler();
    this.rootElement.replaceChildren();

    if (typeof content === 'string') {
      this.rootElement.innerHTML = content;
      return;
    }

    this.rootElement.append(content);
  };

  public constructor(rootElement: HTMLElement) {
    this.rootElement = rootElement;
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
    globalThis.addEventListener('popstate', this.renderCurrentRoute);
    document.addEventListener('click', this.handleDocumentClick);
    this.renderCurrentRoute();
  }
}
import { getAppPath, getRoutePath } from '../utils/paths';
