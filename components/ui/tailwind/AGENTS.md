# UI kit React + Tailwind

- Solo React y utilidades tw:. Sin Bootstrap, CoreUI, CSS Modules ni CSS de componentes.
- Leer ../../../docs/visual-patterns.md antes de editar.
- Tokens: app/styles/tokens.css. Alias: app/styles/ui-kit.css, única entrada Tailwind v4.
- cn combina clsx + tailwind-merge con prefijo tw. Importaciones directas por archivo.
- Sin red, permisos, consultas, stores ni mutaciones aquí.
- Conservar props HTML/ARIA, ref, eventos, disabled/loading. Button usa type=button.
- Labels enlazados al id; nombres accesibles en acciones/filtros.
- Modal usa dialog/showModal: conservar pila, foco, Escape, backdrop y bloqueo de scroll.
- No dinamizar formularios al primer clic. ChartCanvas es la excepción pesada y diferida.
- Validar npm test, npm run lint, npm run build y node scripts/check-visual-layer.mjs.
