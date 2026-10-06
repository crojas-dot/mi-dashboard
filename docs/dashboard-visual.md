# Dashboard: calendario y patrones visuales

Se mantiene CoreUI/Bootstrap + Tailwind v4. Estos componentes pertenecen al
dashboard; no son las páginas operativas de Quejas o Mis Quejas.

## Dónde editar

- `components/dashboard/GeneralTab.tsx`: composición del resumen general.
- `lib/constants/dashboardModules.ts`: módulos contables, nombres, rutas y colores CoreUI.
- `lib/queries/useGeneralTotales.ts`: conteos `HEAD` de los módulos visibles sin descargar filas.
- `components/dashboard/QuejasTab.tsx`: distribución, plazos y expedientes de quejas.
- `components/dashboard/QuejasTrend.tsx`: gráfico mensual y tabla desplegable compartidos.
- `components/dashboard/BreakdownChart.tsx`: barras CoreUI con conteos directos.
- `components/dashboard/chartKit.tsx`: tarjetas y opciones comunes de gráficos.
- `components/dashboard/{Sacp,Documentos,Riesgos}Tab.tsx`: otras series del año actual.
- `lib/queries/useModulosAnalisis.ts`: cambios documentales del año en la zona configurada.
- `app/dashboard.module.css`: separación, tamaños y textos propios del dashboard.
- `components/dashboard/plazos.ts` y `lib/timeZone.ts`: calendario civil y presentación de fechas.
- `components/dashboard/useDashboardNow.ts`: refresca rótulos cada minuto visible, sin peticiones.
- `lib/queries/useQuejasAnalisis.ts`: recepción y cierre del año actual con páginas completas.
- `app/configuracion/components/ZonaHorariaEditor.tsx`: selector de región y país.
- `app/api/configuracion/zona-horaria/route.ts`: lectura limitada a esa preferencia y edición de administrador.

## Patrones visuales

- Componer con `CRow`, `CCol`, `CCard`, `CCardHeader`, `CCardBody` y `CCardFooter`.
- Usar `BreakdownChart` para cantidades por categoría o plazo: `CChart` de CoreUI
  con valores visibles en cada barra y eje expresado en registros.
- General usa una barra grande por módulo de gestión: Quejas, SACP, Documentos,
  Riesgos, Auditorías, Procesos y Revisión. Mantener los siete colores estables
  entre barras y enlaces. Mis Quejas es una vista de Quejas, no otro conteo;
  Reportería y Configuración no son expedientes.
- La serie anual y la actividad de Quejas pertenecen a la pestaña Quejas. No
  volver a colocarlas como protagonista de General.
- Usar `QuejasTrend` para ambas vistas. Muestra enero hasta el mes actual del
  año en la zona configurada, conserva los meses con cero y ofrece una
  tabla CoreUI dentro de `CAccordion`, sin depender del cursor para leer cantidades.
- Las series de SACP, Documentos y Riesgos usan `seriesDelAnio` de `chartKit.tsx`;
  la función comparte el mismo calendario civil y deja los meses sin datos en cero.
- Mantener `Chart.tsx` con carga diferida y alturas reservadas. No agregar otra
  biblioteca de gráficos ni importar Chart.js desde una página operativa.
- Colores y palabras deben comunicar juntos. Evitar abreviaturas, fórmulas y
  porcentajes que mezclen grupos diferentes.
- Los fallos se muestran con `ErrorState` y reintento; no convertirlos en listas vacías.

## Significado y límites de los datos

- General muestra totales de registros visibles para el rol o vista activa,
  tanto abiertos como cerrados. No es un gráfico de cumplimiento. Usa consultas
  de conteo sin transferir filas y falla de forma visible si alguna falla.
- Los plazos secundarios se refieren a hasta ocho expedientes de Quejas y SACP;
  no son un total de vencimientos del sistema.
- El análisis consulta recepciones y cierres de forma independiente. Un cierre
  del año actual también cuenta si la queja se recibió en un año anterior.
- Los estados, categorías y expedientes destacados de Quejas se refieren a las
  quejas recibidas en el año actual; el total histórico de la RPC se etiqueta aparte.
- La consulta pagina las filas en bloques ordenados para superar el límite
  habitual de respuesta de la API sin truncar el gráfico silenciosamente.
- El campo histórico `series.resueltas` cuenta fechas de cierre, por eso su
  etiqueta visible es **Cierres registrados**. No equivale a contar estado Resuelto.
- Mostrar Resuelto, Finalizado y Cerrada separados según los estados recibidos.
- Los indicadores históricos de la RPC tienen alcance distinto al gráfico mensual.
- La zona horaria se guarda como `org.zona_horaria` en `configuraciones_sistema`.
  Su tabla tiene RLS de administrador; la API permite leer únicamente esa clave
  a los usuarios autenticados y solo el administrador puede cambiarla. Si la
  clave todavía no existe se usa Costa Rica hasta que se guarda una elección.
- Los plazos comparan `fecha_sla` con el reloj en la zona configurada. No calculan cumplimiento contractual
  ni reemplazan las reglas de SLA. Una fecha sin hora conserva el día local completo;
  un timestamp conserva su hora. Una fecha ausente se muestra como Sin fecha.
- La preferencia del dashboard no cambia cálculos transaccionales de SLA en la base.

## Verificación

`npm test`, `npx eslint components/dashboard`, `npm run check:styles`, `npm run build`.
Las pruebas de plazos, cambio de año, paginación y permisos del endpoint están
en `tests/dashboard-*.test.mjs` y no mutan la base real.
