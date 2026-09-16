import './styles/main.scss';
import { Router } from './core/router';
import { homePage } from './pages/home/home';
import { notFoundPage } from './pages/not-found/not-found';

const initApp = () => {
  const router = new Router('app');

  router.addRoute('/', homePage);
  router.addRoute('*', notFoundPage);

  router.handleRoute();
};

document.addEventListener('DOMContentLoaded', initApp);
