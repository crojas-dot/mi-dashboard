# Quejas: claridad del expediente, sonido y acuse por evento

Estado: implementación local del 3 noviembre de 2026, sin publicar ni activar configuración externa.

## Referencia funcional y presentación

Se revisaron los PDF aportados: **Requerimientos de Software Calidad ECA**, F1
(página 8), F9/F10 (página 9) y requisitos no funcionales (página 10), y **Matriz de
Calidad ECA**, flujo de Quejas (páginas 15–16). Separan registro, evaluación de GC,
investigación, oficio y comunicación del resultado. El acuse inmediato es una
petición explícita del propietario en esta revisión; los PDF no fijan un SLA de
entrega de correo. No se incorporan otros módulos ni los flujos históricos que
contradicen la política vigente de dos correos ciudadanos.

- Quejas y Mis Quejas dejan margen bajo el scrollport **solo sin ampliar**, con
  el mismo fondo y separación del lienzo superior: 12px en móvil y 16px desde sm.
  No hay franja blanca; en ampliado no se reserva este espacio. El margen
  permanece visible al desplazar sin añadir otro scroll ni un pie de acciones.
- Ajuste posterior solicitado: en modo sin ampliar, el lienzo tiene un marco de
  1px y las mismas esquinas redondeadas arriba y abajo. El marco contiene el
  scrollport para que su borde inferior permanezca visible al desplazar; no es una
  franja añadida. Ampliado conserva su composición anterior. Se mantiene el mismo
  árbol de editores al alternar para no perder borradores.
- `CaseSection.source` distingue Cliente, Gestión de Calidad y gestión interna.
  Estas etiquetas identifican el contexto, no inventan autores ni fechas históricas.
  Se presentan solo como texto, sin líneas verticales decorativas.
- Por petición del propietario se retira el resumen superior de resultado público.
  El expediente comienza directamente con **Descripción**, sin etiqueta Cliente
  encima. Se retiran su componente y consulta exclusivos, sin cambiar la respuesta
  publicada, el oficio ni el documento interno guardados.
- Mis Quejas tiene **Análisis** y **Resolución**. El ID local `detalle` conserva su
  nombre y cambia solo su etiqueta. Solicitud, procedencia, archivos y notas se
  reúnen en Análisis. Resolución conserva el único Tiptap editable, revisión
  capturada, límite de 10.000 y envío a GC. La ayuda IA es opcional, de lectura,
  y solo se incorpora al borrador mediante una acción explícita, sin sobrescribirlo.
- Barras interiores de modales: 16px, pulgar con puntas rectas y contraste mayor.
  El scrollport principal del expediente conserva la barra **nativa**, ahora de
  ancho normal y gutter estable, para mantener su desplazamiento en el compositor.
  Su geometría final depende del navegador/sistema. Conserva capa compuesta,
  fondo opaco y backdrop transparente al ampliar.

## Sonido

`prepareNotificationSound` recupera el contexto cuando el navegador informa de una
interacción previa (`userActivation.hasBeenActive`). Cubre módulo cargado después
del gesto y contexto suspendido. Sin interacción sigue sin crear/reclamar audio;
no espera un gesto futuro para reproducir avisos atrasados. Se conserva la línea
base silenciosa, el reclamo IndexedDB, preferencias y guards de sesión/visita.
La campana añade **Activar y probar sonido** cuando ambas preferencias lo permiten.
El volumen, permisos y salida del equipo siguen requiriendo comprobación real.

## Acuse al terminar el formulario

El código y contrato operativo anterior usan un activador de cinco minutos; ese
intervalo explica una espera incluso con una cola saludable. Se prepara un
**despertador firmado** después del commit de finalización, mediante `after()`.
La confirmación del formulario no espera al correo. Fallar al programarlo tampoco
convierte un registro confirmado en un error que induzca otra alta.

Next envía un payload vacío a un `/exec` específico del emisor. Apps Script valida
propósito, HMAC dedicado, ventana, nonce, tamaño y contrato cerrado; aplica un
cooldown breve y comparte el lease del poll. Solo entonces ejecuta el mismo
emisor directo DB → Edge → Apps Script. No acepta destinatarios, IDs, texto ni
asuntos desde Next; conserva cuota, diario, preflight de internos, claims y ACK.
El transporte legacy permanece deshabilitado en modo Supabase. Una respuesta
perdida no se reintenta desde Next; el activador periódico conserva la recuperación.
El despertador intenta procesar el lote al finalizar, sin prometer latencia de
MailApp/Gmail ni entrega instantánea en bandeja cuando hay cuota/backlog/fallo.

Configuración **pendiente de activación**:

| Lugar | Nombre | Contrato |
| --- | --- | --- |
| Next servidor | `QUEJAS_MAIL_WAKE_ENABLED` | `true` activa el despertador; ausente no hace llamadas |
| Next servidor | `QUEJAS_MAIL_WAKE_URL` | URL HTTPS exacta de un nuevo despliegue Apps Script `/exec`, sin query |
| Next servidor | `QUEJAS_MAIL_WAKE_SECRET` | Secreto exclusivo de al menos 32 bytes; nunca NEXT_PUBLIC |
| Apps Script | `QMS_MAIL_WAKE_SECRET` | Misma clave dedicada; distinta de `QMS_MAIL_SECRET` de Edge |

