import { create } from 'zustand'
export const useMemory = create(() => ({
  procesos: [{ id: 'p1', nombre_proceso: 'Gestión documental', tipo: 'Soporte', objetivo: 'Mantener documentos vigentes', estado: 'Activo' }],
  auditorias: [{ id: 'a1', folio: 'AUD-TEST-001', tipo: 'Interna', objetivo: 'Revisión de calidad', estado: 'Planificada' }],
  riesgos: [{ id: 'r1', folio: 'RIESGO-TEST-001', probabilidad: 2, impacto: 2, nivel: 'Medio', estado: 'Activo' }],
  reuniones: [{ id: 'rev1', titulo: 'Revisión por Dirección', fecha_programada: '2026-10-05', estado: 'Planificada', participantes: 'Equipo de prueba', agenda: 'Seguimiento de calidad' }],
  documentos: [{ id: 'd1', codigo_doc: 'PR-TEST-001', titulo: 'Procedimiento de calidad', version_actual: '1.0', estado: 'Borrador' }],
}))
export const supabase = {
  rpc: async () => ({ error: null }),
  from(table) {
    return {
      async insert(rows) { useMemory.setState(state => ({[table]: [...state[table], ...rows.map(row => ({...row, id: 'test-new-'+state[table].length}))]})); return {error:null} },
      update(values) {
        return { async eq(_field,id) {
          useMemory.setState(state => ({[table]:state[table].map(row=>row.id===id?{...row,...values}:row)}))
          return {error:null}
        } }
      },
      select() { let filter=null; const result={ eq(field,value){filter=[field,value];return result}, then(resolve,reject){const data=useMemory.getState()[table]??[];return Promise.resolve({count:filter?data.filter(row=>row[filter[0]]===filter[1]).length:data.length,error:null}).then(resolve,reject)} };return result },
    }
  },
}
