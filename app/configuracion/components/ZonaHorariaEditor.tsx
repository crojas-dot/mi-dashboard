'use client'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import ErrorState from '@/components/ui/ErrorState'
import { queryKeys } from '@/lib/queries/queryKeys'
import { guardarZonaHoraria, useZonaHoraria, zonaHorariaKey } from '@/lib/queries/useZonaHoraria'
import { DEFAULT_TIME_ZONE, TIME_ZONE_GROUPS } from '@/lib/timeZone'
import { getUserError } from '@/lib/errors/userError'
import { showSuccess } from '@/lib/services/errorToast'

/** Editor administrativo de una sola preferencia. La API valida el rol y
 * devuelve únicamente esta clave, sin abrir el resto de la configuración.
 */
export default function ZonaHorariaEditor({ active = true }: { active?: boolean }) {
  const queryClient = useQueryClient()
  const zonaQuery = useZonaHoraria(active)
  const [borrador, setBorrador] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const guardandoRef = useRef(false)

  if (zonaQuery.error) return <ErrorState message="No se pudo cargar la zona horaria." onRetry={() => void zonaQuery.refetch()} />
  if (zonaQuery.isPending) return <p role="status" className="ui-panel p-6 text-sm text-qms-muted">Cargando zona horaria…</p>

  const actual = zonaQuery.data ?? DEFAULT_TIME_ZONE
  const seleccion = borrador ?? actual
  const guardar = async () => {
    if (guardandoRef.current || seleccion === actual) return
    guardandoRef.current = true
    setGuardando(true)
    setErrorGuardar(null)
    try {
      const guardada = await guardarZonaHoraria(seleccion)
      queryClient.setQueryData(zonaHorariaKey, guardada)
      setBorrador(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.configuraciones })
      showSuccess('Zona horaria actualizada')
    } catch (error) {
      setErrorGuardar(getUserError(error, 'No se pudo guardar la zona horaria').message)
    } finally {
      guardandoRef.current = false
      setGuardando(false)
    }
  }

  const enLista = TIME_ZONE_GROUPS.some((grupo) => grupo.options.some((opcion) => opcion.value === actual))
  return <section className="ui-panel overflow-hidden" aria-labelledby="titulo-zona-horaria">
    <h3 id="titulo-zona-horaria" className="border-b border-qms-border bg-qms-table-head px-5 py-3 text-sm font-semibold">Zona horaria</h3>
    <div className="space-y-4 p-5">
    <p className="text-sm text-qms-muted">Define la zona usada por las fechas, los plazos y los gráficos del dashboard.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={evento => { evento.preventDefault(); void guardar() }}>
      <Field id="zona-horaria-sistema" label="Región y país" className="w-full sm:max-w-md sm:flex-1">
        <Select id="zona-horaria-sistema" value={seleccion} disabled={guardando}
          onChange={(evento) => { setBorrador(evento.target.value); setErrorGuardar(null) }}>
          {!enLista && <option value={actual}>Actual: {actual}</option>}
          {TIME_ZONE_GROUPS.map((grupo) => <optgroup key={grupo.label} label={grupo.label}>
            {grupo.options.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label} ({opcion.value})</option>)}
          </optgroup>)}
        </Select>
      </Field>
      <Button type="submit" loading={guardando} disabled={seleccion === actual}>
        Guardar zona horaria
      </Button>
    </form>
    {errorGuardar && <p role="alert" className="text-sm text-qms-danger">{errorGuardar}</p>}
    <p className="text-xs text-qms-muted">Zona actual: <span className="select-text">{actual}</span>.</p>
    </div>
  </section>
}
