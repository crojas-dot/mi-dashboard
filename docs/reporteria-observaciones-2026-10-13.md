# Observaciones en Reportería de Quejas

La tabla del informe conserva la columna y clave `observaciones`. Al generarla,
su valor reúne el texto histórico de `qms_quejas.observaciones` y las entradas
actuales de `quejas_comentarios`, con fecha de Costa Rica y tipo Interno/Cliente.
Esto es una proyección para lectura e impresión: no migra ni sobrescribe el registro.

- Fuentes: `app/reporteria/components/generador/consultas.ts` y
  `useGeneradorInforme.ts`. Columnas/IDs existentes no cambian.
- El mismo cliente de navegador y la misma sesión leen ambas fuentes bajo sus RLS.
  No se usa service role ni se amplían permisos para completar el informe.
- Solo Quejas con filas y tabla incluida consulta comentarios. Resúmenes/gráficas
  sin tabla, otros módulos y un informe vacío evitan esa lectura.
- Filtro por lotes de 100 IDs; páginas de 500 comentarios con orden `fecha,id`
  ascendente y el mismo `AbortSignal`. No hay una consulta por expediente.
- Se conserva el tope actual de 5000 expedientes. Más de 5000 comentarios totales
  rechazan la generación e indican ajustar fechas/filtros; nunca se omiten entradas
  silenciosamente. Un fallo en comentarios rechaza todo el informe.
- Cambiar filtros, módulo o inclusión de tabla cancela la generación anterior.
  La lectura paginada no representa una transacción/snapshot DB único.

Verificado con `node --test tests/reporteria-generador.test.mjs`: combinación,
orden estable, aislamiento del filtro, paginación, límites, errores y cancelación.
