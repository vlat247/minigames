import './developer-cta.scss';

export const createDeveloperCta = (): HTMLElement => {
  const section: HTMLElement = document.createElement('section');
  section.className = 'developer-cta';
  section.setAttribute('aria-labelledby', 'developer-cta-title');
  section.innerHTML = `
    <div class="developer-cta__illustration">
      <img src="/assets/images/home/developer-workspace.png" alt="" />
    </div>
    <div class="developer-cta__card">
      <h2 class="developer-cta__title" id="developer-cta-title">Are You a Game Developer?</h2>
      <p class="developer-cta__description">
        Want to see your game on MiniGames? We're always looking for fun, engaging mini games to add to our platform. Submit your game and reach thousands of players!
      </p>
      <button class="btn btn--primary btn--large developer-cta__button" type="button">
        <span class="developer-cta__button-icon" aria-hidden="true">↥</span>
        Submit Form
      </button>
      <p class="developer-cta__contact">or contact us at developers@minigames.com</p>
    </div>
  `;

  return section;
};
