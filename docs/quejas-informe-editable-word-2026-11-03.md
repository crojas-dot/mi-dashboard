# Informe editable y exportación Word de Quejas

## Identidad documental y separación de secciones — 11 noviembre

El exportador Word omitía todos los párrafos vacíos y asignaba el mismo sombreado
a los títulos. Una Conclusión vacía quedaba contigua a Anexos y Word unía sus fondos.
Ahora no se sombrean las secciones y se conserva un único párrafo editable tras un
título vacío. Se mantienen los estilos nativos de Word, listas y paginación A4.
El contenido/versiones de los informes guardados no se reescriben.

`lib/constants/informeDesign.ts` recoge la guía de identidad facilitada por el
propietario: azul #2A61B0 en secciones, negro #1A1718 en institución/cuerpo y gris
#E6E5E5 para divisores. Word y editor usan Century Gothic para títulos y Arial 11pt
para el cuerpo, ambas fuentes secundarias autorizadas. Gilroy no está incluida
ni se redistribuye; PDF conserva su Helvetica integrada y comparte la jerarquía
de color sin franjas de fondo. Estos valores documentales no cambian el azul del
resto de la aplicación.

Verificación local: 25 pruebas de informe/editor correctas, TypeScript, lint focalizado,
capa visual y compilación de producción. Se generaron DOCX reales de conclusión vacía, completa y expediente
extenso con datos sintéticos, renderizados mediante LibreOffice; se inspeccionaron
sus cuatro páginas sin unión de títulos, recortes ni solapamientos. Artefactos en
`.performance/informe-identidad-20261111/`. Sin escrituras remotas ni publicación web.

Implementación local del 3 noviembre. Web **sin publicar**. La persistencia está
activada en ECA-QMS (`fykhrrpeoehwqznccmfp`) mediante la migración
`20261104001552_queja_informes_editables`, tras autorización y reconexión OAuth
del propietario. El preflight remoto confirmó tipos UUID/bigint, policies/grants
efectivos de `quejas`/`usuarios` y ausencia de una tabla previa `queja_informes`.
El prefijo de migración usa UTC; la activación corresponde al 3 noviembre en
Costa Rica. El archivo local coincide con la versión registrada por MCP.

## Interacción

Admin/Calidad dispone de **Generar expediente** en el encabezado del caso. El
botón espera la lectura completa de adjuntos para no omitir anexos. La primera
apertura consulta el último informe guardado. Un error de lectura no se interpreta
como ausencia de documento ni habilita una sobrescritura.

El documento abre en el Tiptap existente, con hoja blanca centrada, fondo gris,
negrita/cursiva/listas/títulos y barra de formato visible al desplazarse en
escritorio. El editor usa una vista a pantalla completa con encabezado de 56 px y
barra de herramientas de 44 px. Ambos permanecen fijos; solo el lienzo central se
desplaza y contiene una hoja A4 blanca centrada con márgenes editoriales. Metadatos y títulos
de sección tienen jerarquía visual diferenciada y se adaptan a pantallas estrechas.
No cambia la composición de revisión GC ni el workflow actual.
El cuerpo de edición usa Arial de 11 pt, como el DOCX; el foco de teclado conserva
un indicador gris sutil en lugar de un contorno azul.

Plantilla inicial: encabezado institucional, INFORME N°, A, DE, FECHA, ASUNTO;
antecedentes; evaluación e investigación; **3. Conclusión y Resolución Final** con
espacio para redactar; anexos con nombres de archivo, sin enlaces ni tarjetas.
Los textos históricos plain conservan sus caracteres literales. No se inventan
urgencia, hallazgos, firma, fecha de cierre o consecutivo oficial. El número usa
el oficio existente o «Pendiente de asignar», y es editable dentro del informe.

**Guardar** agrega una versión del informe interno. El menú **Exportar** descarga
el contenido actual, incluso las ediciones no guardadas, como Word o PDF; exportar
no guarda. Word conserva párrafos nativos, títulos con jerarquía institucional,
metadatos alineados, negrita/cursiva y listas. PDF conserva la jerarquía, los
metadatos alineados y el ajuste de líneas. Ambos formatos mantienen A4; Word usa
márgenes de 20 mm y fuente Arial 11. `docx@9.15.2` se carga solo al solicitar la
descarga; manifiesto y lockfile actualizados.

