export interface FilaInforme { id: string; estado: string; [key: string]: unknown }
export interface CatalogoItem { valor: string; color: string }
export interface ColumnaInforme { key: string; label: string }
export interface IncluirInforme { tabla: boolean; resumen: boolean; vencidos: boolean; distribucion: boolean }
export interface FiltrosInforme {
  fechaDesde: string
  fechaHasta: string
  estado: string
  prioridad: string
  tipo: string
}
