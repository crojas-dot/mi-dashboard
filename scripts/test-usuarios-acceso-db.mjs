// PostgreSQL aislado: no carga .env, no crea usuarios ni envía correos en Supabase.
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const bin=process.env.QMS_PG_BIN??'C:/Program Files/PostgreSQL/18/bin',port=55474
const work=path.join(process.cwd(),'.performance','access-db-'+Date.now()),data=path.join(work,'data'),pw=randomBytes(32).toString('hex')
const {Pool}=createRequire(path.join(process.cwd(),'.performance/load-tools/package.json'))('pg')
let pool,started=false,checks=0
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++}
const rejected=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);checks++}
const run=(name,args)=>{const r=spawnSync(path.join(bin,name),args,{encoding:'utf8',windowsHide:true,timeout:60_000});if(r.status!==0)throw new Error(r.error?.message??r.stderr.slice(-1000))}
const admin={id:randomUUID(),session:randomUUID()},legacy={id:randomUUID(),session:randomUUID()}
const q=async(sql,args=[])=>(await pool.query(sql,args)).rows
async function role(user,sql,args=[],aal='aal1',name='authenticated') {
 const c=await pool.connect()
 try{await c.query('set role '+name);await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user?.id,session_id:user?.session,aal,role:name})]);return(await c.query(sql,args)).rows}
 finally{await c.query('reset role');await c.query("select set_config('request.jwt.claims','{}',false)");c.release()}
}
const command=async(user,action,payload={},aal='aal1')=>(await role(user,'select qms_access_command($1,$2,$3,$4,$5) value',[action,user.id,user.session,aal,payload],aal,'service_role'))[0].value
const allowed=async(user,aal='aal1')=>(await role(user,'select qms_access_allowed() value',[],aal))[0].value
const status=(user,aal='aal1')=>command(user,'status',{},aal)
async function create(invite=true,requireMfa=true) {
 const user={id:randomUUID(),session:randomUUID(),op:randomUUID()}
 const input={id:user.op,nombre:'Persona ficticia',email:user.id+'@example.test',rol:'colaborador',estado:'activo',invite,requireMfa}
 await command(admin,'create_begin',input)
 await q('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[user.id,input.email,{qms_creation_id:user.op}])
 await command(admin,'create_commit',{id:user.op,authId:user.id})
 await q('insert into auth.sessions values($1,$2)',[user.session,user.id]);return {...user,input}
}
try {
 fs.mkdirSync(work,{recursive:true});const secretFile=path.join(work,'pw');fs.writeFileSync(secretFile,pw)
 run('initdb.exe',['-D',data,'-U','fixture','-A','scram-sha-256','--pwfile='+secretFile,'--encoding=UTF8','--locale=C']);fs.unlinkSync(secretFile)
 run('pg_ctl.exe',['-D',data,'-l',path.join(work,'postgres.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);started=true
 pool=new Pool({host:'127.0.0.1',port,user:'fixture',password:pw,database:'postgres',max:4,connectionTimeoutMillis:10_000,statement_timeout:20_000})
 await q(`create role anon;create role authenticated;create role service_role bypassrls;create role authenticator;
  create schema auth;create schema qms_private;create schema storage;create schema extensions;
  create extension pgcrypto with schema extensions;
  create table auth.users(id uuid primary key,email text unique,raw_app_meta_data jsonb);
  create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
  create table auth.mfa_factors(id uuid primary key,user_id uuid references auth.users,status text);
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
  create table public.usuarios(id uuid primary key default gen_random_uuid(),auth_id uuid unique references auth.users(id),email text unique,nombre text,rol text,estado text,ultimo_acceso timestamptz);
  create function public.app_usuario_actual_id() returns uuid language sql stable security definer as $$ select id from usuarios where auth_id=auth.uid() and estado='activo' limit 1 $$;
  create function public.app_es_staff() returns boolean language sql stable security definer as $$ select exists(select 1 from usuarios where auth_id=auth.uid() and estado='activo' and rol in('admin','calidad')) $$;
  alter table public.usuarios enable row level security;create policy self_profile on usuarios for select to authenticated using(auth_id=auth.uid());
  create table public.records(id uuid primary key default gen_random_uuid(),owner_id uuid);
  alter table public.records enable row level security;
  create policy own_records on records for select to authenticated using(owner_id=auth.uid());
  create table storage.objects(id uuid primary key,owner_id uuid);alter table storage.objects enable row level security;
  create policy own_storage on storage.objects for select to authenticated using(app_es_staff() or owner_id=auth.uid() and app_usuario_actual_id() is not null);
  create table qms_private.mail_wake_settings(singleton boolean,endpoint text,enabled boolean);
  insert into qms_private.mail_wake_settings values(true,'https://script.google.com/macros/s/synthetic/exec',false);
  grant usage on schema public,auth,storage,qms_private to authenticated,anon,service_role;
  grant select on records,usuarios,storage.objects to authenticated;
  grant all on all tables in schema public,auth to service_role;`)
 for(const [user,name] of [[admin,'admin'],[legacy,'colaborador']]){
  await q('insert into auth.users values($1,$2,$3)',[user.id,name+'@example.test',{}])
  await q("insert into usuarios(auth_id,email,nombre,rol,estado) values($1,$2,$3,$3,'activo')",[user.id,name+'@example.test',name])
  await q('insert into auth.sessions values($1,$2)',[user.session,user.id]);await q('insert into records(owner_id) values($1)',[user.id])
 }
 const before=await q('select * from usuarios order by id')
 await q(fs.readFileSync('supabase/migrations/20261117214855_usuarios_acceso_inicial_mfa.sql','utf8'))
 check(await q('select * from usuarios order by id'),before)
 check(await allowed(legacy),true);check((await role(legacy,'select * from records')).length,1)
 await role(legacy,'select qms_check_access_request()');checks++
 check((await status(legacy)).managed,false)
 await rejected(()=>role(admin,'select qms_access_command($1,$2,$3,$4,$5)',['status',admin.id,admin.session,'aal1',{}]),'42501')
 await rejected(()=>role(null,'select qms_access_allowed()',[],'aal1','anon'),'42501')
 const user=await create();await q('insert into records(owner_id) values($1)',[user.id])
 await q('insert into storage.objects(id,owner_id) values($1,$2)',[randomUUID(),user.id])
 check((await role(user,'select * from storage.objects')).length,0)
 const staffPending=await create();await q("update usuarios set rol='calidad' where auth_id=$1",[staffPending.id])
 check((await role(staffPending,'select * from storage.objects')).length,0)
 check(await allowed(user),false);check((await role(user,'select * from records')).length,0)
 await rejected(()=>role(user,'select qms_check_access_request()'),'PT403')
 check((await status(user)).phase,'password')
 check((await command(admin,'create_begin',user.input)).completed,true)
 check((await q('select count(*)::int n from usuarios where auth_id=$1',[user.id]))[0].n,1)
 await rejected(()=>command(legacy,'create_begin',{...user.input,id:randomUUID(),email:'other@example.test'}),'42501')
 const digest=createHash('sha256').update('synthetic-invitation-only').digest('hex'),inviteId=randomUUID()
 await command(admin,'invite',{authId:user.id,id:inviteId,digest})
 await command(admin,'invite_result',{authId:user.id,id:inviteId,delivery:'failed'})
 const directory=await command(admin,'directory',{ids:[user.id]})
 check(directory[0].status,'invite_pending');check(directory[0].invitationFailed,true)
 await rejected(()=>command(admin,'invite',{authId:user.id,id:randomUUID(),digest:'a'.repeat(64)}),'P0429')
 const redeemed=(await q('select qms_redeem_access_invitation($1) value',[digest]))[0].value
 check(redeemed.authId,user.id)
 await rejected(()=>q('select qms_redeem_access_invitation($1)',[digest]),'42501')
 await rejected(()=>role(user,'select qms_redeem_access_invitation($1)',[digest]),'42501')
 check((await command(user,'password_done')).phase,'enroll')
 await rejected(()=>command(user,'password_done'),'40001')
 await rejected(()=>command(user,'email_send',{email:user.input.email.toUpperCase()}),'22023')
 const challenge=await command(user,'email_send',{email:' Alternate@Example.test '})
 check(challenge.email,'alternate@example.test');check(/^\d{6}$/.test(challenge.code),true)
 const stored=(await q('select encode(digest,\'hex\') digest,email from qms_private.access_challenges where id=$1',[challenge.id]))[0]
 check(stored.email,'alternate@example.test');check(stored.digest.length,64);check(stored.digest.includes(challenge.code),false)
 await rejected(()=>role(user,'select * from qms_private.access_challenges'),'42501')
 // El límite se devuelve sin EXCEPTION para no deshacer los contadores.
 const limited=await command(user,'email_send',{email:'alternate@example.test'});check(limited.error,'rate_limited')
 check((await command(user,'email_verify',{id:challenge.id,code:challenge.code})).error,'invalid_code')
 await command(user,'email_sent',{id:challenge.id,sent:true})
 const wrong=challenge.code==='000000'?'000001':'000000'
 for(let attempt=1;attempt<=5;attempt++)check((await command(user,'email_verify',{id:challenge.id,code:wrong})).error,attempt===5?'locked':'invalid_code')
 check((await status(user)).phase,'locked')
 check((await command(user,'email_verify',{id:challenge.id,code:challenge.code})).error,'locked')
 await q("update qms_private.access_policies set blocked_until=now()-interval '1 second' where auth_id=$1",[user.id])
 check((await command(user,'email_verify',{id:challenge.id,code:challenge.code})).phase,'ready')
 check(await allowed(user),true)
 check((await role(user,'select * from storage.objects')).length,1)
 check((await command(user,'email_verify',{id:challenge.id,code:challenge.code})).error,'invalid_code')
 const nextSession={...user,session:randomUUID()};await q('insert into auth.sessions values($1,$2)',[nextSession.session,user.id])
 check(await allowed(nextSession),false);check((await status(nextSession)).phase,'verify')
 check((await status(nextSession)).maskedEmail,'alt***@example.test')
 check((await command(nextSession,'email_verify',{id:challenge.id,code:challenge.code})).error,'invalid_code')
 await rejected(()=>command(admin,'email_check',{authId:user.id,email:'ALTERNATE@example.test'}),'22023')
 await rejected(()=>q('update usuarios set email=$1 where auth_id=$2',['alternate@example.test',user.id]),'22023')
 await q("update qms_private.access_sessions set expires_at=now()-interval '1 second' where auth_id=$1",[user.id])
 check(await allowed(user),false)
 const pendingInvite=await create(),pendingDigest=createHash('sha256').update('revoked-email-change').digest('hex')
 await command(admin,'invite',{authId:pendingInvite.id,id:randomUUID(),digest:pendingDigest})
 await q('update usuarios set email=$1 where auth_id=$2',['changed@example.test',pendingInvite.id])
 await rejected(()=>q('select qms_redeem_access_invitation($1)',[pendingDigest]),'42501')
 const another=await create(false,false)
 check((await command(another,'password_done')).phase,'ready');check(await allowed(another),true)
 await rejected(()=>command(another,'email_send',{email:'another@example.test'}),'42501')
 const totp=await create(false,true),factor=randomUUID(),native=randomUUID(),bound=randomUUID()
 await command(totp,'password_done');await q("insert into auth.mfa_factors values($1,$2,'unverified')",[factor,totp.id])
 await command(totp,'totp_bind',{id:bound,factorId:factor,nativeId:native})
 const attempt=await command(totp,'totp_attempt',{id:bound})
 check(attempt.factorId,factor);check((await command(totp,'totp_attempt',{id:bound})).error,'busy')
 check((await command(totp,'totp_finish',{id:bound,lease:attempt.lease,valid:true},'aal2')).error,'invalid_code')
 await q("update auth.mfa_factors set status='verified' where id=$1",[factor])
 const valid=await command(totp,'totp_attempt',{id:bound})
 check((await command(totp,'totp_finish',{id:bound,lease:valid.lease,valid:true},'aal2')).phase,'ready')
 check(await allowed(totp),false);check(await allowed(totp,'aal2'),true)
 await rejected(()=>command(totp,'email_send',{email:'x@example.test'}),'42501')
 await rejected(()=>command(admin,'reset_begin',{authId:legacy.id}),'42501')
 await command(admin,'reset_begin',{authId:user.id})
 check(await allowed(user),false);check((await q('select count(*)::int n from auth.sessions where user_id=$1',[user.id]))[0].n,0)
 check((await status(user)).phase,'reset_pending')
 await command(admin,'reset_finish',{authId:user.id})
 check((await status(user)).phase,'blocked')
 const reset={...user,session:randomUUID()};await q('insert into auth.sessions values($1,$2)',[reset.session,reset.id])
 check((await status(reset)).phase,'enroll');check((await status(reset)).requireMfa,true)
 check((await status(reset)).method,null)
 check(await allowed(legacy),true)
 console.log(JSON.stringify({checks,result:'passed',remote:false,mailSent:false}))
}finally{
 if(pool)await pool.end();if(started)run('pg_ctl.exe',['-D',data,'-m','immediate','stop'])
}
