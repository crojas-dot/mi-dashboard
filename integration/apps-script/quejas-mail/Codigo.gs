/** Servicio independiente de correo. No modifica el procesador de archivos. */
/** Ejecutar una vez tras autorizar drive.readonly. No reclama ni envía correos. */
function qmsMailEnableOfficialAttachments() {
  DriveApp.getRootFolder();
  PropertiesService.getScriptProperties().setProperty('QMS_MAIL_ATTACH_OFFICIAL_DOCUMENTS', 'true');
}

function doPost(e) {
  try {
    if (e && e.postData && e.postData.contents.length <= 4096
      && JSON.parse(e.postData.contents).purpose === 'queue_wake_setup_request') return qmsMailWakeSetup_(e);
    if (e && e.postData && e.postData.contents.length <= 4096
      && JSON.parse(e.postData.contents).purpose === 'queue_wake_request') return qmsMailWake_(e);
  } catch (_) { /* El manejador habitual devuelve un rechazo seguro. */ }
  return qmsMailHandlePost(e);
}

/** Configuración de máquina firmada: no reclama cola ni envía mensajes. */
function qmsMailWakeSetup_(e) {
  var authenticated = false, stage = 'configuration';
  try {
    var configuration = qmsMailConfiguration_();
    if (Utilities.newBlob(e.postData.contents).getBytes().length > 4096) throw new Error('invalid_mail_request');
    var request = qmsMailVerify_(JSON.parse(e.postData.contents), 'queue_wake_setup_request', configuration.secret, 1024);
    authenticated = true; stage = 'payload';
    qmsMailRecord_(request.payload, ['secret', 'eventId']);
    var secret = request.payload.secret;
    if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret) || secret === configuration.secret) throw new Error('invalid_mail_request');
    if (request.payload.eventId !== undefined && !qmsMailUuid_(request.payload.eventId)) throw new Error('invalid_mail_request');
    stage = 'authorization';
    var authorization = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    if (authorization.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) {
      return ContentService.createTextOutput(JSON.stringify(qmsMailSign_('queue_wake_setup_receipt', {
        requestNonce: request.envelope.nonce, configured: false, authorizationRequired: true,
        authorizationUrl: authorization.getAuthorizationUrl()
      }, configuration.secret))).setMimeType(ContentService.MimeType.JSON);
    }
    stage = 'drive'; DriveApp.getRootFolder();
    stage = 'lock';
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) throw new Error('setup_busy');
    try {
      stage = 'settings';
      var props = PropertiesService.getScriptProperties(), existing = props.getProperty('QMS_MAIL_WAKE_SECRET');
      if (existing && existing !== secret) throw new Error('wake_already_configured');
      props.setProperty('QMS_MAIL_WAKE_SECRET', secret);
      var deliveryState;
      if (request.payload.eventId !== undefined) {
        // Antes de recuperar un fallo previo al envío, comprobar el diario bajo
        // el mismo lock que MailApp. Nunca devolver destinatario ni contenido.
        stage = 'ledger';
        var sheet = qmsMailLedger_(configuration), row = sheet.getLastRow() > 1
          ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(request.payload.eventId).matchEntireCell(true).findNext() : null;
        var recorded = row ? sheet.getRange(row.getRow(), 3).getValues()[0][0] : null;
        deliveryState = !row ? 'absent' : recorded === 'sent' ? 'sent' : 'uncertain';
      }
    } finally { lock.releaseLock(); }
    return ContentService.createTextOutput(JSON.stringify(qmsMailSign_('queue_wake_setup_receipt', {
      requestNonce: request.envelope.nonce, configured: true, driveReady: true,
      ...(deliveryState ? { deliveryState: deliveryState } : {})
    }, configuration.secret))).setMimeType(ContentService.MimeType.JSON);
  } catch (_) { return ContentService.createTextOutput(JSON.stringify({ error: 'wake_setup_unavailable', ...(authenticated ? { stage: stage } : {}) })).setMimeType(ContentService.MimeType.JSON); }
}

