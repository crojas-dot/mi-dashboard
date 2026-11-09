# Alcances propuesta inicial del producto

Revisión del 10 de octubre de 2026. Propuesta de arquitectura, no implementación.
Fuente: PDF aportado por el propietario, alcance LE-002, 16 páginas. El documento
muestra el resultado publicado, no define por sí solo roles ni aprobaciones internas.

## Información observada

- Certificado e identificación del organismo, norma, acreditación inicial y sedes.
- Tabla técnica: matriz/producto; código/analito/propiedad/tratamiento; LD/LC/rango;
  método y técnica; sede o ubicación. Hay unidades, NA, textos largos y agrupaciones.
- Historial de ampliaciones, reducciones, suspensiones y levantamientos, con motivos,
  acuerdos y fechas. Algunos cambios afectan solo determinados ítems.
- Versión 07 y fecha 2020.12.17 identifican el formato ECA-MP-P09-F01; no son la
  versión y fecha vigente del contenido técnico del alcance. Historial hasta 2026.06.09.
- Exportación con encabezados repetidos, paginación, historia y cierre institucional.

## Modelo recomendado

| Entidad | Responsabilidad |
| --- | --- |
| Organismo y sedes | Identidad, tipo, norma y ubicaciones |
| Expediente de cambio | Solicitud, motivo, responsables y estado del trámite |
| Versiones del alcance | Borradores y contenido aprobado inmutable |
| Ítems de versión | Datos técnicos, orden, sede y condición técnica |
| Revisiones y decisiones | Actor, fecha, comentario, acuerdo y versión evaluada |
| Publicaciones | PDF, versión de contenido, plantilla, fecha y huella del archivo |

Separar el estado del trámite, la condición técnica de acreditación y la publicación.
Ejemplo de trámite para validar con ECA: Borrador → Revisión técnica → Aprobación →
Publicado, con devoluciones para corrección. No atribuirle carácter de flujo oficial.
Una suspensión parcial no es simplemente devolver el documento a borrador.

Aprobación, publicación y firma digital son operaciones diferentes. Una firma debe
validarse con su mecanismo real; un nombre o imagen en el PDF no la implementa.

## Invariantes del flujo

- Validar transiciones y permisos en servidor/DB, no solo en botones.
- La decisión identifica exactamente la revisión aprobada; un cambio posterior
  exige otra revisión, no modifica silenciosamente lo ya aprobado.
- Historial de actor/fecha/acción/motivo y control de concurrencia por revisión.
- Publicación generada desde un snapshot aprobado, con orden y versión de plantilla
  congelados. Conservar el PDF anterior y su identidad; no sustituirlo en Drive.
- Roles iniciales propuestos: administrador, editor, revisor técnico y aprobador;
  definir con ECA si hay separación obligatoria entre quien redacta y quien aprueba.
- Datos estructurados en DB; documentos y PDFs en Drive/Storage privado con acceso
  verificado por expediente. Un enlace público solo muestra la publicación autorizada.

## Parametrización acotada

Para el MVP, comenzar con el perfil de laboratorios de ensayo del ejemplo. Campos
comunes en tablas normales; JSONB pequeño para configuración y datos específicos
validados por perfil. Parametrizar etiquetas, orden, campos opcionales y plantilla.
No almacenar toda la aplicación en un JSON ni construir un editor universal de
columnas/estados antes de conocer otros tipos reales de alcance.

Conservar unidades, precisión y expresiones NA/rango. No convertir automáticamente
texto técnico en flotantes ni tratar una norma/método repetido como una actividad única.

### Editor de tablas y exportación fija

La visión actual del propietario es un editor sencillo de varias tablas, con
campos configurables y salida al formato institucional. Es viable dentro de
Alcances, con configuración acotada y versionada.

- Administrador define perfiles de tabla: ID estable de columna, etiqueta, tipo,
  unidad, obligatoriedad y presentación. Mantener IDs al cambiar etiquetas.
- Usuario agrega, duplica y ordena tablas de un perfil; edita filas y puede pegar
  datos tabulares. El número de tablas surge de secciones existentes, no exige
  reservar tablas vacías antes de empezar.
- Mostrar índice de tablas, área central de edición y vista previa del documento.
  Separar el editor de celdas del editor de párrafos; Tiptap no es el motor del grid.
- Guardar filas/secciones con identidad y revisión, no un único JSON de todo el
  expediente por cada pulsación. JSONB acotado para campos variables validados.
- Congelar la versión de contenido, perfil y plantilla al aprobar. Cambiar un
  campo de configuración después no reinterpreta publicaciones anteriores.
- Renderer independiente compone PDF desde esa revisión y plantilla: encabezados,
  pies, numeración y tablas multipágina. Conservar el PDF publicado en Drive.

Contenido variable no equivale a espacio infinito: definir ancho de columnas,
texto extenso, símbolos/unidades, continuación de filas y orientación. No ocultar
contenido ni achicar letra indiscriminadamente para forzar que quepa. Una columna
nueva necesita mapeo aprobado a la salida; el formato fijo no se adapta por magia.

