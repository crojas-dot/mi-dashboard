'use client'

import LogoEmpresaEditor from './LogoEmpresaEditor'
import ImagenIdentidadEditor from './ImagenIdentidadEditor'
import { useIdentidadImagenes } from '@/lib/queries/useIdentidadImagenes'

export default function IdentidadSettings({ active }: { active: boolean }) {
  const imagenes = useIdentidadImagenes(active)
  const urls = imagenes.data

  return <div className="space-y-5">
    <LogoEmpresaEditor active={active} />
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-qms-dark">Identidad del correo</h3>
        <p className="mt-1 text-sm text-qms-muted">Logo para reemplazar la E del encabezado, junto al nombre QMS ECA. La actualización del envío real de correos se integra por separado en Apps Script.</p>
      </div>
      <ImagenIdentidadEditor slot="correo_encabezado" url={urls?.correo_encabezado ?? ''} />
    </div>
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-qms-dark">Pantallas de acceso y formularios</h3>
        <p className="mt-1 text-sm text-qms-muted">El fondo se aplica únicamente al inicio de sesión. El formulario externo mostrará su logo en la esquina superior derecha, sin modificar sus campos.</p>
      </div>
      <ImagenIdentidadEditor slot="login_fondo" url={urls?.login_fondo ?? ''} />
      <ImagenIdentidadEditor slot="formulario_encabezado" url={urls?.formulario_encabezado ?? ''} />
    </div>
    {imagenes.isError && <p role="alert" className="text-sm text-qms-danger">No se pudieron cargar las imágenes actuales.</p>}
  </div>
}