/** Despertador sin datos de correo. El claim, diario, cuota y ACK siguen en el emisor directo. */
function qmsMailWake_(e) {
  var configuration, request, secret;
  try {
    secret = PropertiesService.getScriptProperties().getProperty('QMS_MAIL_WAKE_SECRET');
    if (!secret || Utilities.newBlob(secret).getBytes().length < 32) throw new Error('wake_not_configured');
    if (Utilities.newBlob(e.postData.contents).getBytes().length > 4096) throw new Error('invalid_mail_request');
    request = qmsMailVerify_(JSON.parse(e.postData.contents), 'queue_wake_request', secret, 16);
    qmsMailRecord_(request.payload, []);
    configuration = qmsMailConfiguration_();
  } catch (_) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'invalid_mail_request' })).setMimeType(ContentService.MimeType.JSON);
  }
  var reply = function (status) {
    return ContentService.createTextOutput(JSON.stringify(qmsMailSign_('queue_wake_receipt', {
      requestNonce: request.envelope.nonce, status: status
    }, secret))).setMimeType(ContentService.MimeType.JSON);
  };
  if (!configuration.enabled || configuration.transport !== 'supabase') return reply('disabled');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return reply('busy');
  try {
    var cache = CacheService.getScriptCache(), key = 'qms-wake-' + request.envelope.nonce;
    if (cache.get(key)) return reply('busy');
    cache.put(key, '1', 360);
  } finally { lock.releaseLock(); }
  // No mantener el lock durante HTTP. El poll y el despertador comparten el lease.
  // Esperar brevemente al poll periódico evita perder el evento por un lock concurrente.
  for (var attempt = 0; attempt < 10; attempt++) {
    if (qmsMailPollDirect_(configuration, true) !== false) return reply('accepted');
    Utilities.sleep(500);
  }
  return reply('busy');
}
function qmsMailIsRequest(e) {
  try { return JSON.parse(e.postData.contents).purpose === 'delivery_request'; }
  catch (_) { return false; }
}

function qmsMailConfiguration_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('QMS_MAIL_SECRET');
  if (!secret || Utilities.newBlob(secret).getBytes().length < 32) throw new Error('mail_not_configured');
  return {
    secret: secret,
    enabled: props.getProperty('QMS_MAIL_ENABLED') === 'true',
    ledgerId: props.getProperty('QMS_MAIL_LEDGER_SPREADSHEET_ID'),
    workerUrl: props.getProperty('QMS_MAIL_WORKER_URL'),
    transport: props.getProperty('QMS_MAIL_TRANSPORT') || 'legacy',
    queueUrl: props.getProperty('QMS_MAIL_QUEUE_URL'),
    replyTo: props.getProperty('QMS_MAIL_REPLY_TO'),
    senderName: 'QMS ECA'
  };
}

function qmsMailHex_(bytes) {
  return bytes.map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function qmsMailRecord_(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_mail_request');
  if (keys && Object.keys(value).some(function (key) { return keys.indexOf(key) === -1; })) throw new Error('invalid_mail_request');
  return value;
}

function qmsMailSignature_(envelope, secret) {
  var input = 'eca-qms-mail:v1:' + envelope.purpose + '\n' + envelope.issuedAt + '\n' + envelope.nonce + '\n' + envelope.payload;
  return qmsMailHex_(Utilities.computeHmacSha256Signature(input, secret, Utilities.Charset.UTF_8));
}

function qmsMailSign_(purpose, payload, secret) {
  var envelope = {
    version: 1, purpose: purpose, issuedAt: Math.floor(Date.now() / 1000), nonce: Utilities.getUuid(),
    payload: Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify(payload)).getBytes()).replace(/=+$/, '')
  };
  envelope.signature = qmsMailSignature_(envelope, secret);
  return envelope;
}

function qmsMailVerify_(value, purpose, secret, maxPayload) {
  var envelope = qmsMailRecord_(value, ['version', 'purpose', 'issuedAt', 'nonce', 'payload', 'signature']);
  var now = Math.floor(Date.now() / 1000);
  if (envelope.version !== 1 || envelope.purpose !== purpose || !Number.isSafeInteger(envelope.issuedAt)
    || now - envelope.issuedAt > 300 || envelope.issuedAt - now > 30
    || typeof envelope.nonce !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(envelope.nonce)
    || typeof envelope.payload !== 'string' || envelope.payload.length > (maxPayload || 32768) || !/^[A-Za-z0-9_-]+$/.test(envelope.payload)
    || typeof envelope.signature !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.signature)) throw new Error('invalid_mail_request');
  var expected = qmsMailSignature_(envelope, secret);
  var mismatch = 0;
  for (var index = 0; index < 64; index++) mismatch |= expected.charCodeAt(index) ^ envelope.signature.charCodeAt(index);
  if (mismatch !== 0) throw new Error('invalid_mail_request');
  var decoded = Utilities.base64DecodeWebSafe(envelope.payload);
  if (Utilities.base64EncodeWebSafe(decoded).replace(/=+$/, '') !== envelope.payload) throw new Error('invalid_mail_request');
  return { envelope: envelope, payload: JSON.parse(Utilities.newBlob(decoded).getDataAsString('UTF-8')) };
}

