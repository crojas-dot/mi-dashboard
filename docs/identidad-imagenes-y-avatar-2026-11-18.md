# Identidad institucional y foto de perfil — 18 de noviembre de 2026

## Alcance

La sección **Configuración → Identidad** concentra la marca visual. Mantiene el editor original del logo ECA-QMS y agrega cuatro recursos:

| Recurso | Clave | Recorte |
| --- | --- | --- |
| Logo lateral | `org.logo_url` | Cuadrado (editor previo) |
| Encabezado del correo | `org.identidad.correo_encabezado` | 3:1 |
| Pie del correo | `org.identidad.correo_pie` | 3:1 |
| Fondo de login | `org.identidad.login_fondo` | 16:9 |
| Fondo de formulario externo | `org.identidad.formulario_fondo` | 16:9 |

El área de recorte permite arrastrar y ampliar la imagen antes de guardar. Las cuatro nuevas imágenes se optimizan a WebP por la API del servidor y se guardan como objetos versionados en el bucket público existente `branding`, prefijo `identidad/{slot}/{uuid}.webp`. Las claves solo contienen URL del mismo bucket/slot y dominio configurado. Para evitar inyección de recursos externos la API acepta exclusivamente JPG, PNG y WebP y comprueba bytes reales, dimensiones, peso y formato en el servidor. Solo el rol real de administrador permite alta o eliminación. La lectura pública retorna únicamente las cuatro URLs institucionales, nunca credenciales o preferencias.

La pantalla de login y el formulario público muestran el fondo configurado con una capa clara para mantener legibles los campos. Sin imagen, conservan el fondo original. Los fondos no modifican la validación de sesión, el token del formulario ni las evidencias.

## Fotos personales

La ruta de perfil existente `/api/perfil/avatar` opera exclusivamente con `getCurrentUser`, y `avatar_url` es una ruta privada del usuario (no una URL abierta). El bucket `qms-avatars` es **privado**, límite de 512 KiB por imagen WebP, sin políticas de acceso directo desde `anon` o `authenticated`; subida y lectura ocurren con API autenticada, autorización por identidad, service role solo en servidor, y comparación de versión al reemplazar. La UI ahora ofrece recorte cuadrado antes de subir, y la API vuelve a optimizar a 320×320.

### Estado de infraestructura

El 18 de noviembre se comprobó que la BD ya tenía `usuarios.avatar_url`, pero faltaba el bucket. Se creó el bucket privado `qms-avatars` con máximo 512 KiB WebP y se retiró UPDATE directo de `avatar_url` para roles cliente; `nombre` sigue editable con su política previa. La migración pendiente `20261117223249_perfiles_avatar_privado_y_autoria_notas.sql` quedó con `ON CONFLICT DO NOTHING` para que el bucket ya creado no bloquee una aplicación posterior; **no se aplicaron las modificaciones ajenas de notas/autores de esa migración**.

La creación del bucket y consulta de permisos fueron verificadas directamente. La carga real con una sesión humana no se pudo ejecutar sin iniciar sesión; se debe validar manualmente en preview desde Mi perfil: subir, cambiar, quitar y cambiar de cuenta.

## Correos: despliegue separado y seguro

El envío de correos ocurre mediante Supabase Edge `quejas-mail-queue` y **otro proyecto Google Apps Script**. El código de esta rama incluye las imágenes de correo de forma opcional, pero **no está activo en el transportador remoto** solo por desplegar Next.js.

1. Mantener `QMS_MAIL_BRANDING_ENABLED` ausente/apagado hasta validar el circuito de correo.
2. Publicar y probar la versión revisada de `integration/apps-script/quejas-mail/Codigo.gs` en su proyecto de Apps Script independiente, sin modificar el conversor de Drive ni sus credenciales.
3. Publicar la versión correspondiente de `supabase/functions/quejas-mail-queue/index.ts` en el proyecto correcto.
4. Solo tras validar los sobres firmados, encender `QMS_MAIL_BRANDING_ENABLED=true` en la función Edge para que lea las imágenes públicas. No se añaden URLs libres al cuerpo de un correo y la entrega del documento oficial no cambia.
5. Comprobar con mensajes sintéticos que las imágenes opcionales se muestran y que los correos siguen saliendo sin imagen en ausencia de configuración o si la consulta falla. Mantener los controles de diario/idempotencia y la autorización para adjuntos.

Los clientes de correo pueden bloquear imágenes remotas: el texto, enlace y adjunto oficial siempre deben seguir siendo utilizables sin descargarlas. No reenviar correspondencia real para probar un cambio visual.

## Validación antes de fusionar

- Vercel: build/TypeScript en preview.
- Pruebas locales: `node --test tests/identidad-imagenes.test.mjs tests/foto-perfil.test.mjs tests/mi-perfil.test.mjs tests/branding-logo-api.test.mjs tests/queja-mail-direct.test.mjs`.
- Supabase: confirmar `branding` público y `qms-avatars` privado con MIME/size, UPDATE de avatar restringido y sin policies para objetos privados.
- UI: vista de Configuración → Identidad; recorte por proporciones; probar subida/eliminación con cuenta admin; verificar login/formulario con y sin imagen, y perfil con un usuario real.
- Correo: solo source control y pruebas simuladas hasta despliegue específico en Apps Script y Edge.
