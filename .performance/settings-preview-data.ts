import { create } from 'zustand'

const rows: Record<string, any[]> = {
  catalogos: [
    ...['Queja', 'Denuncia', 'Sugerencia', 'Felicitación'].map((valor, index) => ({ id: `c${index}`, modulo: 'quejas', tipo: 'categoria_queja', valor, color: ['blue', 'red', 'amber', 'green'][index], orden: index, activo: index !== 2 })),
    ...['Recibido', 'En Investigación', 'Resuelto', 'Finalizado'].map((valor, index) => ({ id: `e${index}`, modulo: 'quejas', tipo: 'estado_queja', valor, color: 'blue', orden: index, activo: true })),
    { id: 'p1', modulo: 'quejas', tipo: 'prioridad', valor: 'Alta', color: 'red', orden: 1, activo: true },
  ],
  sla_config: [
    { id: 's1', proceso: 'quejas', prioridad: 'Alta', dias_alerta: 1, dias_vencimiento: 3 },
    { id: 's2', proceso: 'quejas', prioridad: 'Media', dias_alerta: 3, dias_vencimiento: 7 },
  ],
  configuraciones_sistema: [
    { clave: 'nombre_organizacion', valor: 'ECA-QMS', categoria: 'general', descripcion: 'Nombre visible de la organización.' },
    { clave: 'drive_folder_id_quejas', valor: 'carpeta-de-evidencias-demo', categoria: 'integraciones', descripcion: 'Carpeta donde se guardan las evidencias de quejas.' },
    { clave: 'avisos_habilitados', valor: true, categoria: 'general', descripcion: 'Habilita los avisos del panel.' },
    { clave: 'ai_providers', valor: [], categoria: 'ia' }, { clave: 'ai_routing', valor: {}, categoria: 'ia' },
  ],
  formularios_publicos: [
    { id: 'f1', nombre: 'Quejas desde el sitio web', token: 'demo-web', activo: true, created_at: '2026-10-01' },
    { id: 'f2', nombre: 'Recepción presencial', token: 'demo-presencial', activo: false, created_at: '2026-09-20' },
  ],
  permisos: ['admin', 'calidad', 'colaborador'].flatMap(rol => ['dashboard', 'quejas', 'mis_quejas', 'documentos', 'sacp', 'riesgos', 'auditorias', 'revision', 'procesos', 'usuarios', 'configuracion', 'reporteria'].map(modulo => ({ rol, modulo, leer: rol !== 'colaborador' || modulo === 'mis_quejas', escribir: rol === 'admin' || modulo === 'mis_quejas' }))),
}
export const memory = create(() => rows)
export const supabase = {
  from(table: string) {
    const filters: ((row: any) => boolean)[] = []
    let operation = 'read', payload: any, single = false
    const execute = async () => {
      let matches = (memory.getState()[table] ?? []).filter(row => filters.every(filter => filter(row)))
      if (operation !== 'read') {
        const all = memory.getState()[table] ?? []
        if (operation === 'delete') memory.setState({ [table]: all.filter(row => !matches.includes(row)) })
        else if (operation === 'update') { matches = matches.map(row => ({ ...row, ...payload })); memory.setState({ [table]: all.map(row => filters.every(filter => filter(row)) ? { ...row, ...payload } : row) }) }
        else {
          const incoming = (Array.isArray(payload) ? payload : [payload]).map((row: any) => ({ id: crypto.randomUUID(), token: `demo-${Date.now()}`, created_at: new Date().toISOString(), ...row }))
          const key = table === 'permisos' ? (row: any) => `${row.rol}:${row.modulo}` : (row: any) => row.clave ?? row.id
          memory.setState({ [table]: [...all.filter(row => !incoming.some((item: any) => key(row) === key(item))), ...incoming] })
          matches = incoming
        }
      }
      return { data: single ? matches[0] ?? null : matches, count: matches.length, error: null }
    }
    const query: any = {
      select: () => query, order: () => query, range: () => query, limit: () => query,
      eq(key: string, value: any) { filters.push(row => row[key] === value); return query },
      in(key: string, values: any[]) { filters.push(row => values.includes(row[key])); return query },
      not(key: string, operator: string, value: string) { if (operator === 'in') { const excluded = value.slice(1, -1).split(','); filters.push(row => !excluded.includes(row[key])) } return query },
      update(value: any) { operation = 'update'; payload = value; return query },
      insert(value: any) { operation = 'insert'; payload = value; return query },
      upsert(value: any) { operation = 'insert'; payload = value; return query },
      delete() { operation = 'delete'; return query },
      single() { single = true; return query }, maybeSingle() { single = true; return query },
      then(resolve: any, reject: any) { return execute().then(resolve, reject) },
    }
    return query
  },
  rpc: async () => ({ data: [], error: null }),
  auth: { getSession: async () => ({ data: { session: null } }) },
}