function qmsMailReceipt_(secret, request, outcome, code, delay) {
  return ContentService.createTextOutput(JSON.stringify(qmsMailSign_('delivery_receipt', {
    eventId: request.payload.eventId, requestNonce: request.envelope.nonce,
    outcome: outcome, code: code, retryAfterSeconds: delay || 300
  }, secret))).setMimeType(ContentService.MimeType.JSON);
}

function qmsMailInternalKind_(kind) {
  return ['interno_recibido', 'interno_evaluacion_1', 'interno_asignacion', 'interno_investigacion_5',
    'interno_investigacion_3', 'interno_evaluacion_vencida', 'interno_investigacion_vencida'].indexOf(kind) !== -1;
}

/** Dominio institucional fijado en propiedades; nunca seguir URLs arbitrarias del lote. */
function qmsMailTrackingUrl_(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  var match = /^(https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)\/q\/seguimiento#clave=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(value);
  var expected = PropertiesService.getScriptProperties().getProperty('QMS_PUBLIC_TRACKING_ORIGIN');
  return !!match && !!expected && match[1] === expected;
}

function qmsMailValidMessage_(payload, allowInternal) {
  qmsMailRecord_(payload, ['eventId', 'kind', 'to', 'subject', 'body', 'folio', 'trackingUrl']);
  return typeof payload.eventId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.eventId)
    && (['recibido', 'final'].indexOf(payload.kind) !== -1
      || allowInternal === true && qmsMailInternalKind_(payload.kind))
    && typeof payload.folio === 'string' && payload.folio.length > 0 && payload.folio.length <= 120 && !/[\u0000-\u001f\u007f]/.test(payload.folio)
    && typeof payload.to === 'string' && payload.to.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(payload.to)
    && typeof payload.subject === 'string' && payload.subject.length > 0 && payload.subject.length <= 180 && !/[\u0000-\u001f\u007f]/.test(payload.subject)
    && typeof payload.body === 'string' && payload.body.length > 0 && payload.body.length <= 6000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(payload.body)
    && (!Object.prototype.hasOwnProperty.call(payload, 'trackingUrl')
      || !qmsMailInternalKind_(payload.kind) && qmsMailTrackingUrl_(payload.trackingUrl));
}

function qmsMailLedger_(configuration) {
  if (!configuration.ledgerId) throw new Error('ledger_unavailable');
  var sheet = SpreadsheetApp.openById(configuration.ledgerId).getSheetByName('_qms_mail_delivery');
  if (!sheet) throw new Error('ledger_unavailable');
  return sheet;
}

function qmsMailHandlePost(e) {
  var configuration, request;
  try {
    configuration = qmsMailConfiguration_();
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 32768
      || Utilities.newBlob(e.postData.contents).getBytes().length > 32768) throw new Error('invalid_mail_request');
    request = qmsMailVerify_(JSON.parse(e.postData.contents), 'delivery_request', configuration.secret);
    qmsMailRecord_(request.payload);
  } catch (_) {
    // ContentService no permite escoger status HTTP: Node exige una respuesta firmada y correlacionada.
    return ContentService.createTextOutput(JSON.stringify({ error: 'invalid_mail_request' })).setMimeType(ContentService.MimeType.JSON);
  }
  // El transporte legacy no tiene preflight de DB: nunca acepta los avisos internos.
  if (!qmsMailValidMessage_(request.payload)) return qmsMailReceipt_(configuration.secret, request, 'failed', 'invalid_delivery');
  // El transporte directo nunca vuelve al endpoint /exec ni permite envíos legacy.
  if (!configuration.enabled || configuration.transport === 'supabase') return qmsMailReceipt_(configuration.secret, request, 'retry', 'disabled');
  var result = qmsMailDeliver_(configuration, request.payload);
  return qmsMailReceipt_(configuration.secret, request, result.outcome, result.code, result.retryAfterSeconds);
}

function qmsMailFingerprint_(payload) {
  // No añadir null/undefined a mensajes antiguos: sus hashes ya están en el diario.
  var fields = [payload.eventId, payload.kind, payload.to, payload.subject, payload.body, payload.folio];
  if (Object.prototype.hasOwnProperty.call(payload, 'trackingUrl')) fields.push(payload.trackingUrl);
  return qmsMailHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(fields), Utilities.Charset.UTF_8));
}

