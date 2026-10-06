# Estandarización del panel — 6 de octubre de 2026

El panel conserva Tailwind v4, React y el azul #024796. No se agregaron
dependencias visuales ni un segundo tema. La guía vigente es
[visual-patterns.md](visual-patterns.md); AGENTS.md y las instrucciones del kit
se alinearon con la entrada CSS que usa realmente la aplicación.

## Cambios

- Recetas compartidas @utility ui-* para botones, campos, paneles y tablas.
  Se aplicaron a 59 campos nativos y 16 acciones, además de los componentes
  reutilizados por los módulos. Los acentos azules usan tokens de marca.
- Botones con atributos nativos, ref, disabled, estado de carga accesible y
  variantes comunes. Etiquetas ámbar con texto oscuro; naranja diferenciado.
- Configuración separada en secciones de Organización, Acceso y Servicios.
  Cada editor tiene su archivo, etiquetas, ayudas y estados de error propios.
- Consultas habilitadas para la sección visible. Montaje diferido por sección
  con borradores conservados; un usuario sin rol admin no monta sus editores.
- Validación de plazos, valores de catálogos y conservación del tipo JSON en
  General. Los ajustes de IA se administran exclusivamente en su sección.
- Confirmaciones para eliminar catálogos, plazos y enlaces públicos. Las
  escrituras de los nuevos editores comprueban la fila afectada y bloquean
  guardados simultáneos. Copiar enlaces anuncia éxito después de copiar.
- Matriz de permisos con nombres accesibles y explicación de Ver/Editar,
  restricciones reales de Usuarios/Configuración y guardas de concurrencia.
- Modales con dialog nativo, fondo inerte, Escape, restauración del foco y
  bloqueo de scroll compatible con modales anidados. El informe imprimible
  libera la altura del diálogo durante la impresión.
- Menú lateral desplegable en móvil y selector compacto para Configuración.
  La tabla amplia se desplaza dentro de su contenedor.
- Avisos de error sanitizados, sin imprimir objetos completos en la consola.
  Claves de IA ocultas por defecto, errores de carga recuperables y editor
  conservado cuando falla el guardado del proveedor.
- Previews/experimentos excluidos del escaneo de Tailwind y archivos generados
  excluidos de ESLint. Auth, RLS y restricciones de las API siguen siendo la
  autoridad de acceso; la vista por rol es una simulación de presentación.

## Verificación

- TypeScript y compilación de producción correctos.
- ESLint sin errores; tres avisos existentes en experimentos y Mis Quejas.
- Nueve pruebas nuevas de comportamiento y seguridad pasan.
- Auditoría de la capa visual pasa para 106 archivos React.
- Pruebas visuales locales con datos ficticios en 1280×720 y 390×844: sin
  desbordamiento horizontal de la página, borradores preservados, plazos
  inválidos bloqueados, modales con Escape y restauración del foco.
- Lecturas de comprobación en Supabase para catálogos, SLA y configuración
  respondieron correctamente. No se ejecutaron escrituras de prueba en la BD.

La suite general ya presentaba fallos antes de esta tarea, incluidos contratos
de prototipos anteriores, Realtime y cancelación de consultas. Su ejecución
completa tampoco terminaba de forma normal; se detuvo y se conservaron los
logs en .performance/. No se regeneraron fixtures para esconder esas diferencias.

## Límites

La revisión visual usa un preview aislado con datos ficticios; no sustituye una
prueba de todas las operaciones con una sesión real. Esta tarea mejora las
guardas de los flujos editados; no constituye una auditoría completa de RLS,
credenciales o infraestructura. Los prototipos anteriores se conservan para
evitar borrar trabajo local ajeno y no forman parte de los nuevos imports.
