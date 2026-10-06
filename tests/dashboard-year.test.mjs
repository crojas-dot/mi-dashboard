import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const { partesEnZona, mesesDelAnio } = loadModule('lib/timeZone.ts')

test('el año y el mes respetan Costa Rica al cruzar medianoche UTC', () => {
  assert.equal(partesEnZona('2026-01-01T00:30:00Z', 'America/Costa_Rica').anio, 2025)
  assert.equal(partesEnZona('2026-01-01T06:30:00Z', 'America/Costa_Rica').anio, 2026)
  assert.equal(partesEnZona('2026-02-01T02:00:00Z', 'America/Costa_Rica').mes, 1)
})

test('todos los tabs comparten enero al mes actual y excluyen fechas del año anterior', () => {
  const calendario = mesesDelAnio('2026-09-23T12:00:00Z', 'America/Costa_Rica')
  assert.equal(calendario.anio, 2026)
  assert.equal(calendario.meses.length, 9)
  assert.equal(calendario.meses[0], 'Ene')
  assert.ok(calendario.meses.every((mes) => !/\d{2}$/.test(mes)))
  const { seriesDelAnio } = loadModule('components/dashboard/chartKit.tsx', {
    '@coreui/react': {}, './chartColors': { chartColors: () => ({}) },
  })
  const serie = seriesDelAnio([
    { fecha: '2025-09-12' }, { fecha: '2026-01-01' },
    { fecha: '2026-09-01T01:00:00Z' }, { fecha: '2026-09-01T06:00:00Z' },
  ], (fila) => fila.fecha, Date.parse('2026-09-23T12:00:00Z'), 'America/Costa_Rica')
  assert.equal(serie.valores[0], 1)
  assert.equal(serie.valores[7], 1) // 01:00 UTC aún es agosto en Costa Rica
  assert.equal(serie.valores[8], 1)
  assert.equal(serie.valores.reduce((suma, valor) => suma + valor, 0), 3)
})

function fuenteDePrueba(filas, tablaEsperada = 'quejas') {
  const peticiones = []
  return {
    peticiones,
    supabase: {
      from(tabla) {
        assert.equal(tabla, tablaEsperada)
        const consulta = { campos: '', filtros: [], orden: [], inicio: 0, fin: 0 }
        const api = {
          select(campos) { consulta.campos = campos; return api },
          gte(campo, valor) { consulta.filtros.push((fila) => fila[campo] >= valor); return api },
          lt(campo, valor) { consulta.filtros.push((fila) => fila[campo] < valor); return api },
          order(campo) { consulta.orden.push(campo); return api },
          range(inicio, fin) { consulta.inicio = inicio; consulta.fin = fin; return api },
          abortSignal() { return api },
          then(resolver) {
            const ordenadas = filas.filter((fila) => consulta.filtros.every((filtro) => filtro(fila)))
              .sort((a, b) => {
                for (const campo of consulta.orden) {
                  if (a[campo] !== b[campo]) return String(a[campo]).localeCompare(String(b[campo]))
                }
                return 0
              })
            peticiones.push({ campos: consulta.campos, inicio: consulta.inicio, fin: consulta.fin })
            return Promise.resolve({ data: ordenadas.slice(consulta.inicio, consulta.fin + 1), error: null }).then(resolver)
          },
        }
        return api
      },
    },
  }
}

test('el gráfico usa meses del año actual, pagina y cuenta cierres de quejas iniciadas antes', async () => {
  const filas = Array.from({ length: 1001 }, (_, i) => ({
    id: String(i).padStart(4, '0'), folio: `Q-${i}`, cliente_nombre: 'Cliente',
    prioridad: 'Alta', categoria: 'Queja', estado: 'Recibido',
    fecha: '2026-06-15T12:00:00Z', fecha_cierre: null, fecha_sla: null,
  }))
  filas.push({ id: 'antigua', folio: 'Q-ANT', categoria: 'Queja', estado: 'Finalizado',
    fecha: '2025-11-01T12:00:00Z', fecha_cierre: '2026-03-02T12:00:00Z' })
  filas.push({ id: 'limite', folio: 'Q-LIM', categoria: 'Queja', estado: 'Recibido',
    fecha: '2026-01-01T00:30:00Z', fecha_cierre: null })
  const fuente = fuenteDePrueba(filas)
  const { fetchQuejasAnalisis } = loadModule('lib/queries/useQuejasAnalisis.ts', {
    '@/lib/supabase': { supabase: fuente.supabase },
    '@tanstack/react-query': { useQuery: () => null },
  })
  const resultado = await fetchQuejasAnalisis('America/Costa_Rica', 2026)
  assert.equal(resultado.anio, 2026)
  const hoy = partesEnZona(new Date(), 'America/Costa_Rica')
  assert.equal(resultado.series.length, hoy.anio === 2026 ? hoy.mes : 12)
  assert.equal(resultado.series[5].recibidas, 1001)
  assert.equal(resultado.series[2].resueltas, 1)
  assert.equal(resultado.series[0].recibidas, 0)
  assert.equal(resultado.porEstado[0].total, 1001)
  assert.ok(fuente.peticiones.some((peticion) => peticion.inicio === 1000))
  assert.ok(resultado.series.every((mes) => !/\d{2}$/.test(mes.mes)))
})

test('cambios documentales usan el año local completo y no se truncan en 1000 filas', async () => {
  const filas = Array.from({ length: 1001 }, (_, i) => ({
    id: String(i).padStart(4, '0'), fecha: '2026-05-10T12:00:00Z',
  }))
  filas.push({ id: 'antigua', fecha: '2025-09-10T12:00:00Z' })
  filas.push({ id: 'borde', fecha: '2026-01-01T00:30:00Z' })
  const fuente = fuenteDePrueba(filas, 'versiones_documentos')
  const { fetchVersionesAnalisis } = loadModule('lib/queries/useModulosAnalisis.ts', {
    '@/lib/supabase': { supabase: fuente.supabase },
    '@tanstack/react-query': { useQuery: () => null },
  })
  const resultado = await fetchVersionesAnalisis('America/Costa_Rica', 2026)
  assert.equal(resultado.length, partesEnZona(new Date(), 'America/Costa_Rica').mes)
  assert.equal(resultado[4].total, 1001)
  assert.equal(resultado[0].total, 0)
  assert.ok(fuente.peticiones.some((peticion) => peticion.inicio === 1000))
})

test('cancelar una consulta impide publicar una serie antigua', async () => {
  const fuente = fuenteDePrueba([])
  const { fetchQuejasAnalisis } = loadModule('lib/queries/useQuejasAnalisis.ts', {
    '@/lib/supabase': { supabase: fuente.supabase },
    '@tanstack/react-query': { useQuery: () => null },
  })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(fetchQuejasAnalisis('America/Costa_Rica', 2026, controller.signal),
    (error) => error.name === 'AbortError')
  assert.equal(fuente.peticiones.length, 0)
})