MVP: un perfil real de laboratorio, varias tablas, edición/pegado de filas, validación,
comparación de cambios, revisión/aprobación y PDF oficial. Fórmulas, macros, celdas
combinadas arbitrarias y diseñador libre de plantillas no son requisitos confirmados.

Prueba vertical previa: expediente sintético con varias tablas y texto largo →
conflicto de dos editores rechazado → revisión/aprobación → PDF multipágina →
archivo privado en Drive → usuario exclusivo de Alcances sin acceso a Quejas.
Esa prueba confirma UX, exportación y aislamiento; la factibilidad arquitectónica
no sustituye medirlos ni significa que el editor ya esté construido.

## Organización del producto

Si ECA quiere aplicación y entrega independientes, recomendar deployment y proyecto
Supabase separados, reutilizando código de UI, autenticación, guards, permisos,
concurrencia y acceso a archivos. Usuarios, RLS, secretos y workflows se configuran
para la nueva aplicación; no copiar expedientes de Calidad ni asumir IDs compartidos.
Si exige un portal único con los mismos usuarios, evaluar antes el módulo integrado.
Un deployment nuevo no obliga técnicamente a una DB nueva.

### Evaluación de integración en ECA-QMS

La revisión de código del 10 de octubre confirma que **integrarlo es viable**.
Si la organización, administración y comunidad de usuarios son las mismas, la
opción recomendada es un módulo independiente dentro del portal y proyecto
Supabase actuales. La propuesta separada anterior aplica a un producto que deba
administrarse o entregarse de forma independiente, no a cualquier módulo nuevo.

| Pieza | Reutilización |
| --- | --- |
| Auth, perfiles, login/logout | Compartir identidad y verificación de activo |
| Shell, kit Tailwind y controles | Compartir componentes, tokens y modales |
| Queries/servicios/caché | Compartir patrón; claves y consultas propias de Alcances |
| Transporte Drive | Compartir cliente y privacidad; carpetas/registro/autorización propios |
| Permisos | Ampliar leer/escribir con capacidades de redactar, revisar, aprobar y publicar |
| Máquina de estados | Implementar reglas de Alcances con el patrón de revisión esperada |
| Versiones y publicaciones | Crear modelo propio, snapshot aprobado y exportación reproducible |

La DB consultada en modo lectura ocupa aproximadamente **17 MB**. Esa medición
no demuestra rendimiento bajo concurrencia ni estima el crecimiento futuro.
El límite publicado de DB Free es 500 MB; archivos finales pueden vivir en Drive,
mientras Postgres conserva datos, decisiones, referencias y versiones acotadas.

Cambios necesarios antes de integrarlo:

- Registrar ruta/módulo y permisos explícitos, guard API por acción y RLS por
  expediente/participación. El menú o la vista simulada no conceden autorización.
- Mantener el rol global existente y agregar capacidades propias de Alcances;
  un aprobador de Alcances no debe recibir por ello permisos de Calidad.
- Dar destino autorizado después de login a quien solo tenga acceso a Alcances:
  la ruta de respaldo actual solo considera Mis Quejas y Dashboard.
- Usar tablas propias para expedientes, ítems, versiones, participantes, eventos
  y publicaciones, dentro de las capas actuales. Cambios de DB aditivos y probados.
- No usar qms_stage_runs como motor universal: su case_id tiene FK a quejas y sus
  policies/funciones dependen de Quejas. Compartir invariantes de concurrencia y
  auditoría no exige generalizar ese motor durante este primer lanzamiento.
- No conectar adjuntos de Alcances a los endpoints de Drive de Quejas: hoy están
  ligados a queja_adjuntos, responsable y carpeta de ese módulo. Crear guards y
  registro específicos usando el transporte común.
- Cargar consultas y editores al abrir el módulo; generar PDF a petición, con
  límites, y evitar consultas permanentes para usuarios que no lo usan.
- Estabilizar el contrato local pendiente de Quejas antes de una publicación
  conjunta. Las regresiones deben cubrir ambas superficies y separación de accesos.

Compartir deployment y DB implica compartir recursos y posibles fallos de servicio.
Separar vuelve a ser conveniente si se necesita aislamiento operativo, otras
organizaciones, administración independiente o publicaciones totalmente separadas.
No se añadió una ruta, tabla ni permiso de Alcances durante este análisis.

Supabase Free permite dos proyectos activos; comprobar el cupo disponible y prever
entorno de pruebas local. [Referencia oficial](https://supabase.com/docs/guides/platform/billing-faq).

## Primer ciclo de entrega

Validar actores y un flujo institucional → modelo de expediente/versiones/ítems →
tabla editable acotada → revisión con comparación de cambios → aprobación bloqueada
por revisión → exportación del PDF aprobado → archivo/publicación e historial.
La reutilización de Calidad reduce trabajo de infraestructura, no reemplaza validar
las reglas propias de Alcances ni implica que este nuevo módulo ya esté construido.
