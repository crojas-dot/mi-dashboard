# Agenda de hoy — 11 de noviembre de 2026

## Regla vigente: novedades del día y vencimiento cercano

Agenda responde qué requiere una acción nueva hoy y qué está cerca de vencer.
La migración `20261111184056_agenda_hoy_recibidas_y_proximas.sql` aplicada sustituye la
ventana anterior de días naturales; las secciones inferiores conservan su evidencia.

- Nueva queja Recibido creada hoy: Calidad, «Nueva queja por evaluar».
- Asignación de hoy al responsable actual: «Nueva asignación».
- Propuesta en Pendiente de Revisión GC cuyo run terminó hoy con ese evento:
  Calidad, «Propuesta para revisar».
- Devolución GC de hoy en investigación: «Devuelta hoy».
- Aprobación GC de hoy con estado Resuelto: Calidad, «Lista para publicar».
- Auditoría que comienza hoy: «Programada hoy».
- Vence hoy, en un día hábil o en dos días hábiles: ventana continua, con una
  etiqueta exacta para cada distancia. Nunca se muestra un plazo ya vencido.

La fecha de cada novedad proviene del evento correspondiente, no de una fecha
genérica de modificación. Al día siguiente deja de contar como novedad; puede
seguir apareciendo si entra en la ventana de vencimiento. No incluye finalizadas,
No Procede ni tareas lejanas sin novedad de hoy. Conserva una entrada por caso,
prioridad estable y máximo veinte; un motivo de mayor prioridad gana al coincidir.

Quejas consulta el calendario del run asociado al vencimiento persistido, con
`qms_business_day`: respeta fines de semana y feriados de esa versión. Auditorías
no conserva run QMS y utiliza el calendario laboral vigente. No se cambia ningún
vencimiento. Los puntos del minicalendario siguen usando fecha_limite real, no
inventan la fecha de recepción como fecha límite.

Se mantiene invoker, search_path vacío, RLS y EXECUTE solo authenticated. Sin
nuevos grants de tablas ni escrituras de casos/correos. Caché de contrato v3,
cinco minutos; las mutaciones de Quejas invalidan su prefijo dashboard y la
suscripción existente de notificaciones invalida Agenda, sin otro canal o polling.

Verificado en ECA-QMS con lectura bajo rol authenticated y perfil admin activo:
2026-090 aparece una vez como recibida_hoy, fecha límite real 2026-11-16; la
respuesta contiene cinco registros, ninguno vencido/finalizado. Sin identidad
devuelve []; anon no tiene EXECUTE, authenticated sí; invoker se conserva.
Asesores de seguridad antes/después sin hallazgos nuevos. No se crearon casos,
notificaciones o correos de prueba ni se modificaron fechas de negocio.

Validación local: 36 comprobaciones PostgreSQL aislado (eventos del día y su
desaparición, ventana laboral, feriado, versión histórica, RLS, límites, prioridades),
11 pruebas Node, 33 comprobaciones de navegador a 320/390/1440 px, TypeScript,
ESLint y build correctos. DB aplicada; cliente web local sin publicar.
Evidencia: `supabase/backups/agenda_hoy_novedades_activation_20261111.json`.

## Presentación vigente: navegación y pie mínimo

Última corrección del propietario: mes a la izquierda; flechas anterior/siguiente
juntas a la derecha, con superficie de clic 32×32 e iconos 20×20 y tooltip. El pie
del calendario es una sola fila con check circular azul + «X tareas hoy» y «Ver agenda» textual azul
a la derecha. No hay botón relleno ni contador apilado. Check y «Ver agenda» usan
el azul institucional qms-primary; el día seleccionado usa qms-primary
con texto blanco. Ambos lados del pie usan text-xs; «hoy»
hereda el color normal gray-700. Se conserva el check azul y el diseño previo del
pie. No cambia la paleta global ni el backend.

La agenda empieza con cinco tarjetas; solo si hay más aparece «Ver más» al final,
dentro de su contenedor max-h-80 con scroll. Al pulsarlo muestra ahí todos los
registros ya recibidos (hasta veinte), sin otra petición ni navegación a /dashboard.
El foco pasa al primer registro nuevo. Reabrir restablece la lista inicial y el mes.
No hay un pie externo. Esta presentación sustituye los pies y cabeceras anteriores
descritos como historial a continuación; las reglas de datos/permisos se conservan.

