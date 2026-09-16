export type RouteHandler = () => string | HTMLElement;

interface Route {
  path: string;
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];
  private rootElementId: string;

  constructor(rootElementId: string) {
    this.rootElementId = rootElementId;
    window.addEventListener('popstate', this.handleRoute.bind(this));

    // Intercept link clicks
    document.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor && anchor.hasAttribute('data-link')) {
        e.preventDefault();
        this.navigate(anchor.getAttribute('href') || '/');
      }
    });
  }

  public addRoute(path: string, handler: RouteHandler): void {
    this.routes.push({ path, handler });
  }

  public navigate(path: string): void {
    window.history.pushState(null, '', path);
    this.handleRoute();
  }

  public handleRoute(): void {
    const currentPath = window.location.pathname;
    let route = this.routes.find((r) => r.path === currentPath);

    if (!route) {
      route = this.routes.find((r) => r.path === '*');
    }

    const rootElement = document.getElementById(this.rootElementId);
    if (!rootElement) return;

    if (route) {
      const content = route.handler();
      if (typeof content === 'string') {
        rootElement.innerHTML = content;
      } else {
        rootElement.innerHTML = '';
        rootElement.appendChild(content);
      }
    }
  }
}
