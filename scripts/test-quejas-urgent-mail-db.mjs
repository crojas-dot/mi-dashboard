import fs from 'node:fs'
import { randomUUID, createHmac } from 'node:crypto'

// Solo se llama desde el PostgreSQL desechable del fixture principal.
// Los dobles de net/Vault verifican transacción y permisos, no certifican cifrado ni HTTP real.
export async function verifyUrgentMail({ pool, service, newCase, check, rejects }) {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS extensions;CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
    CREATE SCHEMA vault;CREATE TABLE vault.secrets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),secret text);
    CREATE VIEW vault.decrypted_secrets AS SELECT id,secret AS decrypted_secret FROM vault.secrets;
    CREATE FUNCTION vault.create_secret(value text,name text,description text) RETURNS uuid LANGUAGE plpgsql AS $$DECLARE result uuid;BEGIN INSERT INTO vault.secrets(secret) VALUES(value) RETURNING id INTO result;RETURN result;END$$;
    CREATE SCHEMA net;CREATE TABLE net.requests(id bigint GENERATED ALWAYS AS IDENTITY,url text,body jsonb);
    CREATE FUNCTION net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer) RETURNS bigint LANGUAGE plpgsql AS $$DECLARE result bigint;BEGIN IF current_setting('fixture.net_failure',true)='true' THEN RAISE EXCEPTION 'synthetic network unavailable';END IF;INSERT INTO net.requests(url,body) VALUES(url,body) RETURNING id INTO result;RETURN result;END$$;`)
  await pool.query('CREATE TABLE net._http_response(id bigint,status_code integer,timed_out boolean,error_msg text,content text)')
  const migration=fs.readFileSync('supabase/migrations/20261110203610_quejas_urgent_mail_wake.sql','utf8').replace('create extension if not exists pg_net with schema extensions;','-- net is a transactional fixture double')
  await pool.query(migration)
  await pool.query(fs.readFileSync('supabase/migrations/20261110212506_quejas_mail_wake_setup.sql','utf8'))
  const endpoint='https://script.google.com/macros/s/synthetic_mail_endpoint_123456789/exec'
  const configure=async url=>(await service('SELECT qms_mail_configure_wake($1) value',[url]))[0].value
  const enabled=async value=>service('SELECT qms_mail_set_wake_enabled($1,$2)',[endpoint,value])
  const claim=async(limit=2,nonce=randomUUID())=>(await service('SELECT * FROM qms_mail_claim_urgent_batch($1,600,$2,$3)',[limit,nonce,Math.floor(Date.now()/1000)]))
  const count=async()=>Number((await pool.query('SELECT count(*) FROM net.requests')).rows[0].count)
  const settle=async()=>pool.query("UPDATE queja_mail_outbox SET status='sent',sent_at=now(),claim_token=NULL,lease_until=NULL,safe_error=NULL")
  const insert=async(c,client=pool)=>client.query("INSERT INTO queja_mail_outbox(queja_id,tipo,destinatario,folio,estado) VALUES($1,'recibido','fixture@example.test',$2,'Recibido')",[c.id,c.folio])
  for(const role of ['anon','authenticated'])for(const fn of ['qms_mail_wake_configuration()','qms_mail_configure_wake(text)','qms_mail_set_wake_enabled(text,boolean)','qms_mail_claim_urgent_batch(integer,integer,uuid,bigint)'])check(!(await pool.query("SELECT has_function_privilege($1,$2,'EXECUTE') ok",[role,fn])).rows[0].ok,'Wake API closed to '+role)
  check(!(await pool.query("SELECT has_table_privilege('service_role','qms_private.mail_wake_settings','SELECT') ok")).rows[0].ok,'Secret settings have no direct machine grant')
  await rejects(()=>configure('https://foreign.example.test/exec'),'22023','Wake endpoint is host/path restricted')
  const config=await configure(endpoint);check(config.enabled===false&&/^[a-f0-9]{64}$/.test(config.secret),'Wake starts disabled with dedicated random key')
  for(const role of ['anon','authenticated'])for(const fn of ['qms_mail_setup_wake(jsonb)','qms_mail_setup_wake_result(bigint)'])check(!(await pool.query("SELECT has_function_privilege($1,$2,'EXECUTE') ok",[role,fn])).rows[0].ok,'Setup closed to '+role)
  await rejects(()=>service('SELECT qms_mail_setup_wake($1::jsonb)',[JSON.stringify({purpose:'delivery_request'})]),'22023','Setup refuses delivery requests')
  const setup={version:1,purpose:'queue_wake_setup_request',issuedAt:Math.floor(Date.now()/1000),nonce:randomUUID(),payload:'e30',signature:'a'.repeat(64)}
  const setupId=(await service('SELECT qms_mail_setup_wake($1::jsonb) id',[JSON.stringify(setup)]))[0].id
  check((await service('SELECT qms_mail_setup_wake_result($1) result',[setupId]))[0].result.pending,'Setup waits for post-commit HTTP')
  await rejects(()=>service('SELECT qms_mail_setup_wake_result($1)',[Number(setupId)+1]),'42501','Setup cannot read another HTTP request')
  await pool.query('INSERT INTO net._http_response VALUES($1,200,false,NULL,$2)',[setupId,JSON.stringify({error:'invalid_mail_request'})])
  check((await service('SELECT qms_mail_setup_wake_result($1) result',[setupId]))[0].result.receipt.error==='invalid_mail_request','Setup returns bounded machine receipt')
  await pool.query('DELETE FROM net.requests')
  check((await configure(endpoint)).secret===config.secret,'Reconfiguration preserves key')
  await rejects(()=>service('SELECT qms_mail_set_wake_enabled($1,true)',['https://script.google.com/macros/s/other_endpoint_123456789/exec']),'40001','Activation uses the verified destination')
  const first=await newCase(),second=await newCase()
  await pool.query('DELETE FROM queja_mail_outbox WHERE queja_id=ANY($1::uuid[])',[[first.id,second.id]])
  check(await count()===0,'Disabled wake cannot schedule mail')
  await enabled(true)
  const client=await pool.connect()
  try{await client.query('BEGIN');await insert(first,client);await insert(second,client);const requests=(await client.query('SELECT body FROM net.requests')).rows;check(requests.length===1,'One wake per transaction');const e=requests[0].body;check(e.purpose==='queue_wake_request'&&e.payload==='e30'&&Object.keys(e).length===6,'Wake contains no citizen or mail content');check(e.signature===createHmac('sha256',config.secret).update(`eca-qms-mail:v1:${e.purpose}\n${e.issuedAt}\n${e.nonce}\n${e.payload}`).digest('hex'),'Database signature interoperates with sender');await client.query('ROLLBACK');check(await count()===0,'Rollback removes queued HTTP along with business write');
    await client.query('BEGIN');await client.query("SELECT set_config('fixture.net_failure','true',true)");await insert(first,client);await client.query('COMMIT');check((await pool.query('SELECT count(*) FROM queja_mail_outbox WHERE queja_id=$1',[first.id])).rows[0].count==='1','Network scheduling failure preserves complaint/mail');check(await count()===0,'Failed wake remains a periodic queue responsibility')
  }finally{await client.query('ROLLBACK');client.release()}
  await settle();await enabled(false)
  const cases=[];for(let i=0;i<5;i++){const c=await newCase();await pool.query('DELETE FROM queja_mail_outbox WHERE queja_id=$1',[c.id]);await insert(c);cases.push(c)}
  const formId=randomUUID();await pool.query("INSERT INTO formularios_publicos(id,token,activo,modulo) VALUES($1,$2,true,'quejas')",[formId,'a'.repeat(32)]);await pool.query('INSERT INTO public_form_submissions(form_id,submission_id,payload_hash,queja_id) VALUES($1,$2,$3,$4)',[formId,randomUUID(),'a'.repeat(64),cases[4].id])
  const nonce=randomUUID(),a=await claim(2,nonce);check(a.length===2&&a.every(r=>r.tipo==='recibido'),'Urgent claim contains citizen mail only');check((await claim(2,nonce)).length===0,'Wake nonce replay cannot claim another batch');const b=await claim();check(b.length===2&&!b.some(x=>a.some(y=>x.id===y.id)),'Subsequent claim never duplicates leased mail');check((await claim()).length===0,'Unfinalized form is not delivered');await pool.query('UPDATE public_form_submissions SET finalized_at=now() WHERE queja_id=$1',[cases[4].id]);check((await claim()).length===1,'Finalization releases the receipt');
  await rejects(()=>claim(3),'22023','Urgent batch bound remains two');check((await claim(0)).length===0,'Urgent claim zero reserves nothing')
}
