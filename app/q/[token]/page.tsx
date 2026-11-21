import FondoIdentidad from '@/components/identidad/FondoIdentidad'
import { identidadFormularioInicial } from '@/lib/server/identidad-publica'
import { publicFormFrameOrigin } from '@/lib/utils/publicFormEmbed'
import FormularioQuejaPublica from '@/app/q/components/FormularioQuejaPublica'
import PublicFormFrameHeight from '@/app/q/components/PublicFormFrameHeight'

export default async function FormularioQuejaPublicaPage({ params, searchParams }: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ embed?: string | string[] }>
}) {
  const [{ token }, { embed }] = await Promise.all([params, searchParams])
  const isEmbed = embed === '1'
  const { formulario_encabezado: logo, login_fondo: fondo } = await identidadFormularioInicial(isEmbed)
  // Un token nuevo remonta el formulario y su borrador.
  const form = <FormularioQuejaPublica key={token} token={token} isEmbed={isEmbed} initialLogo={logo} />

  if (isEmbed) return <div data-public-form-embed className="mx-auto w-full max-w-3xl">
    <PublicFormFrameHeight origin={publicFormFrameOrigin(process.env.ALLOWED_FRAME_ORIGIN)} />
    {form}
  </div>

  return <FondoIdentidad slot="login_fondo" initialUrl={fondo} initialLogo="">
    <div className="mx-auto w-full max-w-[928px] px-4 py-3 text-qms-dark antialiased sm:flex sm:min-h-dvh sm:flex-col">{form}</div>
  </FondoIdentidad>
}
