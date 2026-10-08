# ECA-QMS

Panel de gestión de calidad: Quejas, SACP, Documentos, Riesgos, Auditorías,
Revisión por Dirección, Procesos, Reportería y administración de usuarios/configuración.
Next.js 16 + React 19, Supabase, TanStack Query, Zustand y kit propio Tailwind v4.

## Para encontrar lo que quieres editar

- [Mapa de arquitectura y edición](docs/arquitectura/README.md): rutas exactas para cada cambio.
- [Guía de trabajo](AGENTS.md): reglas breves de sesión, seguridad, datos y capas.
- [Patrones visuales](docs/visual-patterns.md): tokens, controles, responsive y cargas.
- [Módulos y flujos](docs/arquitectura/modulos-y-flujos.md): capacidades activas y límites.
- [DB](docs/arquitectura/base-de-datos.md): esquema y RLS observados; verificar remoto antes de alterar.
- Las reglas locales se cargan por carpeta: [app/AGENTS.md](app/AGENTS.md), [lib/AGENTS.md](lib/AGENTS.md), [components/AGENTS.md](components/AGENTS.md) y [tests/AGENTS.md](tests/AGENTS.md). No hace falta copiar el mapa entero en cada solicitud.

## Pedir un cambio

Describe el resultado y lo que debe seguir igual; las guías indican dónde editar y cómo validar.

> En Usuarios, agrega filtro por estado. Conserva permisos y comportamiento móvil; ejecuta la prueba pertinente.

## Ejecutar localmente

~~~sh
npm ci
npm run dev
~~~

Abrir http://localhost:3000. Configurar .env.local con las variables documentadas en
[integraciones](docs/arquitectura/integraciones.md); nunca añadir secretos al repositorio.
El servidor de desarrollo no confirma variables ni despliegue de producción.

## Verificar cambios

~~~sh
npx tsc --noEmit
npm run lint
npm run check:structure
npm run check:visual
npm run build
~~~

Ejecutar además la suite pertinente de tests/. El [mapa de verificación](docs/arquitectura/verificacion-y-pendientes.md)
explica regresiones, resultados históricos y pendientes; la suite global conserva deuda previa.
Las pruebas de DB con fixtures terminan en ROLLBACK y se ejecutan solo sobre el proyecto autorizado.

## Dónde vive cada responsabilidad

app/ compone páginas y API; components/ contiene UI; lib/queries/ lee datos remotos;
lib/services/ ejecuta flujos; lib/server/ autoriza recursos privilegiados;
lib/constants/ centraliza diccionarios; app/styles/theme.css define tokens visuales.
app/globals.css compone Tailwind y las reglas globales.
La documentación por tema se mantiene en docs/arquitectura/ y la evidencia fechada
en auditorías/migraciones. Consultar consumidores actuales antes de integrar material histórico.
