# Seguimiento del track C — sitio público

Este archivo registra únicamente 3.4, 10.1, 10.2 y 10.3 de la spec aprobada en `C:/Source/eternity/biblia-app/.kiro/specs/security-hardening/`. El repositorio de la app se consultó en modo de solo lectura. Las casillas abiertas conservan las verificaciones exactas pendientes de la spec, aunque el código del sitio ya esté implementado.

- [ ] 3.4 Escanear el repositorio del sitio público — **parcial**
  - Implementados configuración gitleaks, excepción histórica exacta de credencial publicable, workflow de push/PR/semanal y escaneo completo redactado de todas las referencias disponibles.
  - Verificado: gitleaks 8.30.1 termina con cero hallazgos no exceptuados; actionlint 1.7.11 valida ambos workflows; ocho muestras sintéticas son rechazadas y una limpia pasa.
  - Pendiente de la dependencia 3.1: el clon de la app no contiene `.gitleaks.toml`; no se puede acreditar todavía la copia/paridad exacta. La configuración del sitio cubre las familias exigidas por 2.4 y no modifica la app. El track de la app debe comparar las configuraciones antes de cerrar la tarea completa.
  - _Boundary: repo site_
  - _Depends: 3.1_
  - _Requirements: 2.6_
- [x] 10.1 Publicar solo los archivos servidos
  - `build-static.mjs` reconstruye `dist/` mediante una lista explícita de 14 archivos y limpia residuos. El workflow prepara el artefacto de Pages únicamente desde `dist/`, sin desplegar. La publicación de `gh-pages` queda para el dueño.
  - Verificado: prueba de lista exacta, eliminación de archivo residual, seis páginas y exclusión de documentación, generadores, pruebas, manifiestos y configuración local.
  - _Requirements: 7.4_
- [ ] 10.2 CSP y protección contra enmarcado — **parcial en verificación**
  - Implementadas CSP en las seis páginas, SRI intacto, comprobación `window.top`, formulario cerrado por defecto y ausencia de handlers/Auth en marcos. El servidor local conserva el override 55321 sin ampliar la CSP del artefacto.
  - Verificado: Chromium contra servidor estático, SDK real con SRI y respuestas Auth/privacy en fixtures; CSP bloquea script inline y conexión ajena; marcos del mismo y de distinto origen no muestran ni inicializan la baja; sin JavaScript se conserva la explicación y no aparece el formulario.
  - Pendiente: `tests/local-e2e.mjs` contra Supabase real local. El script existente exige el dueño `impl/web-deletion`, obtiene credenciales mediante CLI y sirve desde el repo de la app usando `supabase/functions/.env`. No se ejecutó para respetar las restricciones de credenciales y de solo lectura de este track. Las pruebas existentes del cliente y el recorrido en servidor estático pasan, como permite el encargo, pero no se afirma verificación de BD.
  - _Requirements: 7.2, 7.3_
- [x] 10.3 Detectar sumideros HTML en el sitio
  - `check-site.mjs` y `npm run lint` fallan ante `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `document.writeln` y `eval` en fuentes servibles, incluidos archivos anidados.
  - Verificado: muestras positivas y negativas, línea correcta, ejecución del comando con archivo inyectado y salida sin contenido de la muestra. No se debilitaron pruebas existentes.
  - _Requirements: 7.6_

## Implementation Notes

- 2026-11-03: se implementó únicamente el track C en `impl/site-security`. Se conservaron los cuerpos legales, la configuración productiva y el contrato de baja. Se añadieron artefacto con lista explícita, CSP estricta, protección de marcos y barrera de sumideros. No hay TypeScript ni husky/Jest en este repo: se usaron Node test, Chromium/axe, gitleaks y actionlint.
- 2026-11-03: el escaneo inicial encontró solo `config.js:4`, commit `36257be69a8fbe790594257fff844a09edc89938`, regla `generic-api-key`: credencial publicable documentada, sin imprimir su valor. Se exceptuó exclusivamente esa huella; el reescaneo quedó limpio. No hubo hallazgos que requirieran rotación.
- 2026-11-03: `dist/` es la única entrada del artefacto; los workflows tienen permisos de lectura y no incluyen despliegue. GitHub Pages sigue limitado para cabeceras reales; la publicación y la decisión de hosting permanecen en 14.5. La comprobación de workflows en GitHub y las protecciones de ramas permanecen en 14.1.
- 2026-11-03: se mantienen abiertas la paridad de configuración con 3.1 y la prueba de BD de 10.2. No se abrió ningún archivo de entorno ni se operó Supabase, EAS, paneles, DNS, teléfono o puerto 8081. Evidencias y límites: `site-report.md`.
