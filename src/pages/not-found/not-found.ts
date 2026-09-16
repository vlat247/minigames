export const notFoundPage = (): string => {
  return `
    <div class="not-found-page">
      <h1>404 - Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <a href="/" data-link>Return Home</a>
    </div>
  `;
};
