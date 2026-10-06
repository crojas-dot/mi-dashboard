# Rendimiento y estabilidad: comparación de producción

## Referencia verificada

El remoto [crojas-dot/mi-dashboard](https://github.com/crojas-dot/mi-dashboard/tree/b1f5ec84dd87d16f29e1544f92b26c2402432939) devolvió `b1f5ec84dd87d16f29e1544f92b26c2402432939` para HEAD/main durante la revisión. Se exportó ese commit a `.performance/original` sin modificar la rama ni el trabajo local.

Se compiló el original y el híbrido con Next.js 16.2.12/Turbopack y las dependencias instaladas. En la copia original solo se ajustó `turbopack.root` para resolver el directorio compartido de dependencias. No se modificaron sus componentes. La copia no recibió credenciales de servicio; solo las variables públicas necesarias para compilar.

## Tamaño de JavaScript inicial

KiB gzip estimados sumando archivos únicos de entrada por ruta. Incluye runtime común; **excluye código diferido**, fuentes, imágenes y respuestas de API.

| Ruta | Original GitHub | Híbrido antes | Carga al clic (anterior) | Código listo al abrir (revisión previa) |
| --- | ---: | ---: | ---: | ---: |
| Dashboard | 244.6 | 279.5 | 251.0 | 251.4 |
| Login | 243.8 | 275.5 | 247.3 | 247.7 |
| Quejas | 258.0 | 289.3 | 254.2 | 269.8 |
| Mis Quejas | 287.8 | 318.6 | 250.0 | 299.2 |
| Configuración | 258.3 | 290.9 | 259.7 | 269.1 |
| Documentos | 246.8 | 279.2 | 256.6 | 257.0 |
| SACP | 246.5 | 279.3 | 253.7 | 256.6 |
| Usuarios | 249.7 | 281.2 | 252.7 | 258.9 |

La carga al clic reducía el JavaScript inicial, pero trasladaba la descarga a la primera apertura y mostraba «Abriendo…». La versión actual prioriza esa interacción: los formularios, detalles y pestañas se importan estáticamente desde su ruta. Aumenta el JS inicial de esa página y elimina esa descarga del clic. Sigue por debajo del híbrido previo a las optimizaciones, pero por encima del original. **No significa que el sistema completo sea más rápido que el original en todas las condiciones.** El CSS híbrido sigue siendo mayor: aproximadamente 52–55 KiB gzip frente a 18.5 KiB del original. Se conserva CoreUI completo, como requiere la arquitectura.

`AuthenticatedLayout` y las gráficas siguen diferidos. Los formularios están incluidos en su ruta y `DeferredMount` aplaza solo el montaje hasta abrirlos, sin temporizador ni importación asíncrona. Quejas/Mis Quejas precargan los datos del expediente señalado por hover/foco; se eliminó la precarga de todas las filas, que lanzaba hasta 50 consultas simultáneas. Las consultas de secciones remotas no bloquean la apertura con los datos de la fila. El tamaño inicial estático no mide el tiempo hasta tener la vista autenticada completa y no equivale a una mejora medida de FPS, INP o latencia de base de datos.

## Correcciones funcionales verificadas

- Formularios y paneles habituales listos con la ruta; montaje al primer clic y estado conservado tras cerrar según las reglas de cada formulario.
- La apertura habitual no suspende por descarga de código ni necesita el aviso «Abriendo…».
- Paginación CoreUI con botones que conservan eventos, atributos y estado deshabilitado.
- Modales anidados: Escape consume solo el diálogo superior, sin desbloquear el scroll de su padre.
- Acción del encabezado actualizada y limpieza identificada por página.
- Caché invalidada recuperada al volver, prefijos Realtime sin consultas duplicadas, lotes conservados al navegar y sincronización después de reconectar.
- Búsquedas cancelables, desempate estable por id al paginar y filtros escapados.
- Respuestas IA y otras operaciones pendientes aisladas por apertura de expediente, incluyendo A→B→A. Las mutaciones confirmadas siguen invalidando sus datos originales.

## Validación y reproducción

33 pruebas de regresión aprobadas, ESLint focalizado sin errores y compilación de producción completada con TypeScript. `check:styles` pasó en la revisión visual previa; esta corrección no modifica CSS. En navegador se verificó la primera apertura del formulario real `NuevaQuejaModal` en una prueba aislada sin conexión a servicios, además de cierre de modales anidados y conservación del borrador de un formulario de prueba al reabrir. No se ejecutaron mutaciones contra producción ni una sesión autenticada de extremo a extremo. No se ha medido una latencia de cero milisegundos: se eliminó la descarga diferida del código de estas interacciones.

```powershell
npm test
npm run check:styles
npm run build
npm run audit:bundle -- --label actual --output .performance/actual.json
node scripts/audit-bundle.mjs --build-dir .performance/original/.next --label original
```

Los JSON de esta ejecución están en `.performance/` (ignorado por Git). La comparación registra el estado de esta revisión; futuras compilaciones pueden cambiar los valores. Para mantenimiento visual, seguir [visual-patterns.md](visual-patterns.md).

## Actualización: mantenimiento y seguridad — 18 septiembre 2026

Se separaron tokens/base/puente CoreUI sin cambiar valores ni orden de cascada. Los errores de listados, expedientes y configuración usan ErrorState; los errores HTTP conservan status. El servidor rechaza perfiles inactivos incluso con un token válido. Las búsquedas de usuarios se cancelan y los errores permanentes conocidos no se reintentan automáticamente. Se mantienen importaciones estáticas de formularios y charts diferidos.

41 pruebas aprobadas; ESLint focalizado, check:styles, TypeScript y build correctos. Servidor de producción local: /login respondió 200 y /api/usuarios sin sesión respondió 401; se comprobaron nosniff, Referrer-Policy, ausencia de X-Powered-By y private/no-store en la API. No se ejecutaron mutaciones reales ni cambios de BD.

La nueva comprobación interactiva no se completó: el plugin Browser disponible en el catálogo carece de scripts/browser-client.mjs. Las comprobaciones de navegador descritas arriba corresponden a la revisión anterior; no validan la nueva presentación de errores. Los componentes nuevos sí se renderizaron en las pruebas automatizadas.

| Ruta | JS inicial KiB gzip | CSS KiB gzip |
| --- | ---: | ---: |
| / | 257.0 | 53.0 |
| /login | 251.0 | 52.0 |
| /quejas | 275.9 | 54.3 |
| /mis-quejas | 302.9 | 54.7 |
| /configuracion | 273.2 | 53.5 |
| /documentos | 263.1 | 53.5 |
| /sacp | 260.3 | 53.5 |
| /usuarios | 262.3 | 53.5 |

Los mensajes y componentes compartidos aumentan la entrada JS aproximadamente 3–6 KiB gzip frente a la revisión previa. Las mejoras de red reducen trabajo obsoleto y reintentos, pero no constituyen una medición de latencia total ni garantizan ser más rápido que el original. Resultado reproducible: .performance/maintainability-security.json.
