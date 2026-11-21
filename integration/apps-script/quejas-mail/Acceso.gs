/** Envío de acceso transitorio: el recibo solo contiene identificadores y resultado. */
function qmsAccessMailPost_(e) {
 var configuration,request,stage='configuration',authenticated=false;
 try {
  configuration=qmsMailConfiguration_();
  stage='envelope';
  if(!e||!e.postData||Utilities.newBlob(e.postData.contents).getBytes().length>4096)throw new Error('invalid');
  request=qmsMailVerify_(JSON.parse(e.postData.contents),'access_delivery_request',configuration.secret,2048);
  authenticated=true;
  stage='payload';
  var p=request.payload;
  var fields=['eventId','kind','to'].concat(p.kind==='temporary_access'?['name','password','url']:p.kind==='invitation'?['url']:['code']);
  if(p.kind==='invitation'&&p.local===true)fields.push('local');
  if(Object.prototype.hasOwnProperty.call(p,'logo'))fields.push('logo');
  if(Object.prototype.hasOwnProperty.call(p,'identidadCorreo'))fields.push('identidadCorreo');
  qmsMailRecord_(p,fields);
  if(Object.prototype.hasOwnProperty.call(p,'logo')&&
    (typeof p.logo!=='string'||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/branding\/identidad\/login_encabezado\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i.test(p.logo)))throw new Error('invalid');
  if(!qmsMailUuid_(p.eventId)||['invitation','email_otp','temporary_access'].indexOf(p.kind)===-1||typeof p.to!=='string'||p.to.length>254||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(p.to))throw new Error('invalid');
  if(p.kind==='email_otp'&&(typeof p.code!=='string'||!/^\d{6}$/.test(p.code)))throw new Error('invalid');
  if(p.kind==='invitation'){
   var origin=PropertiesService.getScriptProperties().getProperty('QMS_PUBLIC_TRACKING_ORIGIN');
   var prefix=origin+'/acceso#invitacion=';
   if(p.local===true){
    var localMatch=typeof p.url==='string'&&p.url.match(/^http:\/\/(localhost|127\.0\.0\.1):3000\/acceso#invitacion=([A-Za-z0-9_-]{43})$/);
    if(!localMatch)throw new Error('invalid');
   }else if(!origin||typeof p.url!=='string'||p.url.indexOf(prefix)!==0||!/^[A-Za-z0-9_-]{43}$/.test(p.url.slice(prefix.length)))throw new Error('invalid');
  }
  if(p.kind==='temporary_access'){
   // Las URLs de acceso están limitadas a orígenes administrados; no aceptar enlaces
   // externos aun cuando el cuerpo HMAC sea válido. El fallback corresponde al
   // dominio de producción de este mismo proyecto ECA-QMS.
   stage='login_origin';
   var props=PropertiesService.getScriptProperties();
   var origins=[props.getProperty('QMS_PUBLIC_TRACKING_ORIGIN'),props.getProperty('APP_PUBLIC_URL'),
     'https://mi-dashboard-iota.vercel.app','https://mi-dashboard-eca-s-projects2.vercel.app'];
   var approved=typeof p.url==='string'&&origins.some(function(origin) {
    return typeof origin==='string'&&/^https:\/\/[a-z0-9.-]+$/i.test(origin.replace(/\/$/,''))&&
      p.url===origin.replace(/\/$/,'')+'/login';
   });
   if(!approved)throw new Error('invalid');
   stage='credential_validation';
   if(typeof p.name!=='string'||!p.name.trim()||p.name.length>200||/[\r\n]/.test(p.name)
     ||typeof p.password!=='string'||!/^[!-~]{14,72}$/.test(p.password))throw new Error('invalid');
  }
 }catch(_){
  // Únicamente registrar la fase. NUNCA registrar destinatario, contraseña,
  // HMAC, nonce o URL en las ejecuciones de Apps Script.
  console.warn('qms_access_mail_validation_rejected',JSON.stringify({stage:stage,authenticated:authenticated}));
  if(authenticated&&request&&request.payload&&qmsMailUuid_(request.payload.eventId)){
   var failureCode=stage==='login_origin'?'login_origin_mismatch':'invalid_access_payload';
   return ContentService.createTextOutput(JSON.stringify(qmsMailSign_('access_delivery_receipt',{
    eventId:request.payload.eventId,requestNonce:request.envelope.nonce,
    outcome:'failed',code:failureCode
   },configuration.secret))).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({error:'invalid_access_delivery'})).setMimeType(ContentService.MimeType.JSON);
 }
 function reply(outcome,code){return ContentService.createTextOutput(JSON.stringify(qmsMailSign_('access_delivery_receipt',{eventId:p.eventId,requestNonce:request.envelope.nonce,outcome:outcome,...(code?{code:code}:{})},configuration.secret))).setMimeType(ContentService.MimeType.JSON);}
 if(!configuration.enabled)return reply('retry','disabled');
 var lock=LockService.getScriptLock();if(!lock.tryLock(5000))return reply('retry','ledger_busy');
 try {
  var cache=CacheService.getScriptCache(),key='qms-access-'+p.eventId;
  // Huella con HMAC: el diario temporal nunca permite adivinar un OTP de seis cifras.
  var delivery=Object.assign({},p);delete delivery.identidadCorreo;
  var bytes=Utilities.computeHmacSha256Signature(JSON.stringify(delivery),configuration.secret),fingerprint=bytes.map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
  var previous=cache.get(key);
  if(previous){var saved=JSON.parse(previous);return saved.hash===fingerprint?reply(saved.outcome):reply('failed','event_conflict');}
  if(MailApp.getRemainingDailyQuota()<1)return reply('retry','quota_exhausted');
  var message=qmsAccessMailContent_(p);
  var subtitle=p.kind==='temporary_access'?'Acceso inicial al sistema':p.kind==='invitation'?'Invitación de usuario':'Verificación de seguridad';
  var html=qmsMailFrame_(message.subject,subtitle,message.detail,message.footer,qmsMailBrandingIdentity_(p.identidadCorreo));
  cache.put(key,JSON.stringify({hash:fingerprint,outcome:'uncertain'}),21600);
  try {MailApp.sendEmail({to:p.to,subject:message.subject,body:message.body,htmlBody:html,name:'ECA-QMS'});cache.put(key,JSON.stringify({hash:fingerprint,outcome:'sent'}),21600);return reply('sent');}
  catch(_){return reply('uncertain','delivery_uncertain');}
 }catch(_){return reply('retry','access_mail_unavailable');
 }finally{lock.releaseLock();}
}

function qmsAccessMailButton_(url,label) {
 return '<p style="margin:12px 0 8px"><a href="'+qmsMailEscape_(url)+'" style="display:inline-block;padding:10px 18px;border-radius:4px;background:#024796;color:#fff;font-family:Inter,Roboto,Segoe UI,Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.5;text-decoration:none">'+label+'</a></p>';
}

function qmsAccessMailContent_(p) {
 var para='style="margin:0 0 9px;font-family:Inter,Roboto,Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.5;color:#212529"';
 if(p.kind==='temporary_access'){
  var expiry='Válida durante 72 horas. En el primer ingreso deberás cambiar esta contraseña.';
  var footer='Si no reconocés este acceso, contactá a la administración de ECA-QMS.';
  return {
   subject:'Tu acceso a ECA-QMS', footer:footer,
   body:['Usuario: '+p.to,'Contraseña temporal: '+p.password,'Iniciar sesión: '+p.url,expiry,footer].join('\n\n'),
   detail:
    '<table role="presentation" width="100%" style="width:100%;border-collapse:collapse;margin:0 0 6px;font-family:Inter,Roboto,Segoe UI,Arial,sans-serif">' +
    '<tr><td style="width:165px;padding:8px 8px 8px 0;vertical-align:top;color:#6c757d;font-size:14px">Usuario</td>' +
    '<td style="padding:8px 0;vertical-align:top;color:#212529;font-size:16px;overflow-wrap:anywhere">'+qmsMailEscape_(p.to)+'</td></tr>' +
    '<tr><td style="width:165px;padding:8px 8px 8px 0;vertical-align:top;color:#6c757d;font-size:14px">Contraseña temporal</td>' +
    '<td style="padding:8px 0;vertical-align:top;color:#212529;font-size:16px"><code style="font-family:Consolas,monospace;font-size:15px;overflow-wrap:anywhere">'+qmsMailEscape_(p.password)+'</code></td></tr></table>' +
    qmsAccessMailButton_(p.url,'Iniciar sesión') +
    '<p style="margin:6px 0 0;color:#6c757d;font-size:13px;line-height:1.5">'+qmsMailEscape_(expiry)+'</p>'
  };
 }
 var footer='Si no solicitaste este acceso, contactá a la administración.';
 if(p.kind==='invitation'){
  var instructions='Elegí tu contraseña desde el enlace seguro. Vence en 24 horas y se utiliza una sola vez.';
  var local=p.local===true?'Invitación del entorno local de pruebas. Abrila en la misma computadora donde está abierto ECA-QMS.':'';
  return {subject:'Configurá tu acceso a ECA-QMS',footer:footer,
   body:'Te invitaron a ECA-QMS. '+instructions+'\n\n'+p.url+(local?'\n\n'+local:''),
   detail:'<p '+para+'>'+qmsMailEscape_(instructions)+'</p>'+qmsAccessMailButton_(p.url,'Configurar acceso')+
    (local?'<p style="margin:8px 0;font-family:Inter,Roboto,Segoe UI,Arial,sans-serif;font-size:13px;line-height:1.5;color:#6c757d">'+qmsMailEscape_(local)+'</p>':'')};
 }
 return {subject:'Tu código de verificación de ECA-QMS',footer:footer,
  body:'Tu código de verificación es '+p.code+'. Vence en 10 minutos. No lo compartás.',
  detail:'<p '+para+'>Tu código de verificación es:</p><p style="margin:0 0 8px;font-family:Inter,Roboto,Segoe UI,Arial,sans-serif;font-size:26px;font-weight:600;letter-spacing:5px;color:#024796">'+
   qmsMailEscape_(p.code)+'</p><p '+para+'>Vence en 10 minutos. No lo compartás.</p>'};
}

/**
 * Diagnóstico manual sin enviar correo. Ejecutar desde el editor Apps Script,
 * y volver a PUBLICAR la implementación /exec existente después de guardar.
 * Nunca imprime secretos ni credenciales.
 */
function qmsAccessMailHealthCheck() {
 var props=PropertiesService.getScriptProperties();
 var secret=props.getProperty('QMS_MAIL_SECRET')||'';
 var login=props.getProperty('QMS_PUBLIC_TRACKING_ORIGIN')||'';
 var app=props.getProperty('APP_PUBLIC_URL')||'';
 var result={
  handler:'access_delivery_request/temporary_access',
  ready:secret.length>=32&&props.getProperty('QMS_MAIL_ENABLED')==='true',
  signingSecretConfigured:secret.length>=32,
  mailEnabled:props.getProperty('QMS_MAIL_ENABLED')==='true',
  trackingOriginConfigured:/^https:\/\/[a-z0-9.-]+$/i.test(login),
  appOriginConfigured:/^https:\/\/[a-z0-9.-]+$/i.test(app),
  deploymentMustBeUpdated:true
 };
 console.info('qms_access_mail_health',JSON.stringify(result));
 return result;
}
