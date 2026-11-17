// PG aislado; no carga .env, no borra cuentas reales ni contacta Supabase.
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {randomUUID,randomBytes} from 'node:crypto'
import assert from 'node:assert/strict'
const {Pool}=createRequire(path.join(process.cwd(),'.performance/load-tools/package.json'))('pg')
const bin=process.env.QMS_PG_BIN??'C:/Program Files/PostgreSQL/18/bin',port=55475
const work=path.join(process.cwd(),'.performance','usuarios-delete-db-'+Date.now()),data=path.join(work,'data'),password=randomBytes(32).toString('hex')
let pool,started=false,checks=0
const check=(value,expected)=>{assert.deepEqual(value,expected);checks++}
const reject=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);checks++}
const run=(name,args)=>{const result=spawnSync(path.join(bin,name),args,{encoding:'utf8',windowsHide:true,timeout:60_000});if(result.status!==0)throw new Error(result.error?.message??result.stderr.slice(-1000))}
const q=async(sql,args=[])=>(await pool.query(sql,args)).rows
async function call(actor,target,phase,request=null,role='service_role') {
 const c=await pool.connect()
 try{await c.query('set role '+role);return(await c.query('select qms_delete_user_account($1,$2,$3,$4) result',[actor,target,phase,request])).rows[0].result}
 finally{await c.query('reset role');c.release()}
}
async function user(role='colaborador',withAuth=true) {
 const id=randomUUID(),auth=withAuth?randomUUID():null,email=id+'@example.test'
 if(auth)await q('insert into auth.users(id) values($1)',[auth])
 await q("insert into usuarios(id,auth_id,nombre,email,rol,estado) values($1,$2,'Persona ficticia',$3,$4,'activo')",[id,auth,email,role])
 return {id,auth,email}
}
try {
 fs.mkdirSync(work,{recursive:true});const pwfile=path.join(work,'pw');fs.writeFileSync(pwfile,password)
 run('initdb.exe',['-D',data,'-U','fixture','-A','scram-sha-256','--pwfile='+pwfile,'--encoding=UTF8','--locale=C']);fs.unlinkSync(pwfile)
 run('pg_ctl.exe',['-D',data,'-l',path.join(work,'postgres.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);started=true
 pool=new Pool({host:'127.0.0.1',port,user:'fixture',password,database:'postgres',max:4,connectionTimeoutMillis:10_000,statement_timeout:20_000})
 await q(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema qms_private;
 create table auth.users(id uuid primary key);
 create table public.usuarios(id uuid primary key,auth_id uuid unique references auth.users(id) on delete set null,nombre text not null,email text not null unique,rol text not null,estado text,telefono text,avatar_url text,notif_habilitadas boolean default true,notif_sonido boolean default true);
 alter table public.usuarios enable row level security;create policy fixture_read on usuarios for select using(true);
 grant usage on schema public,qms_private to anon,authenticated,service_role;
 grant select on usuarios to authenticated;grant update(nombre) on usuarios to authenticated;
 create table public.quejas(id uuid primary key,responsable_id uuid references usuarios(id));
 create table public.historial(id uuid primary key,usuario_id uuid references usuarios(id));
 create table public.notificaciones(id uuid primary key,usuario_id uuid references usuarios(id));`)
 const admin=await user('admin'),another=await user('admin'),person=await user(),orphan=await user('colaborador',false)
 await q('insert into quejas values($1,$2)',[randomUUID(),person.id]);await q('insert into historial values($1,$2)',[randomUUID(),person.id]);await q('insert into notificaciones values($1,$2)',[randomUUID(),person.id])
 const before=await q('select * from usuarios order by id')
 await q(fs.readFileSync('supabase/migrations/20261117212024_usuarios_eliminacion_con_trazabilidad.sql','utf8'))
 check((await q('select eliminado_en is null ok from usuarios')).every(row=>row.ok),true)
 check((await q('select count(*)::int n from usuarios'))[0].n,before.length)
 await reject(()=>call(person.auth,another.id,'begin'),'42501')
 await reject(()=>call(admin.auth,person.id,'begin',null,'authenticated'),'42501')
 await reject(()=>call(admin.auth,person.id,'begin',null,'anon'),'42501')
 await reject(()=>call(admin.auth,admin.id,'begin'),'P0409')
 await reject(()=>call(admin.auth,randomUUID(),'begin'),'P0002')
 const begin=await call(admin.auth,person.id,'begin');check(begin.authId,person.auth);check(begin.completed,false)
 check((await q('select estado from usuarios where id=$1',[person.id]))[0].estado,'inactivo')
 check((await call(admin.auth,person.id,'begin')).requestId,begin.requestId)
 await reject(()=>call(admin.auth,person.id,'finish',randomUUID()),'40001')
 await reject(()=>call(admin.auth,person.id,'finish',begin.requestId),'P0409')
 await q('delete from auth.users where id=$1',[person.auth])
 check((await call(admin.auth,person.id,'finish',begin.requestId)).completed,true)
 const retired=(await q('select * from usuarios where id=$1',[person.id]))[0]
 check(retired.auth_id,null);check(retired.estado,'inactivo');check(retired.email.endsWith('@usuarios.invalid'),true);check(!!retired.eliminado_en,true)
 check(retired.notif_habilitadas,false);check(retired.notif_sonido,false)
 for(const table of ['quejas','historial','notificaciones'])check((await q('select count(*)::int n from '+table))[0].n,1)
 check((await call(admin.auth,person.id,'begin')).completed,true)
 check((await call(admin.auth,person.id,'finish',begin.requestId)).completed,true)
 // El mismo email puede darse de alta con otro ID: nunca adopta historial ajeno.
 const replacement=await user();await q('update usuarios set email=$1 where id=$2',[person.email,replacement.id])
 check((await q('select responsable_id from quejas'))[0].responsable_id,person.id)
 const recover=await call(admin.auth,orphan.id,'begin');check(recover.authId,null)
 check((await call(admin.auth,orphan.id,'finish',recover.requestId)).completed,true)
 const client=await pool.connect();try{await client.query('set role authenticated');await reject(()=>client.query('update usuarios set eliminado_en=null where id=$1',[person.id]),'42501');await reject(()=>client.query('select * from qms_private.usuario_eliminaciones'),'42501')}finally{await client.query('reset role');client.release()}
 const otherDelete=await call(admin.auth,another.id,'begin')
 check((await q("select count(*)::int n from usuarios where rol='admin' and estado='activo' and eliminado_en is null"))[0].n,1)
 await reject(()=>call(another.auth,admin.id,'begin'),'42501')
 await q('delete from auth.users where id=$1',[another.auth]);await call(admin.auth,another.id,'finish',otherDelete.requestId)
 check((await q("select count(*)::int n from usuarios where eliminado_en is null"))[0].n,2)
 console.log(JSON.stringify({checks,result:'passed',remote:false,realAccountsDeleted:0}))
}finally{if(pool)await pool.end();if(started)run('pg_ctl.exe',['-D',data,'-m','immediate','stop'])}
