// PostgreSQL aislado, identidades sintéticas y ninguna llamada de red/negocio.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'

const root = process.cwd(), bin = process.env.QMS_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin'
const work = path.join(root, '.performance', 'folios-anuales-db-' + Date.now())
const data = path.join(work, 'data'), port = 55461
const { Pool } = createRequire(path.join(root, '.performance/load-tools/package.json'))('pg')
const password = randomBytes(32).toString('hex')
const migrationName = '20261111151343_folios_anuales_transaccionales.sql'
const migration = fs.readFileSync(path.join('supabase/migrations', migrationName), 'utf8')
let pool, started = false, checks = 0
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++ }
const fail = async (fn, code) => { await assert.rejects(fn, error => error.code === code); checks++ }
function run(binary, args) {
  const result = spawnSync(path.join(bin, binary), args, { stdio: 'ignore', windowsHide: true, timeout: 60000 })
  if (result.status !== 0) throw new Error('No se pudo iniciar/finalizar PostgreSQL aislado')
}
const series = [
  ['quejas', '', 'generar_folio_queja', null],
  ['sacp', 'SACP-', 'generar_folio_sacp', 'acciones'],
  ['auditorias', 'AUD-', 'generar_folio_auditoria', 'auditorias'],
  ['riesgos', 'RIESGO-', 'generar_folio_riesgo', 'riesgos'],
  ['documentos', 'DOC-', 'generar_folio_documento', null],
]
const next = async (modulo, instant) => (await pool.query('SELECT qms_private.next_annual_folio($1,$2) AS folio', [modulo, instant])).rows[0].folio
async function inRole(role, sql, args = []) {
  const client = await pool.connect()
  try { await client.query('SET ROLE ' + role); return await client.query(sql, args) }
  finally { await client.query('RESET ROLE'); client.release() }
}

