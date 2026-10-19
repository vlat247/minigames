import type { RouteView } from '../../app/router';
import { createHeroSection } from '../../components/hero/hero';
import { createNewGamesSection } from '../../features/new-games/new-games';
import { createLeaderboardSection } from '../../features/leaderboard/leaderboard';
import { createDeveloperCta } from '../../components/developer-cta/developer-cta';

export const homePage = (): RouteView => {
  const content: DocumentFragment = document.createDocumentFragment();
  const newGames = createNewGamesSection();
  const leaderboard = createLeaderboardSection();
  content.append(
    createHeroSection(),
    newGames.element,
    leaderboard.element,
    createDeveloperCta(),
  );

  return {
    content,
    dispose: (): void => {
      newGames.destroy();
      leaderboard.destroy();
    },
  };
};
