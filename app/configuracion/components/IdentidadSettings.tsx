'use client'

import LogoEmpresaEditor from './LogoEmpresaEditor'
import ImagenIdentidadEditor from './ImagenIdentidadEditor'
import { useIdentidadImagenes } from '@/lib/queries/useIdentidadImagenes'

export default function IdentidadSettings({ active }: { active: boolean }) {
  const imagenes = useIdentidadImagenes(active)
  const urls = imagenes.data

  return <div className="space-y-5">
    <LogoEmpresaEditor active={active} />
    {imagenes.isError && (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-qms-danger/30 bg-qms-danger/5 p-3 text-sm text-qms-danger">
        <span>No se pudo recuperar la configuración de imágenes. Los archivos guardados no se han borrado.</span>
        <button type="button" className="font-medium underline" onClick={() => void imagenes.refetch()}>Reintentar</button>
      </div>
    )}
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-qms-dark">Identidad del correo</h3>
        <p className="mt-1 text-sm text-qms-muted">Logo para reemplazar la E del encabezado, junto al nombre QMS ECA. La actualización del envío real de correos se integra por separado en Apps Script.</p>
      </div>
      <ImagenIdentidadEditor slot="correo_encabezado" url={urls?.correo_encabezado ?? ''} loading={imagenes.isPending} />
    </div>
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-qms-dark">Pantallas de acceso y formularios</h3>
        <p className="mt-1 text-sm text-qms-muted">El fondo se aplica únicamente al inicio de sesión. El formulario externo mostrará su logo en la esquina superior derecha, sin modificar sus campos.</p>
      </div>
      <ImagenIdentidadEditor slot="login_fondo" url={urls?.login_fondo ?? ''} loading={imagenes.isPending} />
      <ImagenIdentidadEditor slot="formulario_encabezado" url={urls?.formulario_encabezado ?? ''} loading={imagenes.isPending} />
    </div>

  </div>
}