Verificación de este ajuste: 10 pruebas Node, 33 comprobaciones de navegador a
320/390/1440 px (ambas vistas), TypeScript, ESLint y build correctos. Sin escrituras
de negocio ni cambios de DB. Interfaz local sin publicar.

## Historial visual anterior

Último ajuste visual: la vista calendario usa exactamente las recetas Tailwind
facilitadas por el propietario. Cabecera con flecha izquierda/mes centrado/flecha
derecha, texto gris, grillas gap-1, días circulares de 32px y puntos de 4px dentro
del botón. Círculo y Ver agenda comparten bg-blue-600; el CTA añade hover blue-700.
El pie tiene borde gray-100 y contador destacado. No utilizar ui-button-primary
en ese CTA: introduciría el azul institucional anterior, distinto al círculo.
Es una excepción local al token de marca, sin cambiar colores globales. Navegación,
selección, conteos, fechas y lista de agenda conservan su comportamiento.
Verificación: 10 pruebas Node y 30 comprobaciones visuales en ambos modos a
320/390/1440 px; el navegador confirma el mismo color computado para el círculo y
el CTA. TypeScript, lint, build y capa visual correctos. Cambio local sin publicar,
sin tocar DB ni reenviar correos.

## Contrato de datos y evidencia del calendario compacto

El calendario conserva ancho máximo 320px, sin altura vacía reservada, semana desde
domingo D/L/M/X/J/V/S, botones de día circulares y flechas juntas para mes anterior
y siguiente. Se puede seleccionar una fecha para consultarla visualmente. Reabrir
restablece el mes y día actuales de Costa Rica; volver desde agenda conserva el mes.

`20261111175442_agenda_hoy_fecha_limite.sql` añade fecha_limite al JSON, como fecha
civil de Costa Rica. Si un evento no tiene vencimiento registrado, devuelve null;
no se inventa una fecha ni un punto para ese registro. RLS y ACL se conservan, y
la vista del responsable excluye propuestas que ya esperan a Calidad. Caché v2
evita reutilizar objetos antiguos sin fecha_limite; mantiene cinco minutos.

Cada fecha muestra un punto del motivo con mayor prioridad: rojo para vence_hoy,
ámbar para vence_en_2_dias y azul para los demás. El calendario muestra los puntos
de la respuesta actual (hasta veinte registros), no promete un inventario de tareas
de cada mes visitado. Las flechas son navegación visual local, sin peticiones RPC.

Calendario: contador y Ver agenda, sin enlace a dashboard. Agenda: cinco tarjetas
iniciales, scroll max-h-80 y Volver al calendario. «Ver más» expande los restantes
dentro del mismo scroll, como describe la presentación vigente al inicio.
Se conservan carga/error/vacío y Escape.

Pruebas de esta entrega: 19 checks PostgreSQL aislado (shape con fecha_limite,
fecha CR/null, permisos, prioridades/límite); 10 Node (meses/años, selección,
prioridades de puntos, fechas inválidas, navegación y pie condicional).
Navegador sintético: 30 comprobaciones de ambas vistas a 320/390/1440 px, ancho
máximo 320px, selección circular, indicadores y pie correcto. TypeScript, lint,
build, estructura y capa visual correctos. SQL aplicado; UI local sin publicar.
Evidencia: `supabase/backups/agenda_hoy_fecha_limite_activation_20261111.json`.

Las secciones siguientes conservan la evidencia de las variantes anteriores;
la presentación vigente está al inicio y el shape actual incluye fecha_limite.

## Backend

Migración aplicada: `20261111172515_agenda_hoy.sql`. `qms_get_agenda_hoy()` retorna
JSONB con hasta veinte objetos y solo id/codigo/descripcion/motivo/ruta. Integra
Quejas y la tabla real de Auditorías; no crea tablas simuladas en producción.
La función es SECURITY INVOKER, search_path vacío y EXECUTE exclusivo authenticated.
Exige identidad y perfil activo; mantiene RLS de las tablas y de qms_quejas.

Fechas calculadas en PostgreSQL, America/Costa_Rica. Quejas usa plazo_vence del
snapshot QMS; no recalcula el SLA. «En 2 días» significa dos días naturales.
Prioridad: vence_hoy, programada_hoy, devuelto_hoy, nueva_asignacion,
vence_en_2_dias. CASE y DISTINCT ON módulo/UUID eligen un solo motivo. Orden estable
por prioridad/fecha/módulo/UUID, LIMIT 20, array vacío cuando no hay coincidencias.
Excluye No Procede/Finalizado/Cerrada y estados terminados de Auditorías.

