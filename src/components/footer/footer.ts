import './footer.scss';
import { getAppPath } from '../../utils/paths';

export const createFooter = (): HTMLElement => {
  const homePath: string = getAppPath('/');
  const logoPath: string = getAppPath('/assets/icons/logo.png');
  const iconSpritePath: string = getAppPath('/icons.svg');
  const footer: HTMLElement = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="site-footer__top">
      <div class="site-footer__about">
        <a class="site-footer__brand" href="${homePath}" data-link aria-label="MiniGames home">
          <img src="${logoPath}" alt="" width="32" height="32" />
          <span>MiniGames</span>
        </a>
        <p class="site-footer__description">
          Take a short break and have fun. Hundreds of curated casual mini-games right in your web browser. No download required.
        </p>
      </div>

      <nav class="site-footer__navigation" aria-label="Footer navigation">
        <div class="site-footer__link-group">
          <h2>Explore</h2>
          <a href="${homePath}" data-link>Home</a>
          <a href="${homePath}" data-link>Library</a>
          <a href="${homePath}" data-link>Categories</a>
          <a href="${homePath}" data-link>Tournaments</a>
        </div>

        <div class="site-footer__link-group">
          <h2>Company</h2>
          <a href="${homePath}" data-link>About Us</a>
          <a href="${homePath}" data-link>Contact</a>
          <a href="${homePath}" data-link>Privacy Policy</a>
          <a href="${homePath}" data-link>Terms of Service</a>
        </div>

        <div class="site-footer__link-group site-footer__community">
          <h2>Community</h2>
          <div class="site-footer__socials">
            <a href="${homePath}" data-link aria-label="MiniGames on Bluesky">
              <svg aria-hidden="true" width="20" height="20"><use href="${iconSpritePath}#bluesky-icon"></use></svg>
            </a>
            <a href="${homePath}" data-link aria-label="MiniGames on Discord">
              <svg aria-hidden="true" width="20" height="20"><use href="${iconSpritePath}#discord-icon"></use></svg>
            </a>
            <a href="${homePath}" data-link aria-label="MiniGames on X">
              <svg aria-hidden="true" width="20" height="20"><use href="${iconSpritePath}#x-icon"></use></svg>
            </a>
          </div>
        </div>
      </nav>
    </div>

    <div class="site-footer__bottom">
      <p>© 2026 MiniGames. All rights reserved.</p>
      <a class="site-footer__credit-link" href="https://rs.school/courses/short-track" target="_blank" rel="noreferrer">
        <span class="site-footer__rs-logo" aria-hidden="true">RS</span>
        RS School
      </a>
      <a class="site-footer__credit-link" href="https://github.com/vlat247" target="_blank" rel="noreferrer">
        <svg aria-hidden="true" width="24" height="24"><use href="${iconSpritePath}#github-icon"></use></svg>
        @vlat247
      </a>
      <p class="site-footer__designed">Designed with love</p>
    </div>
  `;

  return footer;
};