try {
  fs.mkdirSync(work, { recursive: true })
  const pw = path.join(work, 'pw'); fs.writeFileSync(pw, password)
  run('initdb.exe', ['-D', data, '-U', 'qms_fixture', '-A', 'scram-sha-256', '--pwfile=' + pw, '--encoding=UTF8', '--locale=C'])
  fs.unlinkSync(pw)
  run('pg_ctl.exe', ['-D', data, '-l', path.join(work, 'postgres.log'), '-o', '-h 127.0.0.1 -p ' + port, '-w', 'start'])
  started = true
  pool = new Pool({ host: '127.0.0.1', port, user: 'qms_fixture', password, database: 'postgres', max: 20, statement_timeout: 15000 })
  await pool.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA qms_private; GRANT USAGE ON SCHEMA public,qms_private TO authenticated,service_role;
    CREATE TABLE public.folios_quejas_anuales(anio integer PRIMARY KEY,ultimo integer NOT NULL CHECK(ultimo>=0));
    INSERT INTO public.folios_quejas_anuales VALUES(2025,16),(2026,2088);
    CREATE TABLE public.acciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),folio text NOT NULL UNIQUE,ok boolean DEFAULT true CHECK(ok));
    CREATE TABLE public.auditorias(LIKE public.acciones INCLUDING ALL);
    CREATE TABLE public.riesgos(LIKE public.acciones INCLUDING ALL);
    INSERT INTO public.acciones(folio) VALUES('SACP-2026-0241'),('LEGACY-SACP');
    INSERT INTO public.auditorias(folio) VALUES('AUD-2025-0007');
    INSERT INTO public.riesgos(folio) VALUES('RIESGO-2024-0002');
    CREATE SEQUENCE public.seq_folio_sacp; SELECT setval('public.seq_folio_sacp',260);
    CREATE SEQUENCE public.seq_folio_auditorias; CREATE SEQUENCE public.seq_folio_riesgos;
    CREATE SEQUENCE public.seq_folio_documentos; CREATE SEQUENCE public.quejas_folio_seq; CREATE SEQUENCE public.seq_folio_quejas;
    GRANT ALL ON SEQUENCE public.seq_folio_sacp,public.seq_folio_auditorias,public.seq_folio_riesgos,public.seq_folio_documentos,public.quejas_folio_seq,public.seq_folio_quejas TO anon,authenticated,service_role;
    GRANT SELECT,INSERT,UPDATE ON public.acciones,public.auditorias,public.riesgos TO authenticated;
    ALTER TABLE public.acciones ENABLE ROW LEVEL SECURITY;
    CREATE POLICY allow_sacp ON public.acciones TO authenticated USING(true) WITH CHECK(true);
    ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;
    CREATE POLICY allow_auditorias ON public.auditorias TO authenticated USING(true) WITH CHECK(true);
    ALTER TABLE public.riesgos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY allow_riesgos ON public.riesgos TO authenticated USING(true) WITH CHECK(true);`)
  // ACL preexistentes de los wrappers: no abrir el contador al migrar la lógica.
  for (const [, , rpc] of series) {
    await pool.query(`CREATE FUNCTION public.${rpc}() RETURNS text LANGUAGE sql AS $$SELECT 'legacy'::text$$;
      REVOKE ALL ON FUNCTION public.${rpc}() FROM PUBLIC,anon;
      GRANT EXECUTE ON FUNCTION public.${rpc}() TO service_role;`)
    if (rpc !== 'generar_folio_queja') await pool.query(`GRANT EXECUTE ON FUNCTION public.${rpc}() TO authenticated`)
  }
  const before = (await pool.query("SELECT folio FROM public.acciones UNION ALL SELECT folio FROM public.auditorias UNION ALL SELECT folio FROM public.riesgos ORDER BY folio")).rows
  await pool.query('BEGIN')
  await pool.query(migration)
  await pool.query('COMMIT')
  check((await pool.query("SELECT folio FROM public.acciones UNION ALL SELECT folio FROM public.auditorias UNION ALL SELECT folio FROM public.riesgos ORDER BY folio")).rows, before, 'Históricos intactos')
  check((await pool.query('SELECT * FROM public.folios_quejas_anuales ORDER BY anio')).rows, [{ anio: 2025, ultimo: 16 }, { anio: 2026, ultimo: 2088 }], 'Contadores Quejas intactos')
  check((await pool.query("SELECT ultimo FROM qms_private.folios_anuales WHERE modulo='sacp' AND anio=2026")).rows[0].ultimo, '260', 'Conserva reservas anteriores, incluso sin fila')
  check((await pool.query("SELECT count(*)::int AS n FROM qms_private.folios_anuales WHERE anio=2026 AND modulo IN('auditorias','riesgos','documentos')")).rows[0].n, 0, 'Una secuencia nunca usada no consume 001')

  for (const [modulo, prefix, rpc] of series) {
    for (const zone of ['UTC', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
      await pool.query("SELECT set_config('TimeZone',$1,false)", [zone])
      await pool.query('BEGIN')
      const first = await next(modulo, '2026-12-31T23:59:59.999-06:00')
      check(first.startsWith(prefix + '2026-'), true, modulo + ' respeta diciembre CR con sesión ' + zone)
      check(await next(modulo, '2027-01-01T05:59:59.999Z'), prefix + '2026-' + String(Number(first.split('-').at(-1)) + 1).padStart(3, '0'), 'Medianoche UTC todavía es diciembre CR')
      check(await next(modulo, '2027-01-01T06:00:00.000Z'), prefix + '2027-001', 'Primer instante de enero CR')
      check(await next(modulo, '2027-01-01T06:00:00.001Z'), prefix + '2027-002', 'Segundo registro de enero')
      check(await next(modulo, '2028-01-01T06:00:00.000Z'), prefix + '2028-001', 'El cambio no está fijado a 2027')
      await pool.query('ROLLBACK')
    }
    await pool.query('BEGIN')
    if (modulo === 'quejas') await pool.query('INSERT INTO public.folios_quejas_anuales VALUES(2030,998)')
    else await pool.query('INSERT INTO qms_private.folios_anuales VALUES($1,2030,998)', [modulo])
    for (const value of [999,1000,1001,1002]) check(await next(modulo, '2030-06-01T12:00:00Z'), prefix + '2030-' + value, 'No recorta números >999')
    await pool.query('ROLLBACK')
    await fail(() => inRole('anon', `SELECT public.${rpc}()`), '42501')
    if (modulo === 'quejas') await fail(() => inRole('authenticated', `SELECT public.${rpc}()`), '42501')
    else {
      const client = await pool.connect()
      try {
        await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated')
        const allocated = (await client.query(`SELECT public.${rpc}() AS folio`)).rows[0].folio
        check(allocated.startsWith(prefix + new Intl.DateTimeFormat('en', { timeZone: 'America/Costa_Rica', year: 'numeric' }).format(new Date()) + '-'), true, 'Wrapper publicado compatible y año servidor')
        await client.query('ROLLBACK')
      } finally { client.release() }
    }
  }
  await pool.query("SET TimeZone='UTC'")
  await fail(() => next('inexistente', '2027-01-01T06:00:00Z'), '22023')
  await fail(() => next('quejas', null), '22023')
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await fail(() => inRole(role, "SELECT qms_private.next_annual_folio('quejas',now())"), '42501')
    await fail(() => inRole(role, 'SELECT public.siguiente_folio_queja()'), '42501')
    await fail(() => inRole(role, 'SELECT * FROM qms_private.folios_anuales'), '42501')
  }

  // Concurrencia en una serie nueva: UPSERT del primer alta, sin precargar fila.
  for (const [modulo, prefix] of series) {
    const values = await Promise.all(Array.from({ length: 40 }, () => next(modulo, '2040-01-01T06:00:00Z')))
    check(new Set(values).size, 40, 'Sin duplicados en ' + modulo)
    check(values.map(value => Number(value.split('-').at(-1))).sort((a,b) => a-b), Array.from({length:40},(_,i) => i+1), 'Sin pérdida de incrementos en ' + modulo)
    check(values.includes(prefix + '2040-001'), true, 'Primer alta concurrente 001')
  }
  for (const [modulo, prefix, , table] of series.filter(([, , , table]) => table)) {
    const inserted = await inRole('authenticated', `INSERT INTO public.${table}(ok) VALUES(true) RETURNING folio`)
    check(inserted.rows[0].folio.startsWith(prefix), true, 'Alta sin folio usa trigger ' + table)
    const beforeFailure = (await pool.query('SELECT ultimo FROM qms_private.folios_anuales WHERE modulo=$1 AND anio=extract(year FROM timezone(\'America/Costa_Rica\',now()))', [modulo])).rows
    await fail(() => inRole('authenticated', `INSERT INTO public.${table}(ok) VALUES(false)`), '23514')
    check((await pool.query('SELECT ultimo FROM qms_private.folios_anuales WHERE modulo=$1 AND anio=extract(year FROM timezone(\'America/Costa_Rica\',now()))', [modulo])).rows, beforeFailure, 'Alta inválida revierte contador')
    await inRole('authenticated', `INSERT INTO public.${table}(folio) VALUES($1)`, [prefix + '2035-007'])
    check(await next(modulo, '2035-07-01T12:00:00Z'), prefix + '2035-008', 'Respeta código manual dentro de la serie')
    await inRole('authenticated', `INSERT INTO public.${table}(folio) VALUES($1)`, ['MANUAL-' + modulo])
    check(await next(modulo, '2035-07-01T12:00:00Z'), prefix + '2035-009', 'Código ajeno no cambia serie')
    await pool.query(`ALTER POLICY allow_${modulo === 'sacp' ? 'sacp' : modulo} ON public.${table} WITH CHECK(false)`)
    const beforeDenied = (await pool.query('SELECT ultimo FROM qms_private.folios_anuales WHERE modulo=$1 ORDER BY anio', [modulo])).rows
    await fail(() => inRole('authenticated', `INSERT INTO public.${table}(ok) VALUES(true)`), '42501')
    check((await pool.query('SELECT ultimo FROM qms_private.folios_anuales WHERE modulo=$1 ORDER BY anio', [modulo])).rows, beforeDenied, 'Rechazo RLS no consume número')
  }
  check((await pool.query("SELECT has_sequence_privilege('anon','public.quejas_folio_seq','USAGE') AS anon,has_sequence_privilege('authenticated','public.seq_folio_sacp','UPDATE') AS authenticated")).rows[0], { anon:false, authenticated:false }, 'Secuencias retiradas cerradas')
  // Corte de la serie de pruebas: mantiene filas/IDs y modifica solo futuras altas.
  await pool.query(`CREATE TABLE public.quejas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),folio text UNIQUE);
    INSERT INTO public.quejas(folio) VALUES('2026-2089'),('QUEJA-2026-0001');
    UPDATE public.folios_quejas_anuales SET ultimo=2089 WHERE anio=2026;`)
  const historical = (await pool.query('SELECT * FROM public.quejas ORDER BY folio')).rows
  await pool.query('BEGIN')
  await pool.query(fs.readFileSync('supabase/migrations/20261111155021_quejas_corregir_arrastre_consecutivo.sql','utf8'))
  await pool.query('COMMIT')
  check((await pool.query('SELECT * FROM public.quejas ORDER BY folio')).rows,historical,'Corte no renumera ni borra históricos')
  check((await pool.query('SELECT ultimo FROM public.folios_quejas_anuales WHERE anio=2026')).rows[0].ultimo,89,'Elimina solo el arrastre de 2000')
  await pool.query('BEGIN')
  check(await next('quejas','2026-11-11T18:00:00Z'),'2026-090','Siguiente contador 090')
  check(await next('quejas','2027-01-01T06:00:00Z'),'2027-001','Siguiente año sigue empezando en 001')
  await pool.query('ROLLBACK')
  const year = Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Costa_Rica'}).format(new Date()))
  await pool.query('BEGIN')
  await pool.query('INSERT INTO public.folios_quejas_anuales VALUES($1,2061) ON CONFLICT(anio) DO UPDATE SET ultimo=2061',[year])
  await pool.query('INSERT INTO public.quejas(folio) VALUES($1),($2)',[year+'-2062',year+'-2063'])
  check((await pool.query('SELECT public.generar_folio_queja() AS folio')).rows[0].folio,year+'-2064','Salta folios históricos ocupados')
  await pool.query('ROLLBACK')
  const evidence = { checks, database: 'PostgreSQL aislado', remoteBusinessWrites: 0, series: series.map(([modulo])=>modulo), cases: ['cambio de año CR en tres zonas de sesión','200 asignaciones concurrentes','rollback por validación y RLS','compatibilidad RPC','históricos y reservas','999/1000','corte 2089 a 089 sin renumerar y salto de históricos'], migration: migrationName }
  fs.writeFileSync(path.join(work, 'evidence.json'), JSON.stringify(evidence,null,2))
  console.log(JSON.stringify({ ...evidence, evidence: path.join(work, 'evidence.json') },null,2))
} finally {
  if (pool) await pool.end()
  if (started) run('pg_ctl.exe', ['-D',data,'-m','immediate','-w','stop'])
}
