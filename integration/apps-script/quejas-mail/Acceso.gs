/** Envío de acceso transitorio: el recibo solo contiene identificadores y resultado. */
function qmsAccessMailPost_(e) {
 var configuration,request;
 try {
  configuration=qmsMailConfiguration_();
  if(!e||!e.postData||Utilities.newBlob(e.postData.contents).getBytes().length>4096)throw new Error('invalid');
  request=qmsMailVerify_(JSON.parse(e.postData.contents),'access_delivery_request',configuration.secret,2048);
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
   var loginOrigin=PropertiesService.getScriptProperties().getProperty('QMS_PUBLIC_TRACKING_ORIGIN');
   if(!/^https:\/\/[^/?#]+$/.test(loginOrigin||'')||p.url!==loginOrigin+'/login'||typeof p.name!=='string'||!p.name.trim()||p.name.length>200||/[\r\n]/.test(p.name)
     ||typeof p.password!=='string'||!/^[!-~]{14,72}$/.test(p.password))throw new Error('invalid');
  }
 }catch(_){return ContentService.createTextOutput(JSON.stringify({error:'invalid_access_delivery'})).setMimeType(ContentService.MimeType.JSON);}
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
 return '<p><a href="'+qmsMailEscape_(url)+'" style="display:inline-block;padding:12px 20px;border-radius:4px;background:#024796;color:#fff;text-decoration:none">'+label+'</a></p>';
}

function qmsAccessMailContent_(p) {
 if(p.kind==='temporary_access'){
  var greeting='Hola, '+p.name+':';
  var expiry='Usá esta contraseña para el primer ingreso. Vence en 72 horas y el sistema te pedirá cambiarla.';
  var footer='Si no esperabas este acceso, comunicáte con la administración del sistema.';
  return {
   subject:'Tu acceso a ECA-QMS está listo', footer:footer,
   body:[greeting,'Se creó tu acceso a ECA-QMS.','Usuario: '+p.to,'Contraseña temporal: '+p.password,'Acceder a ECA-QMS: '+p.url,expiry,footer].join('\n\n'),
   detail:'<p>'+qmsMailEscape_(greeting)+'</p><p>Se creó tu acceso a ECA-QMS.</p><p><strong>Usuario:</strong> '+qmsMailEscape_(p.to)
    +'<br><strong>Contraseña temporal:</strong> <code>'+qmsMailEscape_(p.password)+'</code></p>'+qmsAccessMailButton_(p.url,'Acceder a ECA-QMS')+'<p>'+expiry+'</p>'
  };
 }
 var footer='Si no solicitaste este acceso, contactá a la administración.';
 if(p.kind==='invitation'){
  var instructions='Elegí tu contraseña desde el enlace seguro. Vence en 24 horas y se utiliza una sola vez.';
  var local=p.local===true?'Invitación del entorno local de pruebas. Abrila en la misma computadora donde está abierto ECA-QMS.':'';
  return {subject:'Configurá tu acceso a ECA-QMS',footer:footer,
   body:'Te invitaron a ECA-QMS. '+instructions+'\n\n'+p.url+(local?'\n\n'+local:''),
   detail:'<p>'+instructions+'</p>'+qmsAccessMailButton_(p.url,'Configurar acceso')+(local?'<p style="font-size:12px;color:#6c757d">'+local+'</p>':'')};
 }
 return {subject:'Tu código de verificación de ECA-QMS',footer:footer,body:'Tu código de verificación es '+p.code+'. Vence en 10 minutos. No lo compartás.',
  detail:'<p>Tu código de verificación es:</p><p style="font-size:28px;font-weight:600;letter-spacing:6px;color:#024796">'+p.code+'</p><p>Vence en 10 minutos. No lo compartás.</p>'};
}