`qms_private.agenda_eventos_hoy()` es un puente SECURITY DEFINER: comprueba identidad,
perfil activo y autorización explícita de gestión o asignación propia antes de
proyectar UUID y dos booleanos. No devuelve motivos de devolución, propuestas,
destinatarios ni mensajes. La función pública vuelve a filtrar por RLS.
Asignaciones: evento interno_asignacion del outbox para el responsable actual.
Devoluciones: revisiones GC returned de hoy, con estado actual En Investigación.
Sin esos eventos históricos no se inventa una fecha a partir de la creación del caso.
Auditorías aporta programación/vencimiento; no tiene eventos de asignación/devolución
integrados en la agenda. No se cambian policies ni grants de las tablas existentes.

## Cliente y cabecera

Corrección posterior de presentación: el panel inicia con minicalendario, mes/año
actual en Costa Rica, semana desde lunes y día actual marcado. «Tienes X pendientes
para hoy» refleja el array recibido, con carga/error diferenciados. «Ver agenda»
cambia a las tarjetas originales y «Volver al calendario» regresa; el foco acompaña
el cambio. Reabrir restablece calendario. Ambas vistas comparten marco, cabecera de
48 px y cuerpo h-80/max-h-80 adaptable al alto del viewport. No se modifican SQL,
motivos, caché ni permisos. `lib/utils/agendaCalendar.ts` solo proyecta un mes civil
con UTC/Intl; no calcula fechas de negocio ni depende de la zona del equipo.
Verificación de este ajuste: 9 pruebas Node, incluidas transiciones de vista,
reapertura, semana/bisiesto y medianoche CR; 27 comprobaciones visuales en ambos
modos a 320/390/1440 px, con idénticas dimensiones. TypeScript, lint, build,
estructura y capa visual correctos. Continúa local, sin publicar.

- `lib/queries/useAgendaHoy.ts`: cliente browser, signal de cancelación, validación
  estricta de shape/rutas/motivos, clave por perfil y caché de cinco minutos. El
  prefijo dashboard permite reutilizar sus invalidaciones; sin intervalos o Realtime.
- `components/Header.tsx` coordina agenda/notificaciones/usuario: un solo panel abierto,
  clic exterior y Escape con retorno de foco. Al abrir, refresca solo si venció la caché.
- `components/ui/AgendaHoyWidget.tsx`: presentación con datos/callbacks, sin consultas
  ni permisos. Icono calendario y punto rojo solo con elementos. Lista plana con las
  veinte tarjetas, un Link completo por fila, descripción truncada, Badge de motivo.
  Estados de carga/error/vacío independientes; sin diagnósticos remotos en pantalla.
- Scroll max-h-80/overflow-y-auto/overscroll-contain, sin overflow horizontal móvil.
  Colores centralizados en Badge/theme; programación usa el nuevo token índigo.
  `lib/constants/agenda.ts` contiene motivos, etiquetas y tipos, sin dependencias de datos.
- /dashboard es un alias protegido del módulo dashboard que redirige al panel en /.
  No concede otro permiso ni crea otro Dashboard. Las tarjetas van al módulo
  autorizado (/quejas, /mis-quejas o /auditorias); no inventan vistas de detalle.

## Verificación y entrega

PostgreSQL aislado: 17 comprobaciones de RLS propia/staff, inactivos/anónimo,
prioridades/deduplicación, límite, UNION y zona horaria. Node: 19 pruebas de contrato,
caché/cancelación, veinte tarjetas, menús, alias y diccionarios. Navegador sintético:
15 comprobaciones a 320/390/1440 px, scroll real y ausencia de overflow horizontal.
TypeScript, lint focalizado, build, estructura y capa visual correctos.

Lectura remota: RPC invoker, authenticated habilitado, anon cerrado y resultado sin
identidad `[]`. No se crearon registros ni correos reales de QA. SQL activo; cabecera
local, sin publicar Vercel. No es un calendario de edición ni cobertura de toda la
matriz de Calidad. Evidencia: `supabase/backups/agenda_hoy_activation_20261111.json`.
