# UI ECA-QMS

El panel activo usa Tailwind v4 SIN prefijo, importado en app/globals.css.
Los componentes canónicos se importan directamente desde components/ui/.
Las recetas @utility ui-* están en app/styles/components.css; tokens en app/styles/theme.css y reglas globales/focus ring en app/globals.css.
Leer ../../docs/visual-patterns.md. No agregar Bootstrap, CoreUI ni bibliotecas de componentes.
Importar cada control directamente; no introducir un segundo kit ni un barrel que cargue todos los componentes.
Conservar atributos HTML/ARIA, ref, eventos, disabled/loading y type=button por defecto.
Mantener consultas, permisos y mutaciones fuera del kit; los componentes son presentación.
DeferredMount aplaza el montaje y conserva borradores; no carga código ni hace consultas.
