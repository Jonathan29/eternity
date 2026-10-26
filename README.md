# Eternity · Sitio público

HTML, CSS y JavaScript sin compilación para servir. GitHub Pages publica la rama `gh-pages`, carpeta raíz. La rama `main` conserva las páginas generadas, los generadores y las pruebas.

## Páginas

| Página | URL prevista |
| --- | --- |
| Inicio | https://jonathan29.github.io/eternity/ |
| Privacidad | https://jonathan29.github.io/eternity/privacidad.html |
| Términos | https://jonathan29.github.io/eternity/terminos.html |
| Comunidad | https://jonathan29.github.io/eternity/normas.html |
| Eliminar cuenta | https://jonathan29.github.io/eternity/eliminar-cuenta.html |

También se incluyen `404.html`, `robots.txt` (permite rastreo) y `.nojekyll`. Compras está excluida porque el documento fuente dice **no publicar hasta activar compras**. Los documentos retirados de representantes están fuera de la lista de publicación.

## Regenerar

Se necesita Node.js 22 o posterior para las herramientas; el alojamiento solo necesita archivos estáticos.

```powershell
cd C:/Source/eternity/site
npm ci
node scripts/build-legal.mjs C:/Source/eternity/wt/age-gate/design/legal/documentos
node scripts/build-static.mjs
```

El primer script acepta cualquier directorio `documentos` con los tres Markdown vigentes. Conserva su texto, incluidas las advertencias y los pendientes jurídicos. Muestra la versión legal (`beta-2026-10-25`), la política de servicio (`ve-beta-2026-10-25`) y la fecha de vigencia. Los pendientes editoriales iniciales quedan al final en un desplegable. Solo sustituye los dos marcadores de URL pública por los enlaces de este sitio y adapta los enlaces Markdown entre documentos. No modifica los archivos de la app ni su marcador externo.

`legal-build.json` registra el SHA-256 del Markdown de origen para detectar cambios. **No es el manifiesto de aceptación de la app**: no usar estos hashes del archivo completo como hashes de consentimiento. La app conserva su propio manifiesto y su extracción/versionado. Si cambia la versión, revisar también la fecha y el resumen de retención en `scripts/build-static.mjs`, y regenerar.

Para cambiar navegación o el pie, editar `scripts/layout.mjs` y volver a ejecutar ambos generadores. Las fuentes son Bricolage Grotesque y Lexend desde Google Fonts; colores de `design/directions/arbol.html`, con bordes de formulario ajustados para contraste. El tema sigue al sistema y puede cambiarse durante la visita, sin guardar preferencias.

## Eliminación web

`config.js` contiene únicamente la URL de producción y su clave **pública** publishable/anon. La clave de origen se validó como `sb_publishable_`; nunca colocar aquí una clave de servicio o secreta. El worktree no traía `.env.local`, por lo que se leyó la variable pública del clon principal de la misma app, sin copiar otras variables.

El SDK está fijado en `@supabase/supabase-js@2.102.1`, servido por jsDelivr con integridad SHA-384. No hay trackers, cookies, almacenamiento local de sesión ni analítica. Las peticiones de fuentes y CDN sí comunican los datos de conexión necesarios a esos proveedores. El navegador usa `persistSession: false`, `autoRefreshToken: false` y `detectSessionInUrl: false`. Se borra el campo de contraseña al finalizar cada intento.

Recorrido:

1. `auth.signInWithPassword` con las credenciales existentes de la misma cuenta.
2. `privacy` → `get_state` para detectar una baja ya pendiente.
3. Confirmación explícita de la persona; iniciar sesión por sí solo no borra nada.
4. `privacy` → `challenge`, seguido de `delete_account` con `challenge` y `commandId` UUID. Se fija el token de la cuenta y se conserva el UUID en memoria para reintentos inciertos. El servidor comprueba el AMR reciente (cinco minutos) y consume el desafío ligado a sesión.
5. Recibo del servidor: diferencia aceptación pendiente de purga completada y muestra pasos pendientes. Se cierra la sesión web con `scope: 'local'`. La baja detiene capacidades de cuenta en el servidor.

No se escriben tablas desde el navegador. No se habilita Google en la web porque no se verificó la lista de redirecciones productiva y no se modificó el dashboard. Para habilitarlo en una iteración futura, el dueño debe agregar **`https://jonathan29.github.io/eternity/eliminar-cuenta.html`** a Supabase Auth → URL Configuration → Redirect URLs y después implementar/probar el callback PKCE en esta página; agregar la URL por sí solo no activa un botón. Mantener el Site URL y los callbacks nativos existentes de la app. El acceso actual por correo/contraseña no necesita esa redirección.

Las cuentas de invitado solo tienen la sesión del dispositivo: la página explica cómo borrar desde la app, que desinstalar no borra datos del servidor y que S24 prevé tramitar cuentas sin correo tras 30 días de inactividad. No se promete recuperar una sesión perdida con otra cuenta.

No fue necesario cambiar el servidor: el handler existente de `privacy` ya permite `POST`/`OPTIONS`, los encabezados de Supabase y `Access-Control-Allow-Origin: *`. El contrato de baja no depende del origen web. El sitio requiere que la versión vigente de esa función y las migraciones S24 estén operativas en producción; **no se verificó ni alteró producción**.

