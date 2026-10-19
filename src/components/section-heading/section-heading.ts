import './section-heading.scss';

interface SectionHeadingOptions {
  compactTitle?: string;
  controls?: HTMLElement;
  id: string;
  title: string;
}

export const createSectionHeading = (
  options: SectionHeadingOptions,
): HTMLElement => {
  const heading: HTMLDivElement = document.createElement('div');
  heading.className = 'section-heading';
  heading.innerHTML = `
    <div class="section-heading__title-group">
      <span class="section-heading__accent" aria-hidden="true"></span>
      <h2 class="section-heading__title" id="${options.id}">
        <span class="section-heading__title-full">${options.title}</span>
        ${
          options.compactTitle === undefined
            ? ''
            : `<span class="section-heading__title-compact">${options.compactTitle}</span>`
        }
      </h2>
    </div>
  `;

  if (options.controls !== undefined) {
    heading.append(options.controls);
  }

  return heading;
};
