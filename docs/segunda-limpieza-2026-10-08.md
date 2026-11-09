# Segunda limpieza y confiabilidad — 8 de octubre de 2026

Se continuó la revisión anterior y los cambios que el usuario guardó en 890a7de.
No se reemplazó su encabezado de modal oscuro ni se ejecutaron cambios DB.

## Resultado de código

- 290/290 pruebas globales, sin skips. Las seis carreras previas de Quejas están
  corregidas y la suite específica cubre 23 escenarios de visita, ámbito, locks,
  borradores e invalidaciones. No se retiraron pruebas fallidas.
- Guard de visita distinto de ámbito de datos: A→B→A y cierre invalidan UI; navegación
  en el mismo QueryClient conserva invalidación del origen confirmado. Logout/rol/vista
  invalidan el contexto antes de limpiar caché. WeakMap contiene solo vigencia, sin datos.
- IA/chat de colaborador y acciones de adjuntos se separaron en hooks específicos.
  Dos paneles reutilizan subir/borrar/descargar y validación de selección. Revisión
  capturada al enviar, sin releer/reintentar; selección no retrocede una revisión mayor.
- Informes cancelan catálogos/lotes, rechazan generación duplicada y descartan resultados
  tras cambiar filtros/módulo/visita. Cambiar módulo limpia filtros propios, conserva
  fechas/inclusiones; Atrás cancela. Filtros de estado repetidos usan la configuración
  canónica y controles Field/Input/Select; botón Generar muestra operación real.
- Notificaciones propagan fallos y confirman filas individuales; bulk vacío es idempotente.
  Error no invalida la bandeja como si hubiera éxito. Header consume mutate con manejo
  seguro, sin rechazos Promise sin capturar.
- Gestor IA separa editor de proveedor, routing y test de modelos; efectos/secretos/revisión
  permanecen en su capa existente. Routing copia el nodo cambiado, usa índice Map por ID
  y autoselección consistente; modelos se normalizan con Set estable sin duplicar IDs.
- Cuatro fallbacks de error reutilizan RouteErrorFallback/ErrorState y tokens, sin emoji
  decorativo ni error crudo. Se quitaron Sparkles/Brain/adorno de IA de configuración
  y paneles, conservando funciones. Formularios usan campos con labels asociados.
- Retirados exports sin consumidor createQueryKey/crearNotificacion. Auditor: 185
  fuentes, 29 entradas y 185 alcanzables; ningún fuente huérfano detectado por imports
  literales. No se añadieron dependencias ni una segunda arquitectura de datos.
- Guía extensa duplicada preservada en histórico; AGENTS carga solo entrada/reglas,
  mapa y referencias por tema. Comentarios cubren revisión, visita, scope, idempotencia
  y límites importantes, sin narrar cada línea.

## Verificación y límites

TypeScript, lint, build Next16.3.8, estructura y capa visual correctos. Playwright
con fixtures de componentes reales/CSS de producción: 1366 y 395px, sin overflow
del documento, controles asociados, ningún icono IA decorativo ni errores del browser.
Root revisó capturas del routing y modal de proveedor; los controles largos hacen
wrap y el diálogo mantiene scroll interno. Navegador/servidor temporal cerrados.

Una pasada local sin credenciales llegó al login en 204–383ms en cuatro URLs privadas
(incluye navegación/redirect/hidratación). No es latencia del panel autenticado ni un
benchmark de Vercel, miles de filas o concurrencia DB. Tests comprueban cuatro lecturas
compartidas del dashboard, 25 filas/listado, cancelación y reportes de hasta 5000.

MCP remoto confirmó metadata RLS/RPC/ACL para evaluar [formularios públicos](evaluacion-formularios-publicos-2026-10-08.md).
También se comprobó lectura anon READ ONLY sin filas privadas y ROLLBACK.
Esa propuesta requiere gateway, CAPTCHA/rate limit, idempotencia y capacidad de adjuntos;
no se activaron protecciones externas ni se revocó el flujo anterior. Último admin
concurrente y operación distribuida Auth/perfil siguen como pendientes distintos.
