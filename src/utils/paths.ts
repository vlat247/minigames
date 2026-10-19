const APP_BASE_PATH: string = import.meta.env.BASE_URL;
const LEADING_SLASHES_PATTERN: RegExp = /^\/+/;

export const getAppPath = (path: string): string => {
  return `${APP_BASE_PATH}${path.replace(LEADING_SLASHES_PATTERN, '')}`;
};

export const getRoutePath = (pathname: string): string => {
  if (APP_BASE_PATH === '/') {
    return pathname;
  }

  const baseWithoutTrailingSlash: string = APP_BASE_PATH.slice(0, -1);
  if (pathname === baseWithoutTrailingSlash || pathname === APP_BASE_PATH) {
    return '/';
  }

  if (!pathname.startsWith(APP_BASE_PATH)) {
    return pathname;
  }

  const routeWithoutBase: string = pathname.slice(APP_BASE_PATH.length);
  return routeWithoutBase.length === 0 ? '/' : `/${routeWithoutBase}`;
};
