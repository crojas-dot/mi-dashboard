# Identidad institucional y foto de perfil — 18 de noviembre de 2026

## Alcance

La sección **Configuración → Identidad** concentra los recursos visuales y conserva el editor existente del logo lateral.

| Recurso | Clave | Recorte | Calidad recomendada |
| --- | --- | --- | --- |
| Logo del menú lateral | `org.logo_url` | 512 × 512 (1:1) | PNG transparente, idealmente menos de 300 KB |
| Logo del encabezado del correo | `org.identidad.correo_encabezado` | 512 × 512 (1:1), PNG de salida | PNG transparente de buena calidad, idealmente menos de 300 KB |
| Fondo de inicio de sesión | `org.identidad.login_fondo` | 1600 × 900 (16:9), WebP de salida | JPG/WebP nítido, sin texto importante, idealmente 300 KB–1 MB |
| Logo del formulario externo | `org.identidad.formulario_encabezado` | 900 × 300 (3:1), WebP de salida | PNG transparente o WebP, idealmente menos de 400 KB |
| Foto de perfil | `usuarios.avatar_url`, bucket privado | 320 × 320 (1:1), WebP de salida | JPG/WebP de buena calidad, máximo 2 MB de origen |

El área de recorte permite arrastrar y ampliar la imagen. Cada editor presenta tamaño, proporción, formato recomendado y calidad aproximada. Los recursos institucionales admiten PNG/JPG/WebP de hasta 4 MB de origen y quedan guardados optimizados en objetos versionados del bucket público `branding`. El logo del menú conserva su editor y límites previos. Para el correo se genera PNG cuadrado para que el pequeño icono situado a la izquierda de **QMS ECA** se vea nítido en clientes de correo; no se inserta una imagen horizontal de cabecera ni imagen de pie.

El fondo de login permanece opcional y su capa clara conserva la legibilidad de las credenciales. El formulario público **no usa fondo institucional**: muestra un logo horizontal dentro del encabezado, a la **derecha** de «Registro de queja», con `object-contain`, máximo 220 × 72 px en pantalla. También se muestra en el encabezado de la confirmación. Sin logo, el formulario permanece igual. No cambia la validación de sesión, la captura de datos, los tokens del formulario ni la carga de evidencias.

La API valida el tipo, tamaño, dimensiones y contenido de las imágenes en el servidor y permite a un administrador real escribir/borrar. La lectura pública expone solo las tres URL actuales (correo, fondo de login y encabezado del formulario), sin configuraciones privadas. Las URL se limitan al origen esperado de Supabase, al slot exacto y a archivos versionados con la extensión correspondiente. Se retira del editor el antiguo `correo_pie` y la opción `formulario_fondo`. Cualquier antigua clave persistida queda ignorada; no se hace eliminación masiva de archivos desde esta revisión.

## Fotos personales

La ruta de perfil existente `/api/perfil/avatar` opera exclusivamente con `getCurrentUser`, y `avatar_url` es una ruta privada del usuario (no una URL abierta). El bucket `qms-avatars` es **privado**, límite de 512 KiB por imagen WebP, sin políticas de acceso directo desde `anon` o `authenticated`; subida y lectura ocurren con API autenticada, autorización por identidad, service role solo en servidor, y comparación de versión al reemplazar. La UI ahora ofrece recorte cuadrado antes de subir, y la API vuelve a optimizar a 320×320.

### Estado de infraestructura

El 18 de noviembre se comprobó que la BD ya tenía `usuarios.avatar_url`, pero faltaba el bucket. Se creó el bucket privado `qms-avatars` con máximo 512 KiB WebP y se retiró UPDATE directo de `avatar_url` para roles cliente; `nombre` sigue editable con su política previa. La migración pendiente `20261117223249_perfiles_avatar_privado_y_autoria_notas.sql` quedó con `ON CONFLICT DO NOTHING` para que el bucket ya creado no bloquee una aplicación posterior; **no se aplicaron las modificaciones ajenas de notas/autores de esa migración**.

La creación del bucket y consulta de permisos fueron verificadas directamente. La carga real con una sesión humana no se pudo ejecutar sin iniciar sesión; se debe validar manualmente en preview desde Mi perfil: subir, cambiar, quitar y cambiar de cuenta.

## Correos: despliegue separado y seguro

El envío de correos ocurre mediante Supabase Edge `quejas-mail-queue` y **otro proyecto Google Apps Script**. El código de esta rama incluye el logo cuadrado del encabezado de correo de forma opcional, pero **no está activo en el transportador remoto** solo por desplegar Next.js.

1. Mantener `QMS_MAIL_BRANDING_ENABLED` ausente/apagado hasta validar el circuito de correo.
2. Publicar y probar la versión revisada de `integration/apps-script/quejas-mail/Codigo.gs` en su proyecto de Apps Script independiente, sin modificar el conversor de Drive ni sus credenciales.
3. Publicar la versión correspondiente de `supabase/functions/quejas-mail-queue/index.ts` en el proyecto correcto.
4. Solo tras validar los sobres firmados, encender `QMS_MAIL_BRANDING_ENABLED=true` en la función Edge para que lea el logo público del encabezado. No se añaden URLs libres al cuerpo de un correo y la entrega del documento oficial no cambia.
5. Comprobar con mensajes sintéticos que el logo cuadrado reemplaza la «E» y que no existe banner ni pie y que los correos siguen saliendo sin imagen en ausencia de configuración o si la consulta falla. Mantener los controles de diario/idempotencia y la autorización para adjuntos.

Los clientes de correo pueden bloquear imágenes remotas: el texto, enlace y adjunto oficial siempre deben seguir siendo utilizables sin descargarlas. No reenviar correspondencia real para probar un cambio visual.

## Validación antes de fusionar

- Vercel: build/TypeScript en preview.
- Pruebas locales: `node --test tests/identidad-imagenes.test.mjs tests/foto-perfil.test.mjs tests/mi-perfil.test.mjs tests/branding-logo-api.test.mjs tests/queja-mail-direct.test.mjs`.
- Supabase: confirmar `branding` público y `qms-avatars` privado con MIME/size, UPDATE de avatar restringido y sin policies para objetos privados.
- UI: vista de Configuración → Identidad; recorte por proporciones; probar subida/eliminación con cuenta admin; verificar login con y sin fondo, formulario con y sin logo en la esquina derecha, y perfil con un usuario real.
- Correo: solo source control y pruebas simuladas hasta despliegue específico en Apps Script y Edge.
