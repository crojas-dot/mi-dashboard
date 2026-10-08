# Componentes

- Leer primero `../AGENTS.md`; el mapa `../docs/arquitectura/README.md` ubica componentes por módulo.
- UI reutilizable y sin negocio: `components/ui/` (seguir también `components/ui/AGENTS.md`). Componentes compartidos de dominio: `components/<dominio>/`. Componentes propios de una ruta: `app/<modulo>/components/`.
- No mover un componente de módulo a la capa compartida solo porque podría reutilizarse; hacerlo cuando existan consumidores reales y un contrato común.
- Al extraerlo, identifica los consumidores y fija un contrato explícito de props/estados accesibles; no mezcles variantes de dominio mediante props genéricas sin semántica.
- Mantener datos y mutaciones en hooks/servicios según el patrón del módulo; el kit visual no debe adquirir permisos, consultar DB ni conocer workflows.
- Usar tokens y recetas de `app/styles/theme.css` y `app/styles/components.css`; no duplicar colores, tamaños ni estilos de controles en archivos por página. Las clases Tailwind son presentación, no identificadores de negocio.
- Preferir componentes pequeños con props explícitas; dividir cuando haya responsabilidades distintas, no por longitud aislada.
- Añadir comentarios solo para contratos, estados tardíos, foco/accesibilidad u otras decisiones que no se deduzcan del JSX.
