# Informe de seguridad — track C

Fecha: 2026-11-03. Repositorio: sitio público, worktree `C:/Source/eternity/wt/site-sec`, rama `impl/site-security`. Alcance: 3.4, 10.1, 10.2 y 10.3. El repo de la app se mantuvo en solo lectura.

## Encontrados

| Hallazgo | Ubicación | Resultado |
| --- | --- | --- |
| Coincidencia del escáner con credencial publicable documentada | `config.js:4`, commit `36257be69a8fbe790594257fff844a09edc89938`, regla `generic-api-key` | No es un secreto; excepción por huella exacta en `.gitleaksignore:3`. Ningún valor se reproduce. |
| Generación sin artefacto separado ni limpieza de residuos | `scripts/build-static.mjs:55` | Lista explícita de archivos y reconstrucción de `dist/`. |
| Ausencia de CSP y protección del formulario contra marcos | `scripts/layout.mjs:11`, `deletion.js:5` | CSP compartida y comprobación de ventana superior antes de instalar handlers. |
| Ausencia de barrera automática de sumideros HTML | `scripts/check-site.mjs:8` | Comprobación estática obligatoria y regresión con una muestra inyectada. |

## Arreglados y re-probados

- `npm ci`: instalación del sitio, sin vulnerabilidades reportadas; no se cambian dependencias.
- `npm test`: 19 pruebas, cero fallos, cero omitidas; conserva las cinco originales del contrato de baja y añade publicación/CSP y barrera de sumideros.
- `npm run lint`: código 0; no hay sumideros prohibidos en las fuentes del sitio. Las muestras de `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`/`writeln` y `eval` sí se rechazan. El comando real falla con archivo/linea y omite su contenido.
- `npm run build:static`: código 0; `dist/` contiene exactamente 14 archivos servidos. Una prueba introduce un residuo y acredita que se elimina. Las seis páginas tienen CSP antes de los recursos; el SDK conserva SRI SHA-384. Los cuerpos legales no cambian.
- `npm run check:site` contra el servidor de `dist/`: código 0; 12 combinaciones de página/tema, enlaces y anclas, 360 px, sin desbordamiento ni errores de JS; axe WCAG A/AA sin infracciones detectadas.
- `npm run test:browser-security`: código 0; SDK real con SRI, contraseña inválida, contraseña borrada, confirmación explícita, `get_state` → `challenge` → `delete_account`, recibo, cierre de sesión y ausencia de almacenamiento persistente. Auth/privacy se responden con fixtures dentro del proceso, sin conexiones al backend. Incluye CSP activa, marcos del mismo y de distinto origen, JavaScript desactivado y override local 55321. La CSP publicada conserva únicamente el host productivo exacto.
- `node scripts/scan-secrets.mjs ./.local/tools/gitleaks/gitleaks.exe`: código 0, gitleaks 8.30.1, historial completo de todas las referencias locales con `--all --full-history --redact=100`, cero hallazgos no exceptuados. Checkout completo, referencias remotas actualizadas antes del escaneo; historial inicial con un commit. El script rechaza checkouts superficiales y solo imprime ubicaciones/reglas.
- `node scripts/test-secret-scanner.mjs ./.local/tools/gitleaks/gitleaks.exe`: código 0; ocho muestras sintéticas detectadas (Supabase secreto/JWT de servicio, API.Bible, PostHog, FCM, APNs, Google y PEM) y fuente limpia aceptada. No hay verificación contra proveedores.
- `.local/tools/actionlint/actionlint.exe`: código 0, versión 1.7.11, ambos workflows válidos. Ambos binarios se descargaron de sus releases oficiales y se comprobaron con SHA-256 del release. Los workflows solo preparan/verifican; no publican el sitio.
- `git diff --check`: código 0. Revisión de cambios sin nuevos marcadores de implementación pendiente y sin cambios en `config.js`, `deletion-client.js`, `styles.css` ni `legal-build.json`.

Evidencia RED: `node --test tests/publication.test.mjs` contra el generador original terminó con código 1 y dos fallos: faltaba el artefacto permitido/limpieza de residuos y no existían las páginas de `dist/`. Las mismas pruebas pasan después. La barrera de sumideros se acredita también por una muestra introducida en `assets/` que hace fallar el comando; el archivo se elimina en `finally`.

## Abiertos

| Pendiente | Responsable / referencia |
| --- | --- |
| Comparar/copiar la configuración definitiva de la app: `.gitleaks.toml` todavía no existe en el clon leído | Track app, dependencia 3.1 de 3.4. La configuración del sitio ya cubre las familias de 2.4. |
| Ejecutar la baja con servidor y BD Supabase local reales | Integración posterior de 10.2, con un runner compatible con las reglas de credenciales/solo lectura. Este track no modifica el runner de la app ni lee sus entornos. Las pruebas del sitio con fixtures no acreditan mutación real de BD. |
| Confirmar jobs remotos y protecciones de ramas | Dueño, 14.1; no se tocaron ajustes de GitHub. |
| Publicar exclusivamente `dist/`, retirando archivos servidos antiguos de `gh-pages` | Dueño, 14.5. No se ejecutó ninguna publicación. |
| Cabeceras reales de CSP/`frame-ancestors` y HSTS | Dueño, 14.5. La CSP en `meta` no admite `frame-ancestors`; la mitigación JS no sustituye la cabecera. |

## Producción

Sin verificar ni modificar. No se hicieron peticiones a Supabase productivo, cambios de Auth/CORS, migraciones, cambios de cuentas/DNS ni despliegues. Se conserva la dependencia previa de que el backend productivo soporte el contrato `privacy` y autorice el origen del sitio. Los resultados no certifican la configuración productiva ni una purga real.

## Revisión local y verificación

- 10.1 y 10.3: **VERIFIED / APPROVED**, dentro del límite, con pruebas frescas y evidencia negativa.
- 3.4: el escaneo y los workflows locales están verificados; cierre completo pendiente de la dependencia 3.1.
- 10.2: código y recorrido en servidor estático verificados; cierre exacto de la spec pendiente de la prueba de BD indicada arriba.
- Sin declaración de `FEATURE_GO` ni de validación productiva. La configuración de infraestructura bloqueada sigue fuera del alcance.

## Commits de implementación

- `bedde34`: escaneo de secretos e historial, reglas y workflow.
- `68d18ee`: artefacto permitido, CSP, protección de marcos y pruebas de navegador.
- `ec1ec0a`: barrera de sumideros y workflow de verificación/artefacto sin despliegue.
- La documentación y este seguimiento se guardan en un commit separado de cierre; todos los commits pertenecen únicamente a `impl/site-security`.
