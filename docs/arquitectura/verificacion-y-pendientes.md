# Verificación, despliegue y pendientes

Última verificación local: **8 de octubre de 2026**, [limpieza y evidencia](../limpieza-2026-10-08.md).
Suite actual 238/244: seis fallos previos de respuestas tardías en los paneles de Quejas.
TypeScript, lint, build, estructura y capa visual correctos. Sin DB/despliegue nuevo.
La [auditoría del 7 de octubre](../auditoria-validada-2026-10-07.md) conserva su evidencia histórica.

## Comandos

~~~sh
npm run dev
npx tsc --noEmit
npm run lint
node --test tests/<suite-del-cambio>.test.mjs
npm run build
npm run check:structure
npm run check:visual
~~~

npm test ejecuta tests/*.test.mjs. Algunos fallos históricos dejan timers abiertos;
node --test --test-force-exit tests/*.test.mjs permite recoger el diagnóstico, sin
ocultar resultados. Elegir regresión pertinente y ampliar si aparece un fallo nuevo.
Un cambio solo Markdown requiere rutas/enlaces/consistencia y git diff --check, no otro build.

El auditor de estructura sigue imports literales/exports/CSS, identifica archivos
sin montaje y comprueba que no vuelvan kits retirados, middleware conflictivo ni
artefactos `.performance` versionados. Es un inventario estático: no autoriza
borrados automáticos ni demuestra permisos o referencias calculadas en runtime.

## Qué comprobar según el cambio

| Área | Suite o herramienta inicial |
| --- | --- |
| Sesión, login/logout, alcance de caché | tests/auth-visibility.test.mjs |
| QueryFunctionContext, dashboard, guard de métodos | tests/dashboard-runtime-regression.test.mjs |
| Cancelación, claves y paginación | tests/query-read-contracts.test.mjs, data-reliability.test.mjs, pagination-active.test.mjs |
| Precarga y permisos de Sidebar | tests/navigation-prefetch.test.mjs |
| Formularios y guardados duplicados | tests/operational-mutations.test.mjs |
| Inputs y efectos privilegiados de Usuarios | tests/usuarios-input-security.test.mjs, usuarios-acceso-workflow.test.mjs |
| Gestor/API IA y errores seguros | tests/ai-settings-security.test.mjs, ai-settings-ui.test.mjs, markdown-security.test.mjs |
| Kit, layout responsive, foco y modales | tests/visual-contracts.test.mjs, header-menu-focus.test.mjs, scripts/check-visual-layer.mjs |
| DB RLS/ACL/workflow | scripts/verificar-seguridad-db.sql y verificar-auditoria-db.sql, fixtures transaccionales y ROLLBACK |

Los tests JS transpilan módulos reales con tests/load-module.mjs y dobles de red;
no usan cuentas o credenciales reales. No instalar dependencias de un prototipo o
regenerar fixtures solo para hacer desaparecer un fallo. Baseline global de la
auditoría: **199/222, con 23 fallos presentes en HEAD anterior**. La comparación anterior
fue 119/156 y 37 fallos; se resolvieron 14, sin nuevos fallos en aquella suite.
Selección posterior de IA/sesión/cargas: **47/47**. Son resultados fechados.

## Evidencia previa y límites

- Next producción y TypeScript correctos; lint 0 errores con 2 warnings históricos de experimentos. Capa visual: 114 archivos React comprobados en esa auditoría.
- npm audit --omit=dev devolvió 0. La auditoría completa registró 5 entradas high de una cadena de desarrollo ESLint/fast-glob/micromatch/braces; no se forzaron versiones incompatibles. Releer package-lock y ejecutar audit antes de afirmar el resultado actual.
- El frontend/API compatible se verificó en Vercel en 07763ff antes del aislamiento de DB. Un checkout distinto requiere verificar su propio despliegue.
- HTML inicial de /, /quejas, /usuarios y /procesos: presentación neutra, sin shell privado. Browser temporal sin sesión real: ruta privada → login y recarga; IA/Usuarios sin Bearer e IA con token inválido responden 401.
- DB endurecida y rollback de metadatos se probaron con fixtures/ROLLBACK en remoto sin revertir el estado final. No se extrajeron datos de personas ni claves reales.
- No hay benchmark autenticado con miles de registros, carga concurrente completa, entrega de correo ni prueba universal de servicios externos. La suite y el documento no sustituyen esas comprobaciones.

## Trabajo pendiente confirmado

| Área | Alcance todavía pendiente |
| --- | --- |
| Catálogos | UI legacy aún ofrece DELETE/cambios que el trigger protege; integrar codigo/valor_interno y desactivación/historial |
| Quejas | Campos nuevos tipo/área/oficio/fecha/observaciones no están totalmente integrados; revisar distinción tipo/categoría |
| QMS | UI/editor SLA siguen legacy; integrar reglas/calendarios versionados y snapshots de plazos |
| Avisos/correo | No se observaron cron.job ni Edge Functions; mail_queue no es correo enviado |
| Respuestas concurrentes | Integrar useEntityRequestGuard en todos los handlers IA/chat/subidas/transiciones de paneles de quejas, incluso A→B→A |
| Datos legacy | Migrar consultas directas de componentes según necesidad; la cancelación aplicada a hooks no los reemplaza automáticamente |
| Usuarios | Último admin y cambios entre Auth/perfil sin transacción distribuida; revisar concurrencia real y coherencia de roles |
| Seguridad futura | Sin flujo MFA/2FA, CAPTCHA, contador distribuido de intentos o revocación universal de JWT |
| Rendimiento | Perfilar navegación autenticada/red/memoria con volumen y distinguir dev de build de producción |
| Producto | CRUD/derivación de hallazgos, eficacia/validación SACP, versionado/Drive documental y actas/acuerdos completos |
| Producto | Sin persistencia UI completa de informes_config, tareas o solicitudes documentales |
| Observabilidad | Seguridad y Estado sigue propuesto; sin ingesta/visor de errores reales ni telemetría JSONB con limpieza anual |
| Apariencia | Fondo personalizado y selector completo de tema no están montados |

RLS amplias de las 13 tablas, filtros seguros de Quejas/Usuarios, cancelación de
hooks operativos, reconexión de Realtime y validación API de Usuarios fueron
resueltos en la auditoría; no mantenerlos en la lista como si siguieran abiertos.

## Continuidad y despliegue

Consultar git status antes de editar/integrar cambios. Compilar localmente no
publica Vercel ni verifica sus variables. Tras desplegar, verificar URL/commit,
login, recarga privada, logout, permisos y API. Ctrl+F5 puede descartar chunks
antiguos; no borrar .next/node_modules o detener servicios del usuario como primera solución.

Validación manual útil: una cuenta desactivada con token previo, dos administradores
concurrentes, envío ciudadano con evidencias, servicios externos y reconexión real.
Actualizar contratos vivos por tema; auditorías y archivos históricos conservan la
evidencia de su fecha sin competir con la fuente actual.
