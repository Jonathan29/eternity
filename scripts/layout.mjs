export const siteUrl = 'https://jonathan29.github.io/eternity/';
export const escapeHtml = text => String(text).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const links = [['privacidad.html', 'Privacidad'], ['terminos.html', 'Términos'], ['normas.html', 'Comunidad'], ['eliminar-cuenta.html', 'Eliminar cuenta']];
export function page({ title, description, file, content, scripts = '' }) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="referrer" content="no-referrer">
  ${file === '404.html' ? '<base href="/eternity/">' : ''}
  <title>${escapeHtml(title)} · Eternity</title>
  <link rel="canonical" href="${siteUrl}${file === 'index.html' ? '' : file}">
  <link rel="icon" href="./assets/seed.svg" type="image/svg+xml">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Lexend:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="./styles.css">
  <script src="./theme.js" defer></script>
  ${scripts}
</head>
<body>
  <a class="skip-link" href="#contenido">Saltar al contenido</a>
  <header class="site-header">
    <a class="brand" href="./index.html" aria-label="Eternity, inicio"><img src="./assets/seed.svg" width="40" height="40" alt="">eternity<span class="beta">beta</span></a>
    <button class="theme-toggle" type="button" hidden aria-label="Cambiar a tema oscuro" aria-pressed="false">Tema oscuro</button>
  </header>
  <nav class="site-nav" aria-label="Navegación principal">${links.map(([href, label]) => `<a href="./${href}"${file === href ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
  <main id="contenido" tabindex="-1">${content}</main>
  <footer class="site-footer"><a class="brand small" href="./index.html">eternity</a><p>Aprender, crecer y cuidar lo que compartimos.</p><nav aria-label="Enlaces del pie">${links.map(([href, label]) => `<a href="./${href}">${label}</a>`).join('')}</nav><p class="fine">Este sitio no usa cookies, analítica ni rastreadores. El acceso de cuenta se mantiene solo en memoria mientras esta página está abierta. Las fuentes se sirven desde Google Fonts y el acceso seguro utiliza Supabase.</p></footer>
</body>
</html>
`.replace(/[\t ]+$/gm, '');
}
