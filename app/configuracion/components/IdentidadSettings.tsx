'use client'

import LogoEmpresaEditor from './LogoEmpresaEditor'
import ImagenIdentidadEditor from './ImagenIdentidadEditor'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { guardarEstiloLogoCorreo, identidadImagenesKey, useIdentidadImagenes, type ImagenesIdentidad } from '@/lib/queries/useIdentidadImagenes'
import { emailLogoStyle } from '@/supabase/functions/_shared/emailIdentity'

export default function IdentidadSettings({ active }: { active: boolean }) {
  const imagenes = useIdentidadImagenes(active)
  const urls = imagenes.data
  const queryClient = useQueryClient()
  const guardarEstilo = useMutation({
    mutationFn: guardarEstiloLogoCorreo,
    onSuccess: (_, style) => {
      queryClient.setQueryData<ImagenesIdentidad>(identidadImagenesKey, current => current && { ...current, emailLogoStyle: style })
      showSuccess('Estilo del logo actualizado')
    },
    onError: error => showError(error, 'No se pudo guardar el estilo de correo'),
  })
  const estilo = urls?.emailLogoStyle ?? 'horizontal'

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
      </div>
      <div className="ui-panel space-y-2 p-4 sm:p-5">
        <div className="max-w-xs">
          <Field id="email-logo-style" label="Estilo del logo en correos">
            <Select id="email-logo-style" value={guardarEstilo.isPending ? guardarEstilo.variables : estilo}
              disabled={!urls || guardarEstilo.isPending} onChange={event => guardarEstilo.mutate(emailLogoStyle(event.target.value))}>
              <option value="horizontal">Horizontal</option>
              <option value="cuadrado">Cuadrado</option>
            </Select>
          </Field>
        </div>
        {estilo === 'cuadrado' && !urls?.correo_cuadrado && <p className="text-xs text-qms-muted">Se usa el logo horizontal hasta que cargués un emblema cuadrado.</p>}
      </div>
      <ImagenIdentidadEditor slot="correo_encabezado" url={urls?.correo_encabezado ?? ''} loading={imagenes.isPending} configurada={urls?.configuradas?.correo_encabezado ?? false} />
      <ImagenIdentidadEditor slot="correo_cuadrado" url={urls?.correo_cuadrado ?? ''} loading={imagenes.isPending} configurada={urls?.configuradas?.correo_cuadrado ?? false} />
    </div>
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-qms-dark">Pantallas de acceso y formularios</h3>
      </div>
      <ImagenIdentidadEditor slot="login_encabezado" url={urls?.login_encabezado ?? ''} loading={imagenes.isPending} configurada={urls?.configuradas?.login_encabezado ?? false} />
      <ImagenIdentidadEditor slot="login_fondo" url={urls?.login_fondo ?? ''} loading={imagenes.isPending} configurada={urls?.configuradas?.login_fondo ?? false} />
      <ImagenIdentidadEditor slot="formulario_encabezado" url={urls?.formulario_encabezado ?? ''} loading={imagenes.isPending} configurada={urls?.configuradas?.formulario_encabezado ?? false} />
    </div>

  </div>
}