La detección de cambios toma el Markdown serializado por `getMarkdown()` al crear
Tiptap como referencia inicial y compara con esa misma serialización en cada
edición; hidratación o normalización del documento no activa la confirmación,
mientras que texto y formato sí. Al guardar se actualiza la referencia persistida;
un error la conserva. Una plantilla
nueva puede guardarse aunque aún no se haya editado, pero cerrar sin cambios no
requiere confirmación. Exportar no limpia los cambios pendientes. La confirmación
de salida es un diálogo blanco propio de esta vista: Escape, X y «Volver al editor»
cancelan el cierre; el fondo no lo cierra. Sus acciones ocupan dos columnas iguales:
descarte secundario en rojo discreto y retorno al editor como acción primaria.

El informe ahora pagina visualmente en hojas A4 con `tiptap-pagination-plus@3.1.0`.
Cada hoja conserva 210 × 297 mm, márgenes de 20 mm, borde gris sutil en sus cuatro
lados y pie numerado; las páginas se separan por 16–24 px sobre el fondo gris del
lienzo, incluso la última hoja conserva su borde inferior. El lienzo permite
desplazamiento horizontal cuando la pantalla es más estrecha que la hoja. La
paginación solo se activa en este documento, no altera el Markdown persistido ni
las exportaciones. Un ciclo de vida compartido elimina estilos globales del
paquete al desmontarse el último editor paginado y evita duplicarlos si hay más
de una instancia.

Guardar/exportar no aprueba una resolución, no publica la respuesta ciudadana, no
adjunta un oficio firmado, no envía correo ni modifica la revisión de la queja.
La conclusión la redacta el evaluador. Las firmas/sellos externos quedan fuera
de esta función.

## Persistencia y autorización

- `GET /api/quejas/informe?quejaId=UUID`: último informe, o null confirmado.
- `PUT /api/quejas/informe`: `quejaId`, `version` esperada, `fuenteRevision` y
  `contenido` Markdown (máximo 100.000 caracteres). Lecturas/respuestas privadas
  `no-store`; stream JSON acotado también sin Content-Length.
- Ambos métodos validan Bearer/perfil activo y rol real `admin`/`calidad` antes
  del cliente privilegiado. Después comprueban la entidad. El autor usa
  `usuarios.id`, nunca el ID Auth ni un campo enviado por el navegador.
  Calidad requiere además `permisos.leer` de Quejas para GET y
  `leer`+`escribir` para PUT; admin conserva su autorización. Esta comprobación
  reproduce el permiso efectivo observado en el preflight y falla cerrada.
- `queja_informes` conserva versiones por PK `(queja_id, version)`, fuente,
  autor y fecha DB. RLS activa, sin grants/policies para anon/authenticated;
  service_role conserva únicamente SELECT/INSERT. No hay UPDATE/DELETE/TRUNCATE.
  La API es el consumidor autorizado; no se añade RPC público ni definer.
- Comparación explícita de versión y PK arbitran guardados simultáneos. Conflicto
  409 conserva el borrador; no se relee una revisión para forzar otro guardado.
  Tras un envío incierto se consulta/compara la versión antes de reintentar.
- Cambios de datos remotos no reemplazan el texto abierto. Cambios posteriores
  de la queja muestran aviso sobre su revisión de origen. Cerrar con ediciones
  pide descartar o volver; durante guardado/exportación el cierre se bloquea.
- El historial se conserva en DB; la interfaz abre la última versión. No se
  implementó todavía un selector para comparar/restaurar versiones históricas.

## Fuentes de edición

