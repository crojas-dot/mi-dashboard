<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ECA-QMS — guía de entrada

Esta guía contiene únicamente invariantes globales. No agregar cronologías,
SHAs, resultados de pruebas ni especificaciones de píxeles a la raíz.
Los contratos detallados viven en `docs/arquitectura/`; Git conserva el historial.
Leer solo esta guía, el AGENTS.md de la capa afectada y la referencia del tema.

## Stack y arquitectura base

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 sin prefijo,
  Supabase JS 2, TanStack Query 5 y Zustand 5; versiones exactas en package.json.
- `app/` compone rutas, páginas y API. Las páginas operativas son Client
  Components; el layout servidor monta metadata, fuente y proveedores.
- `components/ui/` y `components/Modal.tsx` son el kit común; los componentes
  de dominio solo se comparten cuando existe un contrato común real.
- TanStack Query administra datos remotos; Zustand gestiona sesión/UI.
  Borradores no guardados son locales; guardado remoto usa servicios versionados.
- Las lecturas pasan por `lib/queries/`, las escrituras por `lib/services/`;
  API, `proxy.ts` y `lib/server/` constituyen la frontera privilegiada.
  `createServiceClient` es server-only; no importarlo desde UI.
- Fuentes únicas: rutas/roles/estados en `lib/constants/`, claves/TTL en
  `lib/queries/`, tokens en `app/styles/`, esquema en `supabase/migrations/`.
  No introducir otra arquitectura, Server Actions ni otro kit visual.

## Reglas antes de editar

- Respetar el working tree y las instrucciones de cada subdirectorio.
  Consultar la guía local de Next antes de escribir código; usar `proxy.ts`,
  no añadir un middleware.ts paralelo.
- Para Supabase, leer `.agents/skills/supabase/SKILL.md`; para SQL/RLS/índices,
  también supabase-postgres-best-practices y referencias pertinentes.
  Comprobar esquema, policies, grants y RPC efectivos antes de alterar DB.
- Para UI, leer [patrones visuales](docs/visual-patterns.md) y el contrato del
  módulo; conservar geometría, jerarquía, contraste, accesibilidad y scroll.
  No reintroducir diseños descartados, CoreUI/Bootstrap ni adornos arbitrarios.
- Rastrear productores y consumidores de cada símbolo o dato: UI, hooks,
  servicios, API, permisos, DB, reportes y pruebas. Compartir abstracciones
  solo si preservan la semántica de todos sus consumidores.
- Separar IDs persistidos, rutas/claves, etiquetas y presentación. Una etiqueta
  no renombra IDs. Usar imports @/ y capas existentes.
- Mantener honestidad sobre alcance: código, prueba ejecutada, migración
  aplicada, deploy web y servicio externo activo son hechos distintos.
  Verificar el alias y su commit antes de afirmar publicación.
