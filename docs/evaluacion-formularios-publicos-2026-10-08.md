# Formularios públicos — evaluación técnica del 8 de octubre de 2026

> Evaluación histórica anterior a la implementación. La decisión posterior usa BotID Basic de Vercel, sin Cloudflare; consultar [el contrato y estado de activación actuales](seguridad-formularios-publicos.md). Las observaciones siguientes describen el flujo previo, no el repositorio actualizado.

La propuesta es viable como evolución del flujo actual. Esta evaluación no instala
Turnstile/WAF, no crea endpoints ni ejecuta migraciones de producción. La activación
requiere desplegar el nuevo cliente/API y cerrar todos los accesos alternativos juntos.

## Lo que comprobé en código y Supabase

- El cliente `app/q/[token]/page.tsx` crea por `crear_queja_publica`, sube a
  `/api/drive/upload-public`, registra adjuntos por RPC y notifica por folio.
- Metadata remota: los tres RPC son SECURITY DEFINER con search_path=public y
  EXECUTE efectivo para anon/authenticated/service_role. Creación y notificación
  también tienen EXECUTE concedido a PUBLIC: revocar solo anon sería insuficiente.
- RLS de Quejas permite staff o colaborador propietario con permiso; no apareció
  policy de lectura ciudadana. Se ejecutó además una [comprobación READ ONLY](../scripts/auditar-lectura-publica.sql)
  como anon con claims vacíos de identidad: Quejas/adjuntos no devolvieron filas privadas,
  terminando en ROLLBACK. No equivale a probar todos los escenarios REST.
- `formularios_publicos_active_select` permite leer todos los formularios activos,
  no solo el token solicitado por el cliente. Un GET de metadata por API permitiría
  cerrar esa enumeración al migrar; devolver solo el nombre/datos necesarios.
- Upload valida token activo y busca la queja por folio, pero no vincula el formulario
  con ese expediente. Token de formulario + folio ajeno conocido no demuestra autoría.
- Upload no reserva cuota antes de consumir Drive. El registro de metadatos sucede
  después, desde el navegador: una subida puede quedar huérfana si falla ese RPC.
- La validación actual comprueba tamaño/MIME declarado; el tipo declarado por el
  cliente no demuestra el contenido real. Algunos fallos Drive todavía devuelven
  mensajes internos. El rate limit es memoria por instancia, no un contador distribuido.

## Ajustes a la propuesta

El patrón conveniente sigue siendo un solo Supabase con API de entrada, servicios
servidor pequeños, RPC transaccional y frontend con estado local. No hace falta un
segundo proyecto, una segunda caché de negocio ni un framework de repositorios.

1. **Gateway completo.** Migrar lectura de metadata, creación, registro de adjuntos
   y finalización/notificación. Proteger solo POST creación deja bypass en los otros RPC.
2. **Idempotencia dentro de una transacción.** UNIQUE por formulario/submission_id,
   hash del payload ciudadano normalizado y asociación a queja/folio. La función
   reclama el ID y crea la queja en la misma transacción. Repetir datos devuelve el
   mismo folio; hash distinto devuelve 409. No confiar solo en consultar antes de insertar.
3. **Reintentos y CAPTCHA.** Cada reintento HTTP debe obtener un token Turnstile nuevo;
   la idempotencia de negocio recupera el folio. No confundir el idempotency_key de
   Siteverify con el submission_id. No crear otra queja por un fallo de adjuntos.
4. **Adjuntos como capacidad temporal.** Token firmado con finalidad, formulario,
   submission_id/queja, expiración y nonce; sin datos personales ni credenciales DB.
   Validar antes de consultar/subir, reservar cuota atómicamente y registrar metadatos
   desde servidor. Reintentos de archivo también requieren identidad idempotente.
   Fallo Drive libera reserva; fallo de registro exige compensación/reconciliación.
