# Afinado de rendimiento y confiabilidad — 23 de septiembre de 2026

## Cambios

- Next.js y eslint-config-next: 16.2.12 → 16.3.6. Actualizaciones transitivas compatibles para nanoid, qs, brace-expansion y js-yaml. El lockfile conserva las versiones resueltas. La actualización de Next incorpora correcciones de seguridad, incluido el [aviso oficial para servidores Windows](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36).
- Auditorías, Documentos, Procesos, Reuniones, Riesgos y SACP pasan el AbortSignal de TanStack hasta Supabase. Al abandonar una consulta sin otros observadores, el transporte se cancela; la caché previa se conserva. Procesos mantiene las filas anteriores mientras llega otra página.
- Usuarios: crear/editar/eliminar/restablecer contraseña y activar/desactivar recuperan su estado de espera ante errores. Los guardados tienen bloqueo síncrono contra doble envío y liberación en finally. Las escrituras no se repiten automáticamente.
- Edición propia: FormData omite los controles deshabilitados de rol/estado; el PATCH ahora también los omite, evitando enviar null.
- API Usuarios: valida JSON y todos los campos antes de modificar Auth/perfil. Rechaza roles/estados desconocidos. Correo y contraseña usan una sola actualización de Auth; un reset sin cambios de perfil no envía un UPDATE vacío a PostgREST.
- El patrón está explicado en [visual-patterns.md](./visual-patterns.md), con comentarios en los puntos de concurrencia, validación y cancelación. CoreUI/Bootstrap + Tailwind, imports estáticos de formularios y gráficos diferidos se conservan.

## Validación realizada

| Comprobación | Resultado |
|---|---|
| npm test | 55 pruebas aprobadas |
| npm run build | Next.js 16.3.6, TypeScript y 23 páginas generadas sin errores |
| ESLint sobre los archivos de código/pruebas modificados en este ajuste | Sin errores ni advertencias |
| npm run check:styles | CSS scopeado coincide con CoreUI instalado |
| npm audit --json, incluyendo desarrollo | 0 vulnerabilidades reportadas a esta fecha |
| Producción local: /login | HTTP 200 |
| Producción local: /api/usuarios sin credenciales | HTTP 401, cache-control private/no-store, nosniff, sin x-powered-by |
| Browser: formulario real de UsuarioFormModal en fixture aislado | Abrir, rellenar, fallo de red simulado, conservar datos, guardar de nuevo, cerrar y reabrir sin loading atascado |

Las pruebas de mutaciones utilizan servicios simulados; no crearon usuarios ni cambiaron contraseñas reales. El fixture de navegador comprueba la interacción del componente con CoreUI y las hojas reales de estilo; no representa un flujo autenticado completo en producción.

## Bundle de producción actual

Auditoría reproducible: `npm run audit:bundle -- --label afinado-2026-09-23 --output .performance/afinado-2026-09-23.json`.

| Ruta | JavaScript inicial, gzip estimado KiB |
|---|---:|
| Dashboard | 248.1 |
| Login | 240.9 |
| Quejas | 265.8 |
| Mis quejas | 293.2 |
| Configuración | 263.8 |
| Documentos | 252.4 |
| SACP | 250.2 |
| Usuarios | 252.7 |

Esta medida cuenta chunks iniciales únicos por ruta, no FPS, latencia de base de datos ni tiempo de interacción. No permite atribuir una mejora frente al sistema original sin medir ambos en condiciones equivalentes; cambiaron la versión de Next y otros archivos del workspace.

## Límites y mantenimiento

- Cero avisos de npm es el resultado de la auditoría de dependencias a esta fecha, no una certificación de seguridad integral.
- Auth y el perfil siguen siendo dos servicios/operaciones: validar antes y agrupar campos de Auth reduce fallos parciales, pero no crea una transacción entre ambos. La protección del último administrador sigue siendo una comprobación de lectura/conteo, no un bloqueo transaccional entre solicitudes concurrentes.
- No se modificaron esquemas, políticas RLS ni datos remotos. No se desplegó esta revisión.
- Reiniciar los procesos de desarrollo/producción que ya estaban abiertos para cargar la nueva versión de Next. Los servidores y la pestaña temporales usados en estas pruebas se cerraron.
