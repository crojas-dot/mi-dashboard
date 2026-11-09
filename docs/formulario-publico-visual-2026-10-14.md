# Formulario público: lectura y adjuntos — 14 de octubre de 2026

Actualización local del **20 octubre**: la pantalla «Queja registrada» adopta la
jerarquía del correo automático vigente: marca compacta en cabecera blanca,
título y folio azul en línea, cuerpo en una columna y pie discreto. Se retiran el
check circular, recuadro interior del folio y columna «Próximo paso». Conserva
896 px máximos para no saltar de ancho al finalizar; en móvil el folio puede
cambiar de línea y el botón ocupa el ancho disponible.

No cambia el contrato de éxito, que exige finalización y todos los adjuntos.
Seguimiento disponible ofrece solo su URL confirmada; pendiente conserva su
recuperación independiente, error y loading; desactivado no muestra una acción
rota. Evidencias y espera del correo se informan sin afirmar entrega al buzón.
No se modificaron hook, transporte, seguridad ni el Apps Script activo.

Verificación: **43/43** pruebas del cliente/formulario, TypeScript, ESLint de la
página y capa visual correctos. QA con página y hook reales, servidor ficticio
aislado sin .env ni red externa: nueve combinaciones de anchos 320/375/1280 px
y seguimiento disponible/pendiente/desactivado; 77 comprobaciones de contenido
y recuperación. Capturas finales de escritorio/móvil en
`.performance/receipt-20261020/`; no constituyen prueba de correo real. Sin
publicación en Vercel. Los párrafos siguientes conservan evidencia histórica.

Actualización del **19 octubre**, publicada en `dpl_2kk83rkgKrip1MwK8NNbMcw2d2MF`:
confirmación con encabezado compacto, folio
y próximo paso en dos columnas desde sm, evidencias una sola vez y seguimiento solo
cuando hay enlace o está pendiente de recuperación. Se retiran el gran bloque centrado
y «Envío completado». La ayuda aclara que el correo puede tardar unos minutos; no
afirma que esté enviado ni entregado. El folio sigue esperando finalización y adjuntos.
Recuperar un enlace no repite alta/subida. No cambian hook, validaciones o permisos.

QA del recibo: **142/142** comprobaciones sintéticas en 1440/1280/375/320 px y tres
estados, sin red externa ni escrituras reales; `.performance/receipt-20261019/`.
Usa Inter latino del build. Formulario **30/30**, suite Node completa **719/719**,
TypeScript, lint focalizado y build correctos. La activación posterior del mismo día
publicó la web y actualizó Apps Script; ver [estado de seguimiento](quejas-seguimiento-y-publicacion-2026-10-16.md).

Actualización local del **16 octubre**: el encabezado está alineado al contenido y
usa 20 px. Adjuntar y contador comparten una fila; sin archivos no se dibuja una caja
vacía. La lista aparece solo al seleccionar, crece hasta dos filas (104 px) y luego
hace scroll. Se retiró la división en dos paneles y la altura mínima del estado de
error. Permanecen el ancho de 896 px, cinco filas de descripción, la validación/foco
por campo y el pie de envío separado. Al obtener el enlace de seguimiento se mantiene
la confirmación y solo se reintenta ese enlace. El siguiente texto conserva la
presentación del 14 octubre como evidencia histórica, no la receta vigente.

Fuente: `app/q/[token]/page.tsx`. Cambio local de presentación, sin publicar en
Vercel ni modificar el hook, el gateway, BotID, las validaciones o los permisos.

El ancho máximo sigue siendo 896 px, con los mismos cuatro campos iniciales en
dos columnas desde `sm` y una columna móvil. Nombre, correo, tipo y descripción
conservan sus validaciones y límites. Descripción conserva cinco filas y su
redimensionado manual. El encabezado centra título de 24 px y nombre del
formulario; una división sencilla separa los campos.

Adjuntar y listar evidencias comparten un bloque: 112 px en escritorio y 144 px
en móvil. La acción y el contador están a la izquierda en escritorio y arriba
en móvil; las evidencias se desplazan dentro del bloque. Nombres largos muestran
su valor completo en el título y en la acción de quitar. El contador móvil se
abrevia visualmente, conservando el texto completo para tecnologías de apoyo.
Seleccionar, eliminar o volver a seleccionar archivos no aumenta la tarjeta.

La tarjeta ocupa su altura natural hasta `100dvh - 48px`. Cuando falta altura,
solo los campos hacen scroll; el pie de envío conserva espacio propio. Sustituye
el pie sticky que se superponía a descripción y adjuntos. El botón no flota sobre
otro campo y el documento no añade un segundo scroll de página en el formulario
activo. El marco reacciona al viewport dinámico sin una altura mínima impuesta.

Los estados de envío permanecen en el formulario. Registro pendiente o fallido
conserva el borrador; una subida fallida conserva folio y archivos. La tarjeta
final aparece únicamente cuando se confirma la finalización y todos los archivos
están adjuntados. No existe otra ventana de subida ni pausa visual artificial.

Verificación local con el componente, hook y cliente reales, API interceptada
con respuestas sintéticas: 124 comprobaciones en 1440×900, 1280×640, 390×844 y 320×568. Cero crecimiento
de tarjeta y desplazamiento de botón al seleccionar uno o diez archivos de
nombres largos; selector por teclado, eliminación, error de verificación,
reintento con mismo `submissionId`, subida detenida y recuperación del mismo
`uploadId`. Se comprueba también reducción de viewport a 500 px de alto sin
ocultar el botón ni superponer el pie. Evidencia local ignorada por Git en
`.performance/public-form-oct14/`, generada por
`.performance/public-form-oct14-visual.mjs`. Las respuestas sintéticas no prueban
BotID positivo ni implican envíos o archivos reales.

Suite `public-quejas-client`: 23/23; lint de la página correcto. Las guías de
seguridad y los contratos de datos siguen siendo las fuentes de los controles
del formulario; este cambio solo altera su presentación.
