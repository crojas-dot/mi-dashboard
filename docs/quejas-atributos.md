# Registro de Quejas: campos y consecutivos

La referencia es el registro manual de GC. Estos son los nombres del sistema:

| Columna del registro | Campo de `public.quejas` | Captura |
| --- | --- | --- |
| Consecutivo | `folio` | RPC `generar_folio_queja`; año de Costa Rica y contador anual, p. ej. `2026-004` |
| Fecha recepción por GC | `fecha_recepcion_gc` (`date`) | Automática en formulario público; ajustable por GC en el registro interno |
| Área afectada | `area_afectada` | Solo GC en registro interno o expediente; el cliente no la selecciona |
| Tipo | `tipo` | Queja, Observación, Sugerencia, Denuncia, Reclamo o Felicitación |
| Persona o empresa | `cliente_nombre` | Campo anterior, conserva los datos existentes |
| N.º oficio de resolución | `numero_oficio_resolucion` | Interno; puede completarse después |
| Observaciones | `observaciones` | Interno; separado de `notas` de justificación y `resolucion` del flujo |

`categoria` sigue siendo la **clasificación interna** (por ejemplo Servicio o Calidad), distinta del tipo. Para formularios públicos se copia inicialmente el tipo a `categoria` por compatibilidad con los informes y gráficos anteriores. `fecha` sigue siendo el instante de creación, útil para ordenar registros y calcular tendencias; `fecha_recepcion_gc` representa el día administrativo del Excel. No tratar `fecha_recepcion_gc` como timestamp UTC en la UI.

El documento general de requisitos propone `Q-2026-0001` como ejemplo. Para **Quejas**, la decisión vigente del usuario sigue el registro operativo mostrado (`2026-003`): nuevos folios `AAAA-NNN`. No cambiar esta decisión por el ejemplo del documento ni renombrar históricos.

## Dónde modificar

- Tipos visibles: `lib/constants/quejas.ts`, `app/q/[token]/page.tsx` y `app/quejas/components/NuevaQuejaModal.tsx`. Si se añade un tipo, actualizar también la validación de `crear_queja_publica_con_atributos`.
- Escritura transaccional y permisos: `supabase/017_atributos_reales_quejas.sql` y `lib/services/quejaWorkflowService.ts`.
- Lectura: `lib/types.ts`, tablas de Quejas/Mis Quejas, ambos expedientes e informes.
- Drive: los endpoints ya usan `queja.folio` como nombre de carpeta. Los folios anteriores no se renombran; sus adjuntos se localizan por ID de archivo, no por el texto del folio.

Aplicar el SQL **antes** de desplegar el frontend que llama las RPC nuevas. Los mínimos `2025-016` y `2026-003` de la migración vienen de la captura: si el Excel completo contiene consecutivos superiores no cargados en la base, elevar `ultimo` al máximo real antes de aceptar nuevas quejas. No importar datos de ejemplo ni renumerar folios históricos automáticamente.

Tras ejecutarlo, verificar en SQL Editor:

```sql
select anio, ultimo from public.folios_quejas_anuales order by anio;
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'quejas'
  and column_name in ('tipo', 'area_afectada', 'fecha_recepcion_gc', 'numero_oficio_resolucion', 'observaciones')
order by column_name;
```

No llamar `generar_folio_queja()` solo para probar el formato: consumiría un número real. La comprobación funcional debe crear un caso de prueba mediante el flujo normal y confirmar la carpeta Drive con exactamente ese folio.