/** El diario conserva la entrega previa aunque el aviso ya no corresponda hoy. */
function qmsMailRecordedDelivery_(sheet, payload) {
  var existing = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(payload.eventId).matchEntireCell(true).findNext() : null;
  if (!existing) return null;
  var previous = sheet.getRange(existing.getRow(), 1, 1, 5).getValues()[0];
  if (previous[1] !== qmsMailFingerprint_(payload)) return { outcome: 'failed', code: 'event_conflict', retryAfterSeconds: 300 };
  return previous[2] === 'sent'
    ? { outcome: 'sent', code: 'already_sent', retryAfterSeconds: 300 }
    : { outcome: 'uncertain', code: 'delivery_uncertain', retryAfterSeconds: 300 };
}

/** El diario y MailApp son el único límite de entrega, compartido por ambos transportes. */
function qmsMailDeliver_(configuration, payload, officialDocument) {
  function result(outcome, code, delay) { return { outcome: outcome, code: code, retryAfterSeconds: delay || 300 }; }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return result('retry', 'ledger_busy', 60);
  try {
    if (PropertiesService.getScriptProperties().getProperty('QMS_MAIL_ENABLED') !== 'true') return result('retry', 'disabled');
    var sheet;
    try { sheet = qmsMailLedger_(configuration); }
    catch (_) { return result('retry', 'ledger_unavailable'); }
    var recorded = qmsMailRecordedDelivery_(sheet, payload);
    if (recorded) return recorded;
    // Un resultado final nuevo nunca se entrega sin su documento físico.
    // El diario se comprueba primero para no reenviar una entrega histórica.
    if (payload.kind === 'final' && !officialDocument) return result('retry', 'authorization_unavailable');
    if (MailApp.getRemainingDailyQuota() < 1) return result('retry', 'quota_exhausted', 86400);
    var mail = { to: payload.to, subject: payload.subject, body: payload.body,
      name: configuration.senderName, htmlBody: qmsMailHtml_(payload) };
    if (officialDocument) {
      // Descargar antes de escribir attempting: un fallo de Drive no es una entrega incierta.
      try {
        var document = DriveApp.getFileById(officialDocument.driveId);
        if (document.isTrashed() || document.getSize() !== officialDocument.size || document.getMimeType() !== officialDocument.mime) throw new Error('document_changed');
        var blob = document.getBlob().setName(officialDocument.name);
        if (blob.getBytes().length !== officialDocument.size) throw new Error('document_changed');
        mail.attachments = [blob];
      } catch (_) { return result('retry', 'authorization_unavailable', 300); }
    }
    if (configuration.replyTo) {
      if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(configuration.replyTo) || configuration.replyTo.length > 254) {
        return result('retry', 'ledger_unavailable');
      }
      mail.replyTo = configuration.replyTo;
    }
    var row = sheet.getLastRow() + 1;
    // Diario ANTES de sendEmail: si se corta la ejecución, nunca volver a enviar automáticamente.
    // Guarda UUID/hash/estado/fechas; no guarda correo, folio ni contenido del expediente.
    sheet.appendRow([payload.eventId, qmsMailFingerprint_(payload), 'attempting', new Date(), '']);
    SpreadsheetApp.flush();
    try {
      MailApp.sendEmail(mail);
      sheet.getRange(row, 3).setValue('sent');
      sheet.getRange(row, 5).setValue(new Date());
      SpreadsheetApp.flush();
      return result('sent', 'sent');
    } catch (_) {
      // MailApp no proporciona una clave idempotente: pudo aceptar el correo antes de fallar.
      try { sheet.getRange(row, 3).setValue('uncertain'); SpreadsheetApp.flush(); } catch (_) { /* attempting también bloquea reenvío */ }
      return result('uncertain', 'delivery_uncertain');
    }
  } catch (_) {
    return result('uncertain', 'delivery_uncertain');
  } finally { lock.releaseLock(); }
}

