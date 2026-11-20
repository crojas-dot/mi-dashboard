/** Invitaciones/OTP: sobre de propósito exclusivo, sin outbox ni contraseña en correo. */
function qmsAccessMailPost_(e) {
 var configuration,request;
 try {
  configuration=qmsMailConfiguration_();
  if(!e||!e.postData||Utilities.newBlob(e.postData.contents).getBytes().length>4096)throw new Error('invalid');
  request=qmsMailVerify_(JSON.parse(e.postData.contents),'access_delivery_request',configuration.secret,2048);
  var p=request.payload;
  var fields=p.kind==='invitation'?['eventId','kind','to','url']:['eventId','kind','to','code'];
  if(p.kind==='invitation'&&p.local===true)fields.push('local');
  if(Object.prototype.hasOwnProperty.call(p,'logo'))fields.push('logo');
  qmsMailRecord_(p,fields);
  if(Object.prototype.hasOwnProperty.call(p,'logo')&&
    (typeof p.logo!=='string'||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/branding\/identidad\/login_encabezado\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i.test(p.logo)))throw new Error('invalid');
  if(!qmsMailUuid_(p.eventId)||['invitation','email_otp'].indexOf(p.kind)===-1||typeof p.to!=='string'||p.to.length>254||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(p.to))throw new Error('invalid');
  if(p.kind==='email_otp'&&(typeof p.code!=='string'||!/^\d{6}$/.test(p.code)))throw new Error('invalid');
  if(p.kind==='invitation'){
   var origin=PropertiesService.getScriptProperties().getProperty('QMS_PUBLIC_TRACKING_ORIGIN');
   var prefix=origin+'/acceso#invitacion=';
   if(p.local===true){
    var localMatch=typeof p.url==='string'&&p.url.match(/^http:\/\/(localhost|127\.0\.0\.1):3000\/acceso#invitacion=([A-Za-z0-9_-]{43})$/);
    if(!localMatch)throw new Error('invalid');
   }else if(!origin||typeof p.url!=='string'||p.url.indexOf(prefix)!==0||!/^[A-Za-z0-9_-]{43}$/.test(p.url.slice(prefix.length)))throw new Error('invalid');
  }
 }catch(_){return ContentService.createTextOutput(JSON.stringify({error:'invalid_access_delivery'})).setMimeType(ContentService.MimeType.JSON);}
 function reply(outcome){return ContentService.createTextOutput(JSON.stringify(qmsMailSign_('access_delivery_receipt',{eventId:p.eventId,requestNonce:request.envelope.nonce,outcome:outcome},configuration.secret))).setMimeType(ContentService.MimeType.JSON);}
 if(!configuration.enabled)return reply('retry');
 var lock=LockService.getScriptLock();if(!lock.tryLock(5000))return reply('retry');
 try {
  var cache=CacheService.getScriptCache(),key='qms-access-'+p.eventId;
  // Huella con HMAC: el diario temporal nunca permite adivinar un OTP de seis cifras.
  var bytes=Utilities.computeHmacSha256Signature(JSON.stringify(p),configuration.secret),fingerprint=bytes.map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
  var previous=cache.get(key);
  if(previous){var saved=JSON.parse(previous);return reply(saved.hash===fingerprint?saved.outcome:'failed');}
  if(MailApp.getRemainingDailyQuota()<1)return reply('retry');
  cache.put(key,JSON.stringify({hash:fingerprint,outcome:'uncertain'}),21600);
  var invitation=p.kind==='invitation',subject=invitation?'Configurá tu acceso a ECA-QMS':'Tu código de verificación de ECA-QMS';
  var body=invitation?'Te invitaron a ECA-QMS. Elegí tu contraseña desde el enlace seguro. Vence en 24 horas y se utiliza una sola vez.\n\n'+p.url
   :'Tu código de verificación es '+p.code+'. Vence en 10 minutos. No lo compartás.';
  if(invitation&&p.local===true)body+='\n\nInvitación del entorno local de pruebas. Abrila en la misma computadora donde está abierto ECA-QMS.';
  var detail=invitation?'<p>Elegí tu contraseña desde el enlace seguro. Vence en 24 horas y se utiliza una sola vez.</p><p><a href="'+qmsMailEscape_(p.url)+'" style="display:inline-block;padding:12px 20px;border-radius:4px;background:#024796;color:#fff;text-decoration:none">Configurar acceso</a></p>'
   :'<p>Tu código de verificación es:</p><p style="font-size:28px;font-weight:600;letter-spacing:6px;color:#024796">'+p.code+'</p><p>Vence en 10 minutos. No lo compartás.</p>';
  if(invitation&&p.local===true)detail+='<p style="font-size:12px;color:#6c757d">Invitación del entorno local de pruebas. Abrila en la misma computadora donde está abierto ECA-QMS.</p>';
  var branding=p.logo
   ? '<table role="presentation" style="border-collapse:collapse"><tr><td width="180" height="60" align="left" style="width:180px;height:60px"><img src="'+qmsMailEscape_(p.logo)+'" alt="ECA" width="180" height="60" style="display:block;width:180px;height:60px;border:0"></td><td style="padding-left:12px"><div style="font-size:18px;font-weight:600;color:#024796">ECA-QMS</div><div style="font-size:13px;color:#6c757d">Gestión de Calidad</div></td></tr></table>'
   : '<p style="font-size:18px;font-weight:600;color:#024796">ECA-QMS</p>';
  var html='<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f4f7f6;font-family:Arial,sans-serif;color:#212529"><div style="max-width:600px;margin:auto;padding:24px;border:1px solid #dee2e6;border-radius:6px;background:#fff">'+branding+'<h1 style="font-size:22px">'+subject+'</h1>'+detail+'<p style="font-size:12px;color:#6c757d">Si no solicitaste este acceso, contactá a la administración.</p></div></body></html>';
  try {MailApp.sendEmail({to:p.to,subject:subject,body:body,htmlBody:html,name:'ECA-QMS'});cache.put(key,JSON.stringify({hash:fingerprint,outcome:'sent'}),21600);return reply('sent');}
  catch(_){return reply('uncertain');}
 }finally{lock.releaseLock();}
}
