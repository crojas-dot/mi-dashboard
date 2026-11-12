import { redirect } from 'next/navigation'
import { MODULOS } from '@/lib/constants/modulos'

/** Alias del enlace de agenda; mantiene el Dashboard y sus permisos existentes. */
export default function DashboardAlias() { redirect(MODULOS.dashboard.ruta) }
