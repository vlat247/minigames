export const GAME_DETAILS_OPEN_EVENT: string = 'game-details:open';
export const GAME_DETAILS_CLOSE_REQUEST_EVENT: string =
  'game-details:close-request';

export interface GameDetailsRequestDetail {
  readonly slug: string;
}

export const dispatchGameDetailsRequest = (slug: string): void => {
  document.dispatchEvent(
    new CustomEvent<GameDetailsRequestDetail>(GAME_DETAILS_OPEN_EVENT, {
      detail: { slug },
    }),
  );
};

export const dispatchGameDetailsCloseRequest = (): void => {
  document.dispatchEvent(new Event(GAME_DETAILS_CLOSE_REQUEST_EVENT));
};

export const isGameDetailsRequestDetail = (
  value: unknown,
): value is GameDetailsRequestDetail => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'slug' in value &&
    typeof value.slug === 'string' &&
    value.slug.length > 0
  );
};
