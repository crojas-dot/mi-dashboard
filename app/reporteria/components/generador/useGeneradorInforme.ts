'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { showError } from '@/lib/services/errorToast'
import { CONFIG_INFORMES } from './configuracion'
import { fetchCatalogosInforme, fetchFilasInforme } from './consultas'
import type { CatalogoItem, FilaInforme } from './tipos'

/** El componente padre decide montaje/key: cerrar o cambiar moduloInicial reinicia el borrador. */
export function useGeneradorInforme(moduloInicial: string | null) {
  const [paso, setPaso] = useState(moduloInicial ? 2 : 1)
  const [modulo, setModulo] = useState(moduloInicial ?? '')
  const [incluir, setIncluir] = useState({ tabla: true, resumen: true, vencidos: false, distribucion: false })
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterPrioridad, setFilterPrioridad] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [catalogoEstados, setCatalogoEstados] = useState<CatalogoItem[]>([])
  const [catalogoPrioridades, setCatalogoPrioridades] = useState<CatalogoItem[]>([])
  const [catalogoTipos, setCatalogoTipos] = useState<CatalogoItem[]>([])
  const [resultados, setResultados] = useState<FilaInforme[]>([])
  const [generacion, setGeneracion] = useState<{ modulo: string; paso: number; controller: AbortController } | null>(null)
  const generacionActual = useRef<AbortController | null>(null)
  const catalogosActuales = useRef<AbortController | null>(null)
  const loading = !!generacion && generacion.modulo === modulo && generacion.paso === paso && !generacion.controller.signal.aborted

  // Volver A → B → A o salir de filtros termina la lectura anterior antes del siguiente paint.
  useLayoutEffect(() => () => {
    generacionActual.current?.abort()
    generacionActual.current = null
    catalogosActuales.current?.abort()
    catalogosActuales.current = null
  }, [modulo, paso])

  useEffect(() => {
    if (paso !== 2) return
    const controller = new AbortController()
    catalogosActuales.current = controller
    const cargarCatalogos = async () => {
      setCatalogoEstados([])
      setCatalogoPrioridades([])
      setCatalogoTipos([])
      try {
        const catalogos = await fetchCatalogosInforme(modulo, controller.signal)
        if (controller.signal.aborted) return
        const tipos = CONFIG_INFORMES[modulo]?.catalogos ?? {}
        if (tipos.estado) setCatalogoEstados(catalogos.estados)
        if (tipos.prioridad) setCatalogoPrioridades(catalogos.prioridades)
        if (tipos.tipo) setCatalogoTipos(catalogos.tipos)
      } catch (error) {
        if (!controller.signal.aborted) showError(error, 'No se pudieron cargar los filtros del informe')
      }
    }
    void cargarCatalogos()
    return () => controller.abort()
  }, [paso, modulo])

  const generarInforme = async () => {
    if (!CONFIG_INFORMES[modulo] || generacionActual.current) return
    const controller = new AbortController()
    generacionActual.current = controller
    setGeneracion({ modulo, paso, controller })
    try {
      const filas = await fetchFilasInforme(modulo, {
        fechaDesde, fechaHasta, estado: filterEstado, prioridad: filterPrioridad, tipo: filterTipo,
      }, controller.signal)
      controller.signal.throwIfAborted()
      setResultados(filas)
      setPaso(3)
    } catch (error) {
      if (!controller.signal.aborted) showError(error, 'No se pudo generar el informe')
    } finally {
      if (generacionActual.current === controller) {
        generacionActual.current = null
        setGeneracion(null)
      }
    }
  }

  return {
    paso, setPaso, modulo, setModulo, incluir, setIncluir,
    fechaDesde, setFechaDesde, fechaHasta, setFechaHasta,
    filterEstado, setFilterEstado, filterPrioridad, setFilterPrioridad, filterTipo, setFilterTipo,
    catalogoEstados, catalogoPrioridades, catalogoTipos, resultados, loading, generarInforme,
  }
}