- Antes del piloto con usuarios reales, cerrar los pendientes de seguridad
  aplicables y comprobar el ciclo de Quejas con roles representativos, un
  expediente ficticio y un buzón de prueba. Validar el piloto interno antes de
  abrir el formulario al público. Consultar [aceptación para uso real](docs/arquitectura/verificacion-y-pendientes.md#aceptación-para-uso-real).
- No copiar secretos, tokens, credenciales, datos privados o .env a código,
  documentación, prompts, logs ni fixtures. Rotación coordinada de secretos
  de correo pendiente: consultar [verificación](docs/arquitectura/verificacion-y-pendientes.md);
  no rotar unilateralmente ni publicar valores.
- Comentar decisiones/invariantes no obvios, no narrar el código.
  Actualizar la referencia temática y el mapa si cambian puntos de edición.

## Invariantes de seguridad, sesión y DB

- Auth relaciona auth.users.id con usuarios.auth_id; autores, responsables
  y entidades referencian usuarios.id. No confundir las dos identidades.
  Admin es la máxima autoridad operativa; no existe superadmin integrado.
- Restaurar/login: verificar identidad remota, perfil activo, acceso y revisión
  de sesión; publicar usuario/permisos juntos. Refresh de la misma identidad
  conserva vista y caché. Eventos Auth no esperan llamadas SDK dentro del callback.
- Logout retira datos privados antes de esperar red; la marca de cierre no
  contiene identidad ni tokens. Respuestas tardías nunca restauran otra sesión.
  No prometer revocación universal inmediata de JWT.
- AuthShell bloquea montaje antes de autorización y mientras redirige.
  No mostrar el dashboard como relleno; rutas públicas solo por segmento.
  Usuarios y Configuración exigen admin real, incluso al simular vista.
- La simulación cambia presentación, no Auth, RLS ni permisos efectivos.
  Registrar una ruta no concede acceso. Aplicar lectura antes de escritura.
- API privadas validan Bearer, perfil activo, rol y entidad. Proxy descarta
  headers de identidad aportados por cliente; solo métodos con guard completo
  evitan duplicarlo. Service role no sustituye autorización explícita.
- RLS/ACL y guards del servidor son autoridad, no controles visuales.
  No reabrir RPC legacy ni acceso directo público; verificar policies permisivas
  y restrictivas, no solo si RLS está habilitada.
- Caché aislada por identidad/rol real/vista. Cambiar ámbito vacía el anterior;
  navegar en el mismo conserva caché fresca. Guard fuera del key de datos.
  Compartir claves/queryFn, cancelar lecturas y rechazar callbacks obsoletos.
- Acceso temporal: 3 días hábiles desde emisión en Costa Rica; login directo
  si ready, cambio desde Mi perfil y aviso no bloqueante. Vencimiento requiere
  reset autorizado. 2FA independiente si exigido; TOTP AAL2 real, OTP propio
  nunca simula AAL2. No imponer políticas nuevas retroactivamente a cuentas legacy.
- No repetir altas confirmadas; reenvío/reset solo autorizados y con confirmación.
  No exponer clave temporal si se solicitó correo. Borrado conserva autores,
  responsables e historial; no eliminar físicamente el perfil.
- Concurrencia optimista: conservar revisión/versiones capturadas y lock
  síncrono; no releer versión para forzar escritura. Error de refresco no
  convierte escritura confirmada en fallo ni justifica duplicarla.
- Drive privado por API autorizada, Blob revocable local, sin iframe externo
  ni enlaces públicos. No borrar metadatos ante borrado remoto incierto.
- Transportes de correo de acceso y Quejas separados. Confirmación de envío
  no equivale a lectura; no reenviar sent/uncertain a ciegas.
  No inferir que Vercel despliega Edge, Apps Script o migraciones.

## Invariantes de negocio clave

- Los módulos se llaman Quejas y Mis Quejas. Tipos: Queja, Observación,
  Sugerencia, Reclamo y Felicitación; usar «solicitud» y «expediente» como
  textos neutrales sin cambiar identificadores persistidos.
- Cero decisiones a ciegas: el CTA del expediente contraído solo amplía;
  acciones críticas únicamente con contexto completo y permiso del rol.
  Conservar visita, borrador, revisión y editor al alternar vistas.
- Calidad y responsable tienen funciones distintas. Aprobar GC registra
  revisión y pasa a Resuelto; publicar respuesta es una acción independiente.
  No inventar etapas de investigación/aprobación en No Procede.
- Documento y oficio siguen obligatorios para publicación final; la excepción
  de Felicitación está pendiente de cambio coordinado de backend y transporte.
- Folios y plazos se asignan en DB, con calendario QMS persistido; no regenerar
  folios históricos ni reiniciar plazos por consultar, devolver o reasignar.
- Formulario público con capacidad privada, validación y reintentos idempotentes;
  no revelar PII/notas internas. Seguimiento no demuestra identidad del portador.
- No atribuir funciones completas a módulos parciales o utilidades sin consumidor.
  Consultar inventario real antes de ampliar Documentos, SACP, Riesgos,
  Auditorías, Revisión, Procesos o Reportería.

## Mapa de arquitectura y documentación

| Tema | Referencia |
| --- | --- |
| Mapa y fuentes únicas | [Arquitectura](docs/arquitectura/README.md) |
| Sesión, roles y Usuarios | [Sesión y permisos](docs/arquitectura/sesion-y-permisos.md) |
| Módulos y negocio | [Módulos y flujos](docs/arquitectura/modulos-y-flujos.md) |
| UI y accesibilidad | [Visual](docs/arquitectura/visual.md), [patrones](docs/visual-patterns.md) |
| Lecturas, caché y rendimiento | [Datos y rendimiento](docs/arquitectura/datos-y-rendimiento.md) |
| Persistencia y RLS | [Base de datos](docs/arquitectura/base-de-datos.md) |
| API, correo y Drive | [Integraciones](docs/arquitectura/integraciones.md) |
| Evidencia y pendientes | [Verificación](docs/arquitectura/verificacion-y-pendientes.md) |
| Guías locales | [app](app/AGENTS.md), [lib](lib/AGENTS.md), [components](components/AGENTS.md), [UI](components/ui/AGENTS.md), [tests](tests/AGENTS.md) |

## Verificación mínima antes de entregar

Elegir suites pertinentes y ampliar ante fallos. QA sintética sin secretos ni
escrituras reales no autorizadas; no alterar fixtures para ocultar regresiones.
Para solo Markdown: revisar enlaces, consistencia y diff; no requiere otro build.

~~~sh
npx tsc --noEmit
npm run lint
node --test tests/<suite-del-cambio>.test.mjs
npm run build
npm run check:structure
npm run check:visual
~~~