/** Preparar manualmente con el correo apagado; nunca instala el trigger ni envía. */
function qmsMailInitializeLedger() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error('ledger_busy');
  try {
    var configuration = qmsMailConfiguration_();
    if (configuration.enabled) throw new Error('mail_initialization_enabled');
    var book;
    if (configuration.ledgerId) {
      book = SpreadsheetApp.openById(configuration.ledgerId);
    } else {
      // Crear en Mi unidad no garantiza privacidad: Workspace puede aplicar acceso por enlace.
      // Verificar y restringir la ACL del libro antes de activar; no ampliar scopes para compartir.
      // Persistir el ID antes de preparar la pestaña permite recuperar una ejecución cortada.
      book = SpreadsheetApp.create('QMS ECA - Diario de correos');
      PropertiesService.getScriptProperties().setProperty('QMS_MAIL_LEDGER_SPREADSHEET_ID', book.getId());
    }
    if (book.getSheetByName('_qms_mail_delivery')) return;
    var sheet = book.insertSheet('_qms_mail_delivery');
    sheet.appendRow(['event_id', 'payload_sha256', 'delivery_status', 'started_at', 'confirmed_at']);
    sheet.setFrozenRows(1);
  } finally { lock.releaseLock(); }
}

/** Instalar explícitamente; no envía correo ni se ejecuta al copiar el archivo. */
function qmsMailInstallTrigger() {
  var configuration = qmsMailConfiguration_();
  qmsMailLedger_(configuration);
  if (!configuration.enabled) throw new Error('worker_not_configured');
  if (configuration.transport === 'supabase') qmsMailQueueUrl_(configuration);
  else if (configuration.transport !== 'legacy' || !/^https:\/\/[^/?#]+\/api\/quejas\/correos$/.test(configuration.workerUrl || '')) throw new Error('worker_not_configured');
  if (!ScriptApp.getProjectTriggers().some(function (trigger) { return trigger.getHandlerFunction() === 'qmsMailPoll'; })) {
    ScriptApp.newTrigger('qmsMailPoll').timeBased().everyMinutes(5).create();
  }
}

function qmsMailPoll() {
  var configuration = qmsMailConfiguration_();
  if (!configuration.enabled) return;
  if (configuration.transport === 'supabase') return qmsMailPollDirect_(configuration);
  if (configuration.transport !== 'legacy') throw new Error('worker_not_configured');
  if (!/^https:\/\/[^/?#]+\/api\/quejas\/correos$/.test(configuration.workerUrl || '')) throw new Error('worker_not_configured');
  var owner = Utilities.getUuid();
  if (!qmsMailPollLease_(owner)) return;
  // No mantener ScriptLock durante el HTTP: el doPost del mismo proyecto necesita ese lock.
  try {
    var envelope = qmsMailSign_('worker_request', { action: 'dispatch', limit: 5 }, configuration.secret);
    var response = UrlFetchApp.fetch(configuration.workerUrl, { method: 'post', contentType: 'application/json',
      payload: JSON.stringify(envelope), followRedirects: false, muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw new Error('worker_unavailable');
    var receipt = qmsMailVerify_(JSON.parse(response.getContentText()), 'worker_receipt', configuration.secret);
    if (receipt.payload.requestNonce !== envelope.nonce) throw new Error('invalid_worker_receipt');
    // Registrar solo contadores, nunca payload firmado, destinatarios ni body.
    console.info('QMS mail batch', JSON.stringify({ claimed: receipt.payload.claimed, sent: receipt.payload.sent,
      retry: receipt.payload.retry, uncertain: receipt.payload.uncertain, failed: receipt.payload.failed }));
  } catch (_) { console.warn('QMS mail worker unavailable'); }
  finally { qmsMailReleasePoll_(owner); }
}

/** Una URL exacta impide entregar la firma o datos de la cola a otro proyecto/host. */
function qmsMailQueueUrl_(configuration) {
  var expected = 'https://fykhrrpeoehwqznccmfp.supabase.co/functions/v1/quejas-mail-queue';
  if (configuration.transport !== 'supabase' || configuration.queueUrl !== expected) throw new Error('queue_not_configured');
  return expected;
}

/** HTTP directo: no redirecciones, claves Supabase, reintentos ni callback a /exec. */
function qmsMailQueueRequest_(configuration, purpose, payload, receiptPurpose) {
  var envelope = qmsMailSign_(purpose, payload, configuration.secret);
  var response = UrlFetchApp.fetch(qmsMailQueueUrl_(configuration), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(envelope),
    followRedirects: false, muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('queue_unavailable');
  var text = response.getContentText();
  if (!text || text.length > 65536 || Utilities.newBlob(text).getBytes().length > 65536) throw new Error('invalid_queue_receipt');
  var receipt = qmsMailVerify_(JSON.parse(text), receiptPurpose, configuration.secret, 65536);
  if (!receipt.payload || receipt.payload.requestNonce !== envelope.nonce) throw new Error('invalid_queue_receipt');
  return receipt.payload;
}

function qmsMailUuid_(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Validar el lote completo antes de tocar MailApp, incluso si el primer mensaje era válido. */
function qmsMailClaimReceipt_(payload, limit) {
  qmsMailRecord_(payload, ['requestNonce', 'leaseUntil', 'messages']);
  if (!qmsMailUuid_(payload.requestNonce) || typeof payload.leaseUntil !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(payload.leaseUntil)
    || !Array.isArray(payload.messages) || payload.messages.length > limit || payload.messages.length > 5) throw new Error('invalid_queue_receipt');
  var expires = Date.parse(payload.leaseUntil);
  if (!Number.isFinite(expires) || expires <= Date.now() || expires - Date.now() > 600000) throw new Error('invalid_queue_receipt');
  var seen = {};
  var messages = payload.messages.map(function (value) {
    qmsMailRecord_(value, ['eventId', 'claimToken', 'kind', 'to', 'subject', 'body', 'folio', 'trackingUrl']);
    if (!qmsMailUuid_(value.claimToken)) throw new Error('invalid_queue_receipt');
    var message = { eventId: value.eventId, kind: value.kind, to: value.to,
      subject: value.subject, body: value.body, folio: value.folio };
    if (Object.prototype.hasOwnProperty.call(value, 'trackingUrl')) message.trackingUrl = value.trackingUrl;
    if (!qmsMailValidMessage_(message, true) || seen[message.eventId.toLowerCase()]) throw new Error('invalid_queue_receipt');
    seen[message.eventId.toLowerCase()] = true;
    return { message: message, claimToken: value.claimToken };
  });
  return { messages: messages, expires: expires };
}

function qmsMailAck_(configuration, entry, result) {
  var receipt = qmsMailQueueRequest_(configuration, 'ack_request', {
    eventId: entry.message.eventId, claimToken: entry.claimToken,
    outcome: result.outcome, code: result.code, retryAfterSeconds: result.retryAfterSeconds
  }, 'ack_receipt');
  qmsMailRecord_(receipt, ['requestNonce', 'eventId', 'accepted']);
  if (receipt.eventId !== entry.message.eventId || receipt.accepted !== true) throw new Error('queue_ack_failed');
}

/** null permite intentar la entrega; cualquier resultado evita MailApp y se confirma por ACK. */
function qmsMailAuthorizeInternal_(configuration, entry) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return { outcome: 'retry', code: 'ledger_busy', retryAfterSeconds: 60 };
  try {
    if (PropertiesService.getScriptProperties().getProperty('QMS_MAIL_ENABLED') !== 'true') {
      return { outcome: 'retry', code: 'disabled', retryAfterSeconds: 300 };
    }
    try {
      // Un ACK perdido no puede convertir una entrega previa en un simple descarte.
      var recorded = qmsMailRecordedDelivery_(qmsMailLedger_(configuration), entry.message);
      if (recorded) return recorded;
    } catch (_) { return { outcome: 'retry', code: 'ledger_unavailable', retryAfterSeconds: 300 }; }
  } finally { lock.releaseLock(); }
  try {
    // Nunca mantener ScriptLock durante HTTP ni escribir attempting antes de autorizar.
    var attach = entry.message.kind === 'final';
    var receipt = qmsMailQueueRequest_(configuration, 'authorize_request', {
      eventId: entry.message.eventId, claimToken: entry.claimToken,
      ...(attach ? { includeOfficialDocument: true } : {})
    }, 'authorize_receipt');
    qmsMailRecord_(receipt, ['requestNonce', 'eventId', 'authorized', 'officialDocument']);
    if (receipt.eventId !== entry.message.eventId || typeof receipt.authorized !== 'boolean') throw new Error('invalid_queue_receipt');
    if (attach && receipt.authorized) {
      if (!Object.prototype.hasOwnProperty.call(receipt, 'officialDocument')) throw new Error('attachment_protocol_unavailable');
      var file = receipt.officialDocument;
      if (file !== null) {
        qmsMailRecord_(file, ['driveId', 'name', 'mime', 'size']);
        if (typeof file.driveId !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(file.driveId)
          || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 255 || /[\u0000-\u001f\u007f/\\]/.test(file.name)
          || typeof file.mime !== 'string' || file.mime.length > 127 || !/^[A-Za-z0-9][A-Za-z0-9.+_-]*\/[A-Za-z0-9][A-Za-z0-9.+_-]*$/.test(file.mime)
          || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > 4194304) throw new Error('invalid_queue_receipt');
      }
      if (file === null) throw new Error('official_document_required');
      entry.officialDocument = file;
    }
    return receipt.authorized ? null : { outcome: 'skipped', code: 'obsolete_notice', retryAfterSeconds: 300 };
  } catch (_) {
    // No se llamó a MailApp: solo este fallo anterior al envío permite reintentar sin incertidumbre.
    return { outcome: 'retry', code: 'authorization_unavailable', retryAfterSeconds: 300 };
  }
}

/** Reserva de ejecución con generación: una respuesta vieja no puede liberar otro poll. */
function qmsMailPollLease_(owner) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return false;
  try {
    var props = PropertiesService.getScriptProperties();
    if (Number(props.getProperty('QMS_MAIL_POLL_UNTIL')) > Date.now()) return false;
    props.setProperty('QMS_MAIL_POLL_OWNER', owner);
    props.setProperty('QMS_MAIL_POLL_UNTIL', String(Date.now() + 360000));
    return true;
  } finally { lock.releaseLock(); }
}

function qmsMailReleasePoll_(owner) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty('QMS_MAIL_POLL_OWNER') === owner) {
      props.deleteProperty('QMS_MAIL_POLL_UNTIL');
      props.deleteProperty('QMS_MAIL_POLL_OWNER');
    }
  } finally { lock.releaseLock(); }
}

/** Revisar disponibilidad local antes de reservar filas; no retener ScriptLock durante HTTP. */
function qmsMailDirectCapacity_(configuration) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return 0;
  try {
    qmsMailLedger_(configuration);
    if (configuration.replyTo && (configuration.replyTo.length > 254
      || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(configuration.replyTo))) throw new Error('mail_not_configured');
    var quota = MailApp.getRemainingDailyQuota();
    if (!Number.isFinite(quota) || quota < 1) return 0;
    return Math.min(5, Math.floor(quota));
  } finally { lock.releaseLock(); }
}

function qmsMailPollDirect_(configuration, citizenOnly) {
  qmsMailQueueUrl_(configuration);
  var started = Date.now(), owner = Utilities.getUuid();
  if (!qmsMailPollLease_(owner)) return false;
  var counts = { claimed: 0, sent: 0, retry: 0, uncertain: 0, failed: 0, skipped: 0 };
  try {
    // Un tick sin capacidad mantiene las campanas activas aunque MailApp o el diario no estén disponibles.
    var limit = 0;
    try { limit = qmsMailDirectCapacity_(configuration); } catch (_) { /* claim0 no reserva ni entrega correos */ }
    var claim = { limit: limit };
    if (citizenOnly === true) claim.citizenOnly = true;
    var batch = qmsMailClaimReceipt_(qmsMailQueueRequest_(configuration, 'claim_request', claim, 'claim_receipt'), limit);
    counts.claimed = batch.messages.length;
    for (var index = 0; index < batch.messages.length; index++) {
      if (Date.now() - started >= 240000) break;
      var entry = batch.messages[index];
      // El ACK de trabajo no iniciado es seguro: no existió llamada a MailApp.
      // Reservar 30 s al final del lease/budget para no empezar una entrega tarde.
      var canStart = Date.now() - started < 210000 && batch.expires - Date.now() > 30000;
      var result = !canStart ? { outcome: 'retry', code: 'batch_not_started', retryAfterSeconds: 300 }
        : qmsMailInternalKind_(entry.message.kind) || entry.message.kind === 'final'
          ? qmsMailAuthorizeInternal_(configuration, entry) : null;
      if (!result) {
        // El HTTP de autorización también consume lease y presupuesto de ejecución.
        result = Date.now() - started < 210000 && batch.expires - Date.now() > 30000
          ? qmsMailDeliver_(configuration, entry.message, entry.officialDocument)
          : { outcome: 'retry', code: 'batch_not_started', retryAfterSeconds: 300 };
      }
      qmsMailAck_(configuration, entry, result);
      counts[result.outcome]++;
      if (Date.now() - started >= 240000) break;
    }
    console.info('QMS mail batch', JSON.stringify(counts));
  } catch (_) {
    // Un claim/ACK perdido no se repite: el lease y diario conservan la incertidumbre.
    // No imprimir payload, firma, destinatario, URL de redirección ni error externo.
    console.warn('QMS mail queue unavailable');
  } finally { qmsMailReleasePoll_(owner); }
}

/** Health firmado, sin leer cola/diario ni enviar; puede ejecutarse con envío apagado. */
function qmsMailCheckConnection() {
  var configuration = qmsMailConfiguration_();
  var receipt = qmsMailQueueRequest_(configuration, 'health_request', {}, 'health_receipt');
  qmsMailRecord_(receipt, ['requestNonce', 'enabled']);
  if (typeof receipt.enabled !== 'boolean') throw new Error('invalid_queue_receipt');
  var result = { reachable: true, enabled: receipt.enabled };
  console.info('QMS mail connection', JSON.stringify(result));
  return result;
}

/** HTML compatible con correo: estilos inline, sin recursos remotos ni datos internos. */
function qmsMailEscape_(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
  });
}
function qmsMailHtml_(message) {
  var title = {recibido:'Registro recibido',final:'Resultado de la gestión',
    interno_recibido:'Nueva queja recibida',interno_evaluacion_1:'Evaluación por vencer',interno_asignacion:'Investigación asignada',
    interno_investigacion_5:'Investigación por vencer',interno_investigacion_3:'Investigación por vencer',
    interno_evaluacion_vencida:'Evaluación vencida',interno_investigacion_vencida:'Investigación vencida'}[message.kind];
  if (typeof title !== 'string') throw new Error('invalid_mail_request');
  var tracking = Object.prototype.hasOwnProperty.call(message, 'trackingUrl');
  if (tracking && (qmsMailInternalKind_(message.kind) || !qmsMailTrackingUrl_(message.trackingUrl))) throw new Error('invalid_mail_request');
  var paragraphs = message.body.split(/\n\s*\n/).filter(function (paragraph) {
    return !(tracking && paragraph === 'Seguimiento privado: ' + message.trackingUrl);
  }).map(function (paragraph) {
    return '<p style="margin:0 0 12px;color:#343a40;font-size:16px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word">' + qmsMailEscape_(paragraph).replace(/\n/g,'<br>') + '</p>';
  }).join('');
  return '<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:16px 8px;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;color:#212529">' +
    '<table role="presentation" width="100%" style="width:100%;border-collapse:collapse;table-layout:fixed"><tr><td align="center" style="padding:0">' +
    '<table role="presentation" width="100%" style="width:100%;max-width:760px;table-layout:fixed;border:1px solid #dee2e6;border-radius:6px;background:#ffffff;border-spacing:0">' +
    '<tr><td style="padding:16px 20px;border-bottom:1px solid #dee2e6">' +
    '<table role="presentation" style="border-collapse:collapse"><tr><td width="36" height="36" align="center" style="width:36px;height:36px;border-radius:4px;background:#024796;color:#ffffff;font-size:18px;line-height:1;font-weight:600">E</td>' +
    '<td style="padding-left:12px"><div style="font-size:16px;line-height:1.4;font-weight:600;color:#212529">QMS ECA</div>' +
    '<div style="font-size:13px;line-height:1.4;color:#6c757d">Gestión de Calidad</div></td></tr></table></td></tr>' +
    '<tr><td style="padding:20px"><h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;font-weight:600;color:#212529">' + title + '</h1>' +
    '<p style="margin:0 0 20px;padding:0 0 16px;border-bottom:1px solid #dee2e6;font-size:14px;line-height:1.5;color:#6c757d;overflow-wrap:anywhere;word-break:break-word">Número de registro ' +
    '<span style="margin-left:8px;font-size:18px;font-weight:600;color:#024796">' + qmsMailEscape_(message.folio) + '</span></p>' + paragraphs +
    (tracking && message.kind === 'recibido' ? '<p style="margin:18px 0 10px"><a href="' + qmsMailEscape_(message.trackingUrl) + '" rel="noreferrer" style="display:inline-block;max-width:100%;box-sizing:border-box;padding:12px 20px;border-radius:4px;background:#024796;color:#ffffff;text-decoration:none;text-align:center;font-size:16px;font-weight:600;line-height:1.4">Consultar mi trámite</a></p>' +
      '<p style="margin:0;font-size:13px;line-height:1.5;color:#6c757d">El botón abre tu trámite directamente, sin contraseña. El enlace es personal: conservá este correo y evitá compartirlo.</p>' : '') + '</td></tr>' +
    '<tr><td style="padding:12px 20px;border-top:1px solid #dee2e6;font-size:12px;line-height:1.5;color:#6c757d">Notificación automática de QMS ECA. Conservá este número para consultas con Gestión de Calidad.</td></tr>' +
    '</table></td></tr></table></body></html>';
}
