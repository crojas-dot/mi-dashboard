'use client'
import { useRouter,useSearchParams } from 'next/navigation'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import { CAlert } from '@coreui/react'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queries/queryKeys'
import { useCatalogoTipo } from '@/lib/queries/useCatalogos'
import type { Queja } from '@/lib/types'
import QuejaDetalleModal from '@/app/quejas/components/QuejaDetalleModal'
import ErrorState from '@/components/ui/ErrorState'
/** Read one authorized record for dashboard links, even outside the current page. */
export default function QuejaDeepLink(){
 const id=useSearchParams().get('expediente'),router=useRouter(),client=useQueryClient()
 const query=useQuery({queryKey:[...queryKeys.quejas,'expediente',id],enabled:!!id,queryFn:async({signal})=>{
   const {data,error}=await supabase.from('qms_quejas').select('*').eq('id',id!).abortSignal(signal).single()
   if(error)throw error
   return data as Queja
 }})
 const {data:prioridades=[]}=useCatalogoTipo('prioridad'),{data:categorias=[]}=useCatalogoTipo('categoria_queja')
 const close=()=>router.replace('/quejas',{scroll:false})
 if(!id)return null
 if(query.error)return <ErrorState title="No se pudo abrir el expediente" error={query.error} onRetry={()=>void query.refetch()}/>
 if(!query.data)return <CAlert color="info">Consultando el expediente seleccionado…</CAlert>
 return <QuejaDetalleModal queja={query.data} prioridades={prioridades} categorias={categorias} onClose={close} onUpdated={()=>{close();void client.invalidateQueries({queryKey:queryKeys.quejas});void client.invalidateQueries({queryKey:queryKeys.dashboard})}}/>
}