## Pruebas

```powershell
cd C:/Source/eternity/site
npm test
npm run serve
```

En otra terminal, para comprobaciones visuales y automáticas:

```powershell
cd C:/Source/eternity/site
npx playwright install chromium
npm run check:site
```

También puede usarse `PLAYWRIGHT_EXECUTABLE_PATH` para un Chromium ya instalado. Las capturas se guardan en `test-results/` (ignorado). La comprobación de sitio bloquea cualquier acceso a un backend `*.supabase.co`. La evaluación axe automática no sustituye una auditoría manual con lector de pantalla.

Para probar la baja completa, usar **solo Supabase local** del worktree APP (API 55321 y DB 55322). Si falta `supabase/functions/.env`, ejecutar antes `npm ci` en APP; no imprimir ni versionar ese archivo. Arrancar la pila local si no está en marcha con `npx supabase start` desde APP, dentro del mismo lock. No usar `db push`, `--linked` ni credenciales productivas.

Antes de tocar la base compartida, adquirir el lock acordado con los demás worktrees:

```powershell
cd C:/Source/eternity/site
$taskLock = 'C:/Users/jonat/AppData/Local/Temp/claude/C--Source-eternity/c88e9b59-f200-46bd-a94e-523f8207200f/scratchpad/impl/supabase.lock'
while (-not (New-Item -ItemType Directory -Path $taskLock -ErrorAction SilentlyContinue)) { Start-Sleep 15 }
Set-Content -LiteralPath "$taskLock/OWNER" -Value ("impl/web-deletion " + (Get-Date -Format o))
try {
  $env:SUPABASE_LOCAL_LOCK_DIR = $taskLock
  node tests/local-e2e.mjs C:/Source/eternity/wt/web-deletion
  if ($LASTEXITCODE -ne 0) { throw 'Falló la prueba local' }
} finally {
  # Solo este lock, creado por esta ejecución. No retirar el de otro agente.
  $resolved = (Resolve-Path -LiteralPath $taskLock).Path
  $expected = 'C:\Users\jonat\AppData\Local\Temp\claude\C--Source-eternity\c88e9b59-f200-46bd-a94e-523f8207200f\scratchpad\impl\supabase.lock'
  if ($resolved -eq $expected -and (Get-Content -LiteralPath "$taskLock/OWNER") -like 'impl/web-deletion *') {
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
```

El servidor estático debe estar abierto con `npm run serve` antes de la prueba. El ensayo sirve `privacy` desde APP, crea una cuenta sintética con Admin Auth **local**, inicia sesión en el navegador, exige confirmación, tramita la baja y lee la base para comprobar `deletion_pending`, ocho pasos y capacidades bloqueadas. No ejecuta el worker ni afirma purga completa. La cuenta sintética y su job quedan pendientes en local para inspección; no son una cuenta real. El test bloquea dominios de producción, impide rutas REST de tablas en el navegador y comprueba que no hay cookies ni sesión persistente.

El override `config.local.js` se crea durante la prueba y se elimina en `finally`. El servidor de desarrollo lo sirve **en lugar de** `config.js` únicamente en loopback. No se carga un override desde el HTML publicado. `.local/`, `config.local.js` y `test-results/` están ignorados y nunca deben publicarse. La función local iniciada por el test se detiene al terminar; el lock se libera en el shell, también si hay error.

## Publicar

Revisar los textos y confirmar que el staging solo contiene archivos públicos explícitos. No usar `git add .` ni `git add -A`. En esta entrega `main` y `gh-pages` apuntan al mismo contenido estático con sus herramientas; Pages sirve la raíz sin ejecutar Node.

```powershell
cd C:/Source/eternity/site
git push origin main
git branch -f gh-pages main
git push origin gh-pages
```

Para actualizaciones, comprobar primero que no se pisarán cambios remotos de `gh-pages`. No usar push forzado. El dueño debe seleccionar **Settings → Pages → Deploy from a branch → gh-pages → /(root)**. Esta tarea no cambia ajustes del repositorio.

## Pendientes del dueño

- Habilitar Pages; después colocar la URL de privacidad y la URL de eliminación en Google Play Console. La existencia de estos archivos no demuestra por sí sola cumplimiento de todos los requisitos de la tienda.
- Integrar el enlace externo en la app después de fusionar edad/consentimiento. El marcador de APP se dejó intacto.
- Completar la revisión jurídica y los marcadores que siguen declarados en los documentos, incluidos proveedores/transferencias, canal de derechos y máximo de recibos técnicos. El calendario distingue objetivos operativos de plazos legales.
- Habilitar un contacto real y actualizar los textos: `info@eternity.app` aún no es operativo. Hoy no hay un canal web alternativo para titularidad perdida, cuentas solo Google sin sesión en app u otras revisiones manuales.
- Verificar el despliegue y la operación de S24 en producción por el proceso del proyecto, incluidos worker, retención y confirmaciones de proveedores. No se probó producción en esta entrega.
- Si se desea Google en esta web, autorizar la redirección indicada y desarrollar su callback. No hace falta para correo/contraseña.
