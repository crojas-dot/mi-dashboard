# Rutas y API

- Leer primero `../AGENTS.md`; para reglas de negocio, usar `../docs/arquitectura/README.md`.
- `page.tsx` compone la pantalla. Mantener formularios/paneles propios en `app/<modulo>/components/`; controles reutilizables van en `components/ui/`.
- Las lecturas remotas van por `lib/queries/`; las mutaciones reutilizables, por `lib/services/`. Evitar duplicar SQL/PostgREST, claves o reglas entre páginas.
- Cada módulo es dueño de sus reglas de presentación y flujo particulares. Al completar una funcionalidad, documenta qué está integrado y qué falta; no declares cobertura por archivos, tablas DB o prototipos sin consumidores.
- Antes de extraer lógica a `components/`, `lib/` o una constante global, comprueba que haya varios consumidores con el mismo contrato. Mantén local una variante realmente distinta y comparte solo el núcleo común.
- Reutiliza tokens/recetas visuales y componentes del kit antes de inventar clases o estilos. Los estilos de un caso único permanecen locales; no hagas global una clase de una sola pantalla.
- Si se pide igualar un color/estilo, rastrea el componente de referencia hasta su token o receta y comparte ese mismo token; no elijas un valor «parecido» por nombre o intuición.
- IDs de ruta, workflow, API y DB son contratos, no texto decorativo. Para cambiarlos, busca todos los consumidores y añade pruebas de compatibilidad; las etiquetas visibles pueden cambiar sin renombrar el ID.
- Una ruta nueva requiere revisar registro de presentación en `lib/constants/modulos.ts`, guard cliente y permisos reales en API/DB. El registro y la vista simulada no conceden acceso.
- `app/api/` es servidor: validar Bearer, identidad activa, rol, entidad e input antes de usar service role. Cada método HTTP necesita autorización propia y pruebas de rechazo.
- Mantener `proxy.ts` como frontera existente; no crear `middleware.ts`, Server Actions ni una segunda capa de acceso.
- Antes de cambiar APIs de Next, consultar la guía instalada indicada en `../AGENTS.md`. Para UI, leer `../docs/visual-patterns.md`.
- Añadir/actualizar pruebas en `tests/` y ejecutar la suite pertinente; para auth/API incluir token inválido y permisos insuficientes.
