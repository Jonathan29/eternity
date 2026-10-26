(() => {
  const button = document.querySelector('.theme-toggle');
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  let dark = preference.matches;
  const render = () => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    button.textContent = dark ? 'Tema claro' : 'Tema oscuro';
    button.setAttribute('aria-label', dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    button.setAttribute('aria-pressed', String(dark));
  };
  button.hidden = false;
  button.addEventListener('click', () => { dark = !dark; render(); });
  preference.addEventListener('change', event => { dark = event.matches; render(); });
  render();
})();
