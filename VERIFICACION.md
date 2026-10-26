# Verificación de la entrega

Ejecución: 25 de octubre de 2026, zona America/Caracas. Solo entorno local para autenticación y eliminación.

- Cinco pruebas unitarias: contrato de desafío/baja y cierre de sesión; UUID estable tras respuesta incierta; token fijado frente a cambio de cuenta; detección de baja pendiente; reautenticación tras cinco minutos. Todas pasaron.
- Doce combinaciones de página y tema: seis páginas a 360 px en claro y oscuro, sin desbordamiento horizontal del documento, enlaces locales y anclas válidos, sin errores JavaScript. Axe no encontró infracciones de los conjuntos WCAG A/AA 2.0, 2.1 y 2.2 evaluados.
- Capturas de inicio a 1440 px y de inicio, privacidad y baja a 360 px. Inspección visual de inicio y eliminación, incluidos modo oscuro, tablas desplazables y jerarquía de formulario.
- Baja real desde Chromium contra `http://127.0.0.1:55321`, función `privacy` del worktree `impl/web-deletion`: contraseña incorrecta controlada, inicio correcto con cuenta sintética local, confirmación obligatoria, `get_state` → `challenge` → `delete_account`, recibo y cierre de sesión. La base local confirmó un job de tipo `deletion`, estado de cuenta `deletion_pending`, ocho pasos de purga en cola y todas las capacidades en `false`.
- El navegador no escribió tablas, no dejó cookies, `localStorage` ni `sessionStorage`, y al recargar pidió entrar de nuevo. Cero solicitudes a producción; los dominios `*.supabase.co` quedaron bloqueados en la prueba. La configuración local se eliminó al terminar y se liberó el lock propio.
- No se ejecutó el worker de eliminación: se verificó la aceptación y la cola de baja, no una purga completa ni los proveedores productivos. La interfaz distingue esos estados.
- No hubo cambios de servidor ni migraciones. APP quedó sin cambios versionados. La rama `new-design` y el worktree de edad no se modificaron.
- Dependencias de herramientas de SITE: `npm audit`, cero vulnerabilidades al instalar la versión fijada del generador. La app tiene su propio inventario de dependencias, fuera de este cambio.

Los resultados detallados y las capturas quedan en `test-results/`, ignorado por Git. No se publican credenciales, tokens ni contraseñas de prueba. La evaluación automática no acredita una auditoría completa de accesibilidad ni una revisión jurídica.
