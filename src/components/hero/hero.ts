import './hero.scss';

export const createHeroSection = (): HTMLElement => {
  const section: HTMLElement = document.createElement('section');
  section.className = 'hero';
  section.setAttribute('aria-labelledby', 'hero-title');
  section.innerHTML = `
    <div class="hero__card">
      <h1 class="hero__title" id="hero-title">Take a Short Break &amp; Have Fun</h1>
      <p class="hero__description hero__description--full">
        Discover hundreds of curated casual mini-games. Play instantly in your browser — puzzle, match 3, farm, and board classics.
      </p>
      <p class="hero__description hero__description--compact">
        Discover hundreds of curated casual mini-games right in your browser.
      </p>
      <button class="btn btn--primary btn--large hero__button" type="button">Browse Library</button>
    </div>
  `;

  return section;
};