Para activar: guardar el script actualizado, publicar un endpoint nuevo como
propietario con acceso de máquina y HMAC, configurar ambos extremos y publicar el
cliente web compatible. Conservar el activador de cinco minutos como respaldo.
No restaurar el `/exec` legacy archivado ni activar el worker Vercel. No se ha
ejecutado poll, claim, envío real ni prueba de correo institucional en esta revisión.

Fuentes: `lib/server/quejaMailWake.ts`, `quejaMailProtocol.ts`, transporte HTTP
compartido `quejaMailTransport.ts`, API `public/quejas/finalizar` y
`integration/apps-script/quejas-mail/Codigo.gs`.

### Diagnóstico del folio 2026-2081, 3 noviembre

Consulta remota de solo lectura en `fykhrrpeoehwqznccmfp`: alta a las 13:04:55,
finalización a las 13:05:09 y acuse `sent` a las 13:09:28, hora Costa Rica. Un
intento, sin `safe_error`; el propietario confirmó después que sí llegó. La espera
desde finalizar fue de 4 minutos y 19 segundos. Health HMAC verificó servicio
habilitado; no se ejecutó claim, poll, ACK, reenvío ni alta de prueba.

El script pegado por el propietario coincide con la versión anterior al
despertador: `doPost` acepta el transporte legacy y el poll usa cada cinco minutos.
Solo difiere del archivo local actualizado en el bloque inicial del despertador.
Las tres variables `QUEJAS_MAIL_WAKE_*` están ausentes del entorno local. Por ello
el código preparado no está conectado a un envío por evento; la recepción normal
continúa dependiendo del activador periódico. No se atribuye al formulario un
fallo de entrega que esta evidencia no muestra.

La conexión existente de Apps Script rechazó la consulta de edición con
`invalid_grant` (HTTP 400), por lo que requiere reautorizarse antes de activar el
despertador. La inspección de Chrome también fue detenida al no poder verificar
la URL. No se modificó el script remoto, los activadores ni las credenciales.
Evidencia sanitizada: `.performance/quejas-bottom-space-20261103/mail-status.json`;
sin destinatarios, texto, tokens ni capacidades privadas.

## Evidencia y límites

Marco inferior solicitado después: **64/64** pruebas focalizadas de workspace y
correo; **15** comprobaciones de navegador de escritorio y **8** móviles. Incluyen
borde de 1px, radios iguales arriba/abajo, persistencia del borde al desplazar,
ausencia del marco añadido en ampliado y borrador conservado al alternar. TypeScript,
lint focalizado, build de producción, estructura y capa visual correctos.
Capturas y `frame-evidence.json` en `.performance/quejas-bottom-space-20261103/`.

Corrección posterior del margen solicitada por el propietario: se retira la
franja blanca y se reserva únicamente el padding del fondo en modo sin ampliar.
Verificación focalizada: **27/27** pruebas existentes, **29** comprobaciones de
navegador en ambas vistas y modos a 1920/390px, TypeScript, lint focalizado y build
correctos. Evidencia: `.performance/quejas-bottom-space-20261103/`. La geometría
medida confirma el mismo margen superior/inferior, persistencia al desplazar y
cero espacio inferior añadido al ampliar.

Retiro posterior del resumen superior: **34/34** pruebas focalizadas, TypeScript,
lint focalizado y estructura correctos. Navegador con datos ficticios confirma en
Quejas/Mis Quejas, lateral y ampliado, que Descripción es la primera sección y no
aparecen el resumen ni la etiqueta Cliente. No se modificaron datos publicados.

Verificación previa al retiro del resumen: **809/809** pruebas Node; TypeScript dentro del build, lint,
build de producción, estructura y capa visual correctos. La primera compilación
no alcanzó Google Fonts; la repetición con acceso de red compiló Inter real, sin
mocks ni cambiar las fuentes del producto.

QA visual local: 24 comprobaciones en 1920px y móviles de 390/320px; componentes y
CSS reales con datos ficticios, red externa cerrada. Verifica resultado público,
orígenes, margen fijo, modalidad, dos pestañas, un solo editor, borrador al cambiar
pestaña y ante conflicto, y scrollbar interior de 16px con radio cero. Audio: 18 comprobaciones con AudioContext, decodificación
MP3 e IndexedDB nativos en dos páginas; visibilidad/activación controladas para
evitar los gestos sintéticos de Playwright, recuperación de contexto suspendido,
salida silenciada. No certifican
permisos ni volumen del dispositivo, RLS remota vigente o entrega en buzón.

Evidencia reproducible en `.performance/quejas-refinement-20261103/`. La activación
externa y la aceptación real de un nuevo correo/sonido permanecen pendientes.
