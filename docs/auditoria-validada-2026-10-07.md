# Auditoría validada — 7 de octubre de 2026

Se contrastó el informe aportado con el checkout local, el commit anterior y metadatos del proyecto Supabase vinculado. Esta revisión aplica mejoras de código. No crea el módulo Seguridad y Estado. El propietario autorizó después el endurecimiento de DB; el frontend/API compatible se publica antes de cerrar ai_* en DB. La aplicación remota de las migraciones se documenta solo después de verificarla.

## Qué se verificó del informe

| Afirmación | Resultado y decisión |
| --- | --- |
| La clave pública Supabase es un secreto crítico | Incorrecto. La clave pública identifica la aplicación; los permisos efectivos dependen de Auth, grants y RLS. La service role y las claves IA sí requieren protección. Ver [API keys de Supabase](https://supabase.com/docs/guides/getting-started/api-keys). |
| Falta RLS en todas las tablas | Incorrecto: la inspección anterior verificó 33/33 con RLS. Sí existen políticas demasiado amplias; habilitar RLS por sí solo no cierra ese acceso. Ver [RLS y privilegios](https://supabase.com/docs/guides/database/postgres/row-level-security). |
| Dashboard no cancela y tiene N+1 | No se confirmó. Sus cuatro recursos compartidos ya tenían signal y deduplicación; estadísticas/actividad son recursos adicionales. Las pruebas del SDK real verifican reutilización y carga independiente. Sí se extendió cancelación a lecturas operativas. |
| No hay retry | Incorrecto: retryRead ya limita reintentos recuperables y excluye autorización/validación; mutaciones no reintentan. Añadir tres retries indiscriminados demoraría errores definitivos. |
| Las tablas cargan todos los registros | Incorrecto en los seis listados operativos: ya paginaban de 25 en 25. No se añadió virtualización para páginas de 25. Usuarios y algunos lectores legacy requieren medición aparte. |
| ReactMarkdown ejecuta scripts por defecto | No se confirmó con su configuración activa: sin rehype-raw ni transformaciones inseguras. Cuatro pruebas sintéticas cubren HTML y URLs peligrosas. Su [documentación de seguridad](https://github.com/remarkjs/react-markdown#security) distingue los defaults de plugins/configuraciones inseguras. |
| Un RPC invocado prueba SQL injection | Incorrecto como conclusión. Se necesita analizar SQL/inputs/ACL. Sí se corrigió la construcción de filtros or().ilike; es un problema de gramática de filtros, no evidencia de ejecución de SQL arbitrario. |
| Hay que pasar todos los estados a Zustand | No justificado. Formularios locales, estado remoto en TanStack y sesión en Zustand conservan responsabilidades distintas. No se duplicó la caché ni se globalizaron borradores. |
| dynamic(AuthShell, ssr:false) en el layout servidor | Incompatible con la guía de la versión instalada y con la presentación inicial protegida. Se mantuvo el guard actual. |
| CSRF exige otra arquitectura de Server Actions | No se demostró ese exploit en las API actuales con Bearer explícito. No se añadió una segunda arquitectura por esta afirmación; cookies/SSR necesitarían su análisis propio. |
| Funciones largas, memoizar cuatro valores, añadir SDKs | No son vulnerabilidades ni cuellos de botella medidos. No se incorporaron herramientas de pago, PWA, animaciones o bibliotecas de UI por disponibilidad. |
| Preparación para producción 65–70% | No tiene una medición reproducible. Se sustituyó por resultados concretos y pendientes. |

## Mejoras aplicadas

1. Actualización compatible de Next y eslint-config-next a 16.3.6 y dependencias transitivas vulnerables. npm audit --omit=dev devuelve 0. La auditoría total mantiene 5 entradas high de herramientas de desarrollo, una cadena ESLint/fast-glob/micromatch/braces con [aviso pendiente](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm); no se usó npm audit fix --force ni overrides que rompan compatibilidad.
2. AbortSignal real en consultas y precarga operativas, además del dashboard existente. Las funciones de query reciben contexto y pasan únicamente signal al transporte. Adjuntos dejan de usar TTL infinito en precarga y comparten 30 s con su hook.
3. Filtros seguros de folio/cliente en Quejas y nombre/email en Usuarios: comas, comillas y paréntesis no cambian la expresión. Los comodines de búsqueda existentes siguen habilitados.
4. Realtime agrupa eventos durante 750 ms sin inanición de ráfagas, compacta prefijos, resincroniza tras reconectar y conserva invalidación pendiente al desmontar sin refetch de pantalla cerrada.
5. Altas de Procesos, Auditorías, Riesgos, Reuniones, SACP y Documentos: validación consistente, bloqueo síncrono de duplicados, try/catch/finally, borrador/error accesible, cierre bloqueado mientras guarda y distinción entre INSERT exitoso y refresco fallido. No impone longitudes arbitrarias a los datos de negocio.
6. API Usuarios valida todos los campos antes de efectos Auth/DB, permite solo roles/estados conocidos y UUID válido, envía email+contraseña juntos y no actualiza perfiles para un reset exclusivamente Auth. Contraseñas temporales criptográficas, errores sanitizados y respuestas no-store.
7. Gestor IA trasladado a API admin con perfil activo: respuestas sin claves guardadas, conexiones/descubrimiento/limpieza en servidor, JSON limitado a 1 MiB y validación de HTTPS/hosts permitidos. El campo vacío conserva la clave; el admin puede introducir una nueva. Guardado con revisión explícita y comparación condicional de xmin (versión MVCC, verificada por lectura de metadatos en el proyecto) conserva consumo, rechaza carreras con 409 y no fuerza una revisión nueva. Usa la tabla existente y no depende de un nuevo RPC.

## Endurecimiento DB autorizado, en preparación

La política remota configuraciones_sistema_select USING(true) sigue permitiendo lectura directa a authenticated. Por tanto la máscara y la API nueva **no cierran por sí solas la exposición de claves IA en DB**. La consulta remota de esta revisión solo leyó políticas, nunca valores de claves o datos de usuarios.

La revisión automática rechazó generar una migración amplia porque reemplazaba RLS en numerosas tablas, añadía constraints y cambiaba acceso a credenciales IA sin una autorización suficientemente precisa. El propietario autorizó explícitamente completar ese alcance el 7 de octubre. Se prepararon las dos migraciones y las pruebas; recuperar OAuth del MCP sigue siendo necesario para ejecutar y verificar SQL remoto.

El alcance propuesto para revisar y autorizar es:

| Tablas | Regla propuesta |
| --- | --- |
| acciones, riesgos, procesos, reuniones, hallazgos | Perfil activo y lectura/escritura del módulo correspondiente, con autoridad de admin activo. |
| documento_versiones, versiones_documentos, solicitudes_documentales | Permisos del módulo Documentos; revisar sus dos modelos de versiones antes de unificarlos. |
| tareas | Admin activo o lectura propia del responsable; administración solo admin. Su UI no está integrada. |
| catalogos, sla_config | Lectura por cuentas activas, cambios solo admin activo; conservar categorías ciudadanas activas. |
| formularios_publicos | Lectura ciudadana de formularios activos y administración exclusiva admin. |
| configuraciones_sistema | Datos ordinarios de configuración solo admin activo; claves ai_* reservadas al servidor después de desplegar el gestor/API compatible. |

También se proponen checks conservadores para nuevas escrituras: textos obligatorios no vacíos, fechas de auditoría ordenadas, escalas de riesgos 1–3, seguimiento 0–100 y plazos positivos. No se propone eliminar ni reescribir registros históricos. Requiere revisar datos existentes y probar roles/lectura/escritura con rollback antes de aplicar. Una política estricta adicional no neutraliza otra permisiva combinada con OR.

## Verificación y límites

| Comprobación | Resultado |
| --- | --- |
| Commit anterior 2faae41, suite completa con mismas dependencias instaladas | 119/156, 37 fallos. |
| Checkout auditado, suite completa | 199/222, 23 fallos ya presentes antes; 14 fallos resueltos y ninguno nuevo en esa suite. |
| Pruebas nuevas de lecturas, formularios, Markdown, Usuarios y API/UI IA | Pasan; incluyen transporte SDK real y datos de red sintéticos. |
| Producción Next/TypeScript | Compilación correcta. |
| Lint | 0 errores, 2 advertencias históricas de .experiments/src/_nav.tsx. |
| Capa visual | 114 archivos React verificados, sin imports/clases legacy en la capa activa. |
| Chrome aislado, sin sesión real | Ruta privada redirige a login; recarga sin errores de runtime. |
| HTML inicial /, /quejas, /usuarios, /procesos | Presentación neutral; no anticipa login ni monta contenido privado. |
| APIs locales sin Bearer | Configuración IA GET/PUT/POST y Usuarios GET: 401. Los métodos registrados también prueban token inválido con dobles de Auth. |

Los 23 fallos restantes incluyen contratos de prototipos/fixtures, un contrato de carga diferida y aislamiento de respuestas IA/subidas/transiciones/notas en paneles de quejas. Este último es deuda de confiabilidad real: useEntityRequestGuard existe pero aún no está integrado allí. No se presenta como corregido por estas mejoras de formularios.

No se usaron datos de negocio ni sesión real en las pruebas, no se ejecutaron conexiones de IA de pago y no hay benchmark autenticado con miles de registros. El rate limit propio sigue por instancia, la protección de último admin no es una transacción entre Auth y DB y la telemetría persistente sigue fuera de esta etapa. Las consultas directas legacy y la configuración de Auth externa requieren auditorías específicas. El build local no demuestra despliegue en Vercel.
