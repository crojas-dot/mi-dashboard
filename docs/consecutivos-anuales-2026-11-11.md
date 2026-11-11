# Consecutivos anuales — 11 de noviembre de 2026

## Contrato vigente

El año se obtiene en PostgreSQL de la fecha de registro de la transacción en
`America/Costa_Rica`. No depende del reloj del navegador, la zona UTC de Supabase,
la fecha programada de una auditoría ni la fecha en que se exporta un informe.

| Serie automática | Formato de nuevas altas | Fuente del contador |
| --- | --- | --- |
| Quejas, internas y ciudadanas | `2027-001`, `2027-002`, … | `public.folios_quejas_anuales` |
| SACP, incluida la derivación desde Quejas | `SACP-2027-001`, … | `qms_private.folios_anuales`, módulo `sacp` |
| Auditorías | `AUD-2027-001`, … | Misma tabla, módulo `auditorias` |
| Riesgos | `RIESGO-2027-001`, … | Misma tabla, módulo `riesgos` |
| Generador de Documentos, sin consumidor actual | `DOC-2027-001`, … | Misma tabla, módulo `documentos` |

Cada módulo/año tiene su propia fila, creada con el primer registro; no se requiere
cron, reiniciar secuencias ni programar un cambio cada enero. Si el año ya contiene
un contador/histórico importado, se continúa desde ese piso. El relleno es de mínimo
tres dígitos: `999 → 1000`, sin truncar ni volver a `001`.

Quejas ya tenía el contador anual correcto. Se conserva su tabla y sus valores:
no se renumeraron los folios `Q-…`, `QUEJA-…` ni `2026-2088`; tampoco se reinició
2026 para aparentar `001`. Los prefijos de otros módulos se conservan y sus folios
históricos con cuatro dígitos permanecen intactos.

Los modales de SACP/Auditorías/Riesgos conservan la opción de introducir un código
manual. Si se deja vacío, el cliente nuevo omite `folio` y la DB lo asigna durante
el `INSERT`. Un código manual que coincide con la serie anual eleva su contador
mediante `greatest`, sin reescribir el código. Un código manual ajeno no se interpreta
como fecha. La regla anual automática no convierte códigos documentales en folios:
Documentos continúa usando `codigo_doc`; su generador queda sin integrar.

## Implementación y compatibilidad

- Migración aplicada: `20261111151343_folios_anuales_transaccionales.sql`.
- Núcleo: `qms_private.next_annual_folio(text,timestamptz)`, exclusivo del código
  privilegiado de DB, sin EXECUTE para anon/authenticated/service_role.
- Quejas conserva `generar_folio_queja()` dentro de sus RPC de alta protegidos.
  El gateway público mantiene UUID/hash, cuota y reintentos idempotentes antes de
  asignar el folio; no se modifica su contrato de correo o adjuntos.
- SACP/Auditorías/Riesgos: `a_qms_annual_folio` llama al núcleo en el alta. El contador
  participa en la transacción: si falla un CHECK, RLS u otra parte del alta, se revierte
  el incremento. El UPSERT con clave módulo/año evita duplicados entre altas simultáneas.
- Los wrappers RPC existentes conservan sus ACL para el cliente web publicado, que
  todavía reserva el folio antes de insertar. El contador anual ya le aplica; el ahorro
  de reservas fallidas de esos tres modales exige publicar el cliente nuevo. No retirar
  estos wrappers sin coordinar ese corte. `lib/services/folioService.ts` queda legacy,
  sin consumidores de aplicación local, y no debe recuperarse como paso previo al alta.
- `siguiente_folio_queja()` no tenía consumidores vigentes y usaba otra secuencia/año
  UTC. Queda cerrado, igual que el acceso cliente a las secuencias retiradas. No se
  eliminan las secuencias ni se cambia su valor histórico.
- Los contadores de otros módulos se inicializaron con el mayor folio histórico y
  las reservas ya consumidas de la antigua secuencia durante el año actual. No se
  reutilizan números perdidos anteriormente por altas fallidas del cliente legacy.
- Listas, detalle, seguimiento, correo e informes usan el folio persistido. Exportar
  en otro año no cambia el identificador ni genera otro consecutivo. El número de
  oficio editable en respuesta al cliente sigue siendo un dato distinto.

## Verificación y entrega

`scripts/test-folios-anuales-db.mjs` ejecuta PostgreSQL aislado, sin cargar `.env` ni
contactar servicios externos. Sus 157 comprobaciones cubren cinco series, medianoche
de Costa Rica con sesiones UTC/Kiritimati/Los Ángeles, 2026/2027/2028, 999/1000,
200 asignaciones concurrentes, primera fila, rollback por validación/RLS, códigos
manuales, permisos cerrados y compatibilidad del RPC anterior.

Selección Node: 124/124 en altas, cliente público, informe, correo y transporte de
cola. Incluye el folio de un año anterior al emitir Word/correo y ceros iniciales.
TypeScript, lint de archivos afectados, build, estructura y capa visual correctos.

La lectura remota posterior confirmó cinco wrappers conectados al núcleo, tres
triggers, contadores e identificadores históricos intactos, las mismas policies de
los registros y las mismas ACL de los generadores. No se crearon expedientes,
acciones, auditorías, riesgos ni correos reales para QA.

Evidencia sanitizada: `supabase/backups/folios_anuales_activation_20261111.json`.
La DB está aplicada; los cambios de cliente permanecen locales, sin despliegue Vercel.
El calendario adicional solicitado para otros módulos queda expresamente aplazado;
no modifica el calendario laboral QMS ya existente.
