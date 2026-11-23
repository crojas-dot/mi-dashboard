# Auditoría de seguridad de ECA-QMS

23 de noviembre de 2026 · Una sola organización · Login, sesiones, identidades, permisos y formulario externo

Se probó el build de producción local de Next.js mediante Chromium y solicitudes HTTP reales. PostgreSQL 18.6 ejecutó las migraciones seleccionadas con cuentas y expedientes ficticios. El adaptador local simuló las respuestas del proveedor Auth. También se leyeron los permisos efectivos de los RPC en el Supabase conectado.

| Prueba | Evidencia | Resultado | Severidad | Corrección mínima |
| --- | --- | --- | --- | --- |
| 1. Rutas privadas y APIs sin sesión | Tres rutas redirigieron a Login. Seis APIs respondieron `401`. El navegador quedó fuera del panel privado. | Correcto local | — | — |
| 2. Sesión vencida y cierre | Auth simulado informó vencimiento. La API devolvió `401` y la recarga llevó a Login. El cierre retiró la sesión del navegador incluso con `503` del proveedor. La vigencia remota de JWT ya emitidos depende del flujo de Auth. [Sesiones de Supabase](https://supabase.com/docs/guides/auth/sessions) | Correcto local. Pendiente en servicio alojado | Media | Comprobar expiración y revocación con una cuenta de staging. |
| 3. Usuario desactivado con sesión abierta | Se desactivó el perfil de prueba en PostgreSQL mientras el navegador seguía conectado. La siguiente API respondió `401`, RLS devolvió cero expedientes y la recarga bloqueó el panel. | Correcto local | — | — |
| 4. Caché privada al salir o cambiar de usuario | Cierre y nuevo login en la misma pestaña. Se retiró la sesión anterior del almacenamiento. La vista del colaborador omitió el expediente reservado y la identidad del administrador. Regresiones de aislamiento de TanStack Query verificadas. | Correcto local | — | — |
| 5. Usuario normal ante APIs administrativas | El colaborador obtuvo `403` en el listado de usuarios, en ajustes de IA y en la actualización administrativa. | Correcto local | — | — |
| 6. ID, rol, estado y responsable | El expediente asignado respondió `200` y el ajeno `404`. Los filtros de rol y estado dejaron la operación administrativa en `403`. El servidor rechazó con `400` valores inválidos de rol y estado y un campo de responsable ajeno al contrato del formulario. | Correcto en los casos probados | — | — |
| 7. Secretos y contraseñas | Los marcadores de prueba quedaron fuera del JavaScript, HTML, URL, almacenamiento de la aplicación y logs inspeccionados. El SDK conserva tokens de sesión durante el uso y los elimina al salir. El contrato registra una exposición histórica de la clave de firma de correo cuya rotación sigue sin confirmación. [Registro del proyecto](../AGENTS.md) | Correcto en la muestra. Rotación pendiente | Alta por la exposición histórica | Confirmar la rotación coordinada de las claves de firma de correo. |
| 8. Intentos repetidos de login | La interfaz manejó un `429` del proveedor simulado y mostró un mensaje controlado. La configuración efectiva de Auth alojado sigue por verificar. [Cuotas de Supabase Auth](https://supabase.com/docs/guides/auth/rate-limits) | Parcial | Media | Verificar el límite efectivo por login y el rechazo en staging. |
| 9. Validación real del formulario externo | El POST con estructura válida y formulario inexistente llegó a `404`. Entrada inválida dio `400`, cuerpo mayor al límite `413`, tipo de contenido incompatible `415` y campo trampa poblado `403`. | Correcto local | — | — |
| 10. Cuota y anti-bot del formulario | PostgreSQL permitió 10 de 30 operaciones concurrentes con un límite de prueba de 10. El build local exigió el control anti-bot y falló cerrado con `503` sin señal disponible. Pasaron los contratos Basic de las cinco rutas y el rechazo con respuesta simulada de BotID. [BotID en desarrollo](https://vercel.com/docs/botid/local-development-behavior) | Correcto local. Pendiente en Vercel | Media | Repetir la comprobación de BotID con Vercel de staging. |
| 11. Idempotencia y doble envío | 25 envíos simultáneos en PostgreSQL produjeron una queja, un folio y un único creador. La finalización concurrente conservó el registro confirmado. | Correcto en PostgreSQL | — | — |
| 12. HTML almacenado, entradas largas y errores controlados | La marca HTML inerte guardada apareció como texto en Chromium y nunca se convirtió en un nodo. Se comprobó el rechazo por longitud y tipo en HTTP y pasaron las pruebas del lector de Markdown y errores sanitizados. | Correcto en los casos probados | — | — |
| 13. Seguimiento frente a referencias inválidas | El folio sin capacidad y la capacidad inválida obtuvieron el mismo `404` con `no-store` y `no-referrer`. PostgreSQL verificó caducidad, revocación y alcance. El RPC de seguimiento requiere `service_role` en la base remota. | Correcto en los casos probados | — | — |
| 14. Archivos externos | Los validadores reales procesaron bytes de PDFs e imágenes sintéticos. Las pruebas cubrieron 4 MiB de máximo, extensión y MIME declarado frente a contenido real. PostgreSQL comprobó permisos, reserva y registro de adjuntos. | Correcto local | — | — |
| 15. Correo falla después de guardar | El POST de finalización conservó el recibo y el folio con fallo de programación. PostgreSQL conservó un aviso para el caso tras el fallo simulado. Las pruebas de reintento e idempotencia conservaron un único expediente. | Correcto local | — | — |

## Verificaciones y ajustes

- **Build de producción** aprobado con `npm run build` en una copia aislada del código, con instrumentación BotID y la fuente Inter local. **TypeScript** aprobado con `tsc --noEmit --incremental false`.
- **Navegador y HTTP** 11 escenarios ejecutados con el build final. [Resultados locales](../.performance/auditoria-seguridad-20261123/http-browser.json)
- **PostgreSQL** 71 comprobaciones de acceso, 73 del formulario, 208 de seguimiento, 148 de adjuntos y 167 de Calidad y correo. Se usaron las suites existentes y un lanzador local del motor.
- **Suite completa** `npm test` ejecutó 1.170 pruebas. Pasaron 1.095 y quedaron 75 fallos previos. Dos pruebas de seguridad que fallaban por sus fixtures ahora pasan. El lint de los archivos de prueba modificados pasó. `npm run lint` completo reportó tres errores previos de efectos de React en `Header.tsx` y `UsuarioSeguridadAcceso.tsx`.
- Las correcciones se limitaron a la referencia de migración de la prueba de correo y los fixtures de BotID y privacidad de Seguimiento. La actualización del informe de rendimiento recoge el alcance de una sola organización.

La aprobación del piloto todavía requiere comprobar los límites efectivos del login y BotID en un entorno alojado, así como confirmar la rotación histórica. El correo, Auth y Drive se ejercitaron con dependencias de prueba.