5. **Tipos de archivo.** Mantener 4 MiB/10 archivos como máximos, aplicados también en
   servidor. Evaluar PDF/JPEG/PNG para la entrada pública, comprobar firma/contenido
   y extensión coherentes. Esto no es antivirus; PDF/imágenes siguen siendo no confiables.
   No modificar la allowlist interna de investigadores por esta decisión ciudadana.
6. **Validación y privacidad.** Allowlist de campos y longitudes, categorías del flujo,
   honeypot y body leído con límite real de bytes. Estado/folio/fechas/responsable son
   servidor. Mensajes seguros, logs de motivo/resultado sin texto ciudadano, tokens,
   correos ni IP cruda persistida. No asumir que un ID de formulario concede permisos.
7. **Emergencia y CSP.** Bloqueo que alcance creación y subidas, conservando panel,
   consultas y folios ya emitidos. CSP empezar en Report-Only y comprobar scripts
   Next, Turnstile y preview Drive; una policy genérica puede romper el login/panel.

## Qué permite el presupuesto actual

Hobby admite una regla de rate limit por proyecto, hasta tres reglas WAF personalizadas,
ventanas de 10 segundos a 10 minutos y contador por región. Los límites propuestos
por operación de 15 minutos/hora no caben tal cual en esa única regla; usar una regla
coarse para POST públicos y separar cuotas funcionales verificadas. Modo Log observa,
no bloquea. No aplicar un challenge HTML a una API que espera JSON.
[Vercel WAF](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)

Turnstile Free permite hasta 20 widgets y 10 hostnames por widget, con desafíos ilimitados;
no requiere mover el DNS a Cloudflare. Usar un widget con dominios permitidos de producción
y pruebas controladas. [Planes Turnstile](https://developers.cloudflare.com/turnstile/plans/)

Siteverify servidor es obligatorio. Sus tokens duran cinco minutos y son de un uso;
comprobar success, hostname y action esperados, con timeout y cierre seguro ante fallo.
El token de subidas de 15–30 minutos sería una credencial propia distinta.
[Validación Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

Hobby está destinado a uso personal/no comercial según Vercel; no presupuestar un
sistema institucional como elegible automáticamente. Validar la elegibilidad con el
proveedor antes de un piloto institucional. [Plan Hobby](https://vercel.com/docs/plans/hobby)

Redis distribuido solo si las cuotas funcionales exactas lo exigen; revisar disponibilidad
Free vigente. PostgreSQL sí es adecuado para idempotencia/cuota transaccional después
de WAF/CAPTCHA, no como única barrera al tráfico bruto. No prometer protección ilimitada.

## Orden seguro y criterios de salida

1. Capturar ACL/policies/functions y dependencias; ya se verificó metadata, falta una
   batería transaccional/REST específica del flujo público. Conservar rollback de ACL.
2. Preparar API/services y RPC idempotente de servicio, validadores, capability/quotas
   y pruebas locales/transaccionales. Mantener el folio oficial y el panel sin cambios.
3. Configurar widget/secret servidor y regla WAF dirigida a rutas públicas; no poner
   claves en código. Probar dominio real, expiración, red caída y accesibilidad.
4. Migrar el cliente y verificar la API nueva antes del corte. Revocar EXECUTE de
   PUBLIC/anon/authenticated solo de los RPC que ahora ejecuta el backend, preservar
   service_role y consumidores internos auditados. Migrar policies de metadata después
   de verificar GET público/API y la administración de formularios.
5. Confirmar REST directo 401/403, propiedades administrativas 400, mismo ID+datos
   mismo folio, ID+datos diferentes 409, envíos simultáneos una fila; autorización
   cruzada/expirada de archivos rechazada y nunca más de diez reservas confirmadas.
6. Probar fallos entre Drive/DB, adjuntos huérfanos, cuota liberada, notificación única,
   consumo acotado y modo de emergencia. Solo entonces activar/cerrar flujo viejo.

Faltan para activar: widget y secretos configurados en los servicios, elegibilidad del
hosting, implementación/pruebas y despliegue coordinado. No afirmar que el formulario
ya cuenta con estas barreras por tener este documento o RLS habilitada.