Entrada/UI: `app/quejas/components/QuejaDetalleModal.tsx`,
`QuejaInformeModal.tsx`, `QuejaInformeHoja.tsx` y
las reglas `.queja-informe-editor` de `app/styles/components.css`. El modal documental propio vive como variante
encapsulada en `components/Modal.tsx`; Tiptap conserva la barra y el editor activos
de `components/ui/RichTextEditorBody.tsx`. Plantilla/contrato:
`lib/utils/quejaInforme.ts`. Exportación: `lib/utils/quejaInformeWord.ts` y
`lib/utils/quejaInformePdf.ts`. Lectura/claves:
`lib/queries/useQuejaInforme.ts`. Guardado: `lib/services/quejaInformeService.ts`.
API: `app/api/quejas/informe/route.ts`, registrada en `apiAuthentication.ts`.
DDL: `supabase/migrations/20261104001552_queja_informes_editables.sql`.

## Verificación local

- Node **819/819**; once pruebas del informe cubren plantilla literal/fecha civil,
  OOXML editable, permisos antes de efectos, validación, entidad, versiones,
  conflicto concurrente, fallo de almacenamiento y permisos efectivos de Calidad.
  Los dobles de los paneles
  existentes aíslan el nuevo documento sin relajar sus pruebas del workflow.
- PostgreSQL aislado: **23/23** comprobaciones con datos ficticios, ejecutando
  la migración real: grants/RLS, FKs/límites, historial, PK concurrente y ausencia
  de cambios de estado/revisión. No certifica el esquema remoto.
- QA de navegador: **15/15**, con UI/CSS/Tiptap reales y transporte sintético,
  en 1600×1000, 390×844 y 320×844. Plantilla/anexos, guardado, recuperación,
  descarga real, conflicto sin pérdida, descarte cancelable, barra fija y ausencia
  de desborde horizontal/errores JavaScript. No usa sesiones ni datos reales.
- DOCX descargado desde la UI y renderizado con LibreOffice mediante
  `render_docx.py`; revisión visual de todas sus páginas. Se corrigieron los
  metadatos estirados por justificación y el título de conclusión aislado.
- TypeScript, lint, build, estructura y capa visual correctos.
- QA local de paginación con contenido sintético: se verificaron 4 páginas A4 y,
  tras ampliar el contenido, 14; la hoja siguió editable y el viewport móvil
  permitió desplazamiento horizontal. No se usaron sesiones ni datos reales.
- Verificación actual de paginación: una hoja de 794 × 1123 px; al superar su
  capacidad se formaron dos páginas con 18 px entre ellas; al deshacer, volvió a
  una hoja y eliminó la página sobrante. El foco del editor no mostró contorno
  azul. Se usó contenido sintético.
- Suite focalizada `tests/rich-text-editor.test.mjs`: **14/14**; generación de
  tipos Next, TypeScript, lint, build, estructura y capa visual correctos.

Rediseño del editor: pruebas de geometría del modal y anclaje de toolbar/scroll,
apertura/cierre del menú Exportar, exportación DOCX con estilos/tabuladores y PDF
con títulos, metadatos alineados y líneas envueltas. No se pudo comparar contra la
imagen de referencia porque no venía adjunta como imagen; se siguieron las
dimensiones y reglas escritas en la solicitud.

Activación remota: API REST de service role pasó de PGRST205/404 a HTTP 200 sin
leer datos personales. Catálogo efectivo: RLS activa, cero policies cliente,
anon/authenticated sin grants; service_role con SELECT/INSERT y sin
UPDATE/DELETE/TRUNCATE. Una transacción con service_role comprobó dos versiones,
lectura y rechazo por PK duplicada, seguida de ROLLBACK verificado. No se creó
otra queja, no se enviaron correos ni se conservó un informe de prueba.
El advisor [RLS sin policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
es INFO esperado para esta tabla solo de servidor; no se abre acceso cliente para
eliminar ese aviso. Los demás avisos de seguridad corresponden a objetos previos.

Evidencia saneada: `supabase/backups/queja_informe_activation_20261103.json`.
Evidencia local regenerable en `.performance/quejas-word-20261103/` (fuera de Git).
Falta aceptación de guardar/retomar desde la sesión del usuario; no se suplantó
ninguna identidad para probar la API privada. Publicar la web requiere autorización
explícita independiente.
