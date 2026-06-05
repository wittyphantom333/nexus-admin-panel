class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    window.addEventListener('hashchange', () => this.resolve());
  }

  add(path, handler) {
    this.routes[path] = handler;
    return this;
  }

  navigate(path) {
    window.location.hash = path;
  }

  resolve() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, ...rest] = hash.split('?');
    const params = Object.fromEntries(new URLSearchParams(rest.join('?')));

    let handler = this.routes[path];
    if (!handler) {
      for (const [pattern, fn] of Object.entries(this.routes)) {
        const match = hash.match(pattern);
        if (match) {
          handler = fn;
          params._matches = match;
          break;
        }
      }
    }
    if (!handler) handler = this.routes['/404'] || (() => '<h2>404</h2>');

    this.currentRoute = path;
    return handler(params);
  }

  init() {
    this.resolve();
  }
}

const router = new Router();
