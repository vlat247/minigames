import type { AppShell } from './app-shell';
import { type RouteContext, type Router } from './router';
import { updateUrlState } from './url-state';
import {
  AUTH_DIALOG_CLOSE_REQUEST_EVENT,
  AUTH_DIALOG_OPEN_EVENT,
  isAuthDialogRequestDetail,
} from '../components/dialogs/auth-dialog-events';
import {
  GAME_DETAILS_CLOSE_REQUEST_EVENT,
  GAME_DETAILS_OPEN_EVENT,
  isGameDetailsRequestDetail,
} from '../components/dialogs/game-details-events';

type DialogKind = 'auth' | 'game';

interface DialogHistoryEntry {
  readonly baseHref: string;
  readonly kind: DialogKind;
}

interface DialogHistoryState {
  readonly miniGamesDialog: DialogHistoryEntry;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getDialogHistoryEntry = (
  state: unknown,
): DialogHistoryEntry | undefined => {
  if (!isRecord(state) || !isRecord(state.miniGamesDialog)) {
    return undefined;
  }

  const { baseHref, kind } = state.miniGamesDialog;
  return typeof baseHref === 'string' && (kind === 'auth' || kind === 'game')
    ? { baseHref, kind }
    : undefined;
};

const getActiveDialogKind = (context: RouteContext): DialogKind | undefined => {
  if (context.state.game !== undefined) {
    return 'game';
  }

  return context.state.auth === undefined ? undefined : 'auth';
};

const createDialogHistoryState = (
  state: unknown,
  entry: DialogHistoryEntry,
): DialogHistoryState & Record<string, unknown> => {
  const existingState: Record<string, unknown> = isRecord(state) ? state : {};
  return { ...existingState, miniGamesDialog: entry };
};

const removeDialogHistoryEntry = (state: unknown): unknown => {
  if (!isRecord(state) || !Object.hasOwn(state, 'miniGamesDialog')) {
    return state;
  }

  const nextState: Record<string, unknown> = { ...state };
  delete nextState.miniGamesDialog;
  return Object.keys(nextState).length === 0 ? null : nextState;
};

const getDialogFreeUrl = (context: RouteContext): URL => {
  return updateUrlState(context.url, { auth: null, game: null });
};

export const connectDialogRouting = (
  router: Router,
  shell: AppShell,
): (() => void) => {
  const eventController: AbortController = new AbortController();
  const { signal } = eventController;

  const openDialog = (
    kind: DialogKind,
    update: Parameters<typeof updateUrlState>[1],
  ): void => {
    const context: RouteContext | undefined = router.getContext();
    if (context === undefined) {
      return;
    }

    const activeKind: DialogKind | undefined = getActiveDialogKind(context);
    const nextUrl: URL = updateUrlState(context.url, update);

    if (activeKind === kind) {
      router.navigate(nextUrl, {
        historyState: context.historyState,
        replace: true,
      });
      return;
    }

    const baseUrl: URL = getDialogFreeUrl(context);
    router.navigate(nextUrl, {
      historyState: createDialogHistoryState(context.historyState, {
        baseHref: baseUrl.href,
        kind,
      }),
    });
  };

  const closeDialog = (kind: DialogKind): void => {
    const context: RouteContext | undefined = router.getContext();
    if (context === undefined) {
      return;
    }

    const stateKey: DialogKind = kind;
    const isRequestedDialogOpen: boolean =
      context.state[stateKey] !== undefined;
    if (!isRequestedDialogOpen) {
      return;
    }

    const nextUrl: URL = getDialogFreeUrl(context);
    const historyEntry: DialogHistoryEntry | undefined = getDialogHistoryEntry(
      context.historyState,
    );

    if (historyEntry?.kind === kind && historyEntry.baseHref === nextUrl.href) {
      globalThis.history.back();
      return;
    }

    router.navigate(nextUrl, {
      historyState: removeDialogHistoryEntry(context.historyState),
      replace: true,
    });
  };

  document.addEventListener(
    AUTH_DIALOG_OPEN_EVENT,
    (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (isAuthDialogRequestDetail(detail)) {
        openDialog('auth', { auth: detail.mode, game: null });
      }
    },
    { signal },
  );

  document.addEventListener(
    AUTH_DIALOG_CLOSE_REQUEST_EVENT,
    (): void => {
      closeDialog('auth');
    },
    { signal },
  );

  document.addEventListener(
    GAME_DETAILS_OPEN_EVENT,
    (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (isGameDetailsRequestDetail(detail)) {
        openDialog('game', { auth: null, game: detail.slug });
      }
    },
    { signal },
  );

  document.addEventListener(
    GAME_DETAILS_CLOSE_REQUEST_EVENT,
    (): void => {
      closeDialog('game');
    },
    { signal },
  );

  const unsubscribe: () => void = router.subscribe(
    (context: RouteContext): void => {
      shell.synchronizeDialogs(context.state);
    },
  );

  return (): void => {
    eventController.abort();
    unsubscribe();
  };
};
