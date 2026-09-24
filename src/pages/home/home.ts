import type { RouteView } from '../../app/router';
import { createHeroSection } from '../../components/hero/hero';
import { createNewGamesSection } from '../../features/new-games/new-games';
import { createLeaderboardSection } from '../../features/leaderboard/leaderboard';
import { createDeveloperCta } from '../../components/developer-cta/developer-cta';

export const homePage = (): RouteView => {
  const content: DocumentFragment = document.createDocumentFragment();
  content.append(
    createHeroSection(),
    createNewGamesSection(),
    createLeaderboardSection(),
    createDeveloperCta(),
  );

  return { content };
};
