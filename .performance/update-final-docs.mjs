import fs from 'node:fs'
fs.copyFileSync('.performance/visual-patterns.md','docs/visual-patterns.md')
const root='AGENTS.md'
let text=fs.readFileSync(root,'utf8')
const start=text.indexOf('## Mantenimiento visual vigente'),end=text.indexOf('# ECA-QMS — Arquitectura Completa del Sistema')
text=text.slice(0,start)+`## Mantenimiento visual vigente — migración completada (2026-10-05)

La apariencia usa React propio + Tailwind v4, exclusivamente con prefijo tw:.
CoreUI/Bootstrap se retiraron; se conserva su estética, no sus componentes/CSS.
Antes de editar leer docs/visual-patterns.md y contextovisual.md.
Entrada única: app/globals.css → app/styles/ui-kit.css. Paleta en tokens.css.
Componentes: components/ui/tailwind/. Geometría local: archivos *.styles.ts.
No reinstalar CoreUI ni crear clases sin prefijo, adaptadores o CSS Modules.
No mezclar la capa visual con hooks, permisos, payloads o consultas.
Formularios: import estático y DeferredMount solo para montaje. Gráficas dinámicas.
Errores: ErrorState + getUserError; nunca ocultarlos como listas vacías.
Modales: diálogo HTML nativo, foco, Escape y fondo inerte; conservar guardas del propietario.
Quejas/Mis Quejas: tablas HTML nativas con tw:[contain:paint] y tw:overscroll-contain.
Validar lint, test, build y node scripts/check-visual-layer.mjs.
Ver docs/tailwind-migration-complete.md. El inventario técnico histórico que sigue
conserva reglas de negocio; nombres CoreUI/CSS antiguos no autorizan recrearlos.

`+text.slice(end)
fs.writeFileSync(root,text)
fs.writeFileSync('components/ui/AGENTS.md',`# UI ECA-QMS

La migración terminó. Los componentes canónicos están en tailwind/.
No recrear los adaptadores eliminados ni importar CoreUI/Bootstrap.
Leer ../../docs/visual-patterns.md y tailwind/AGENTS.md.
DeferredMount sigue siendo un controlador de montaje, sin estilos ni descargas.
icons.tsx mantiene nombres de aplicación respaldados únicamente por Lucide.
`)
fs.writeFileSync('components/ui/tailwind/AGENTS.md',`# UI kit React + Tailwind

- Solo React y utilidades tw:. Sin Bootstrap, CoreUI, CSS Modules ni CSS de componentes.
- Leer ../../../docs/visual-patterns.md antes de editar.
- Tokens: app/styles/tokens.css. Alias: app/styles/ui-kit.css, única entrada Tailwind v4.
- cn combina clsx + tailwind-merge con prefijo tw. Importaciones directas por archivo.
- Sin red, permisos, consultas, stores ni mutaciones aquí.
- Conservar props HTML/ARIA, ref, eventos, disabled/loading. Button usa type=button.
- Labels enlazados al id; nombres accesibles en acciones/filtros.
- Modal usa dialog/showModal: conservar pila, foco, Escape, backdrop y bloqueo de scroll.
- No dinamizar formularios al primer clic. ChartCanvas es la excepción pesada y diferida.
- Validar npm test, npm run lint, npm run build y node scripts/check-visual-layer.mjs.
`)
for(const f of ['contextovisual.md','docs/tailwind-migration.md','docs/cleanup-step5-status.md','docs/migration-step4-batch1.md']) {
const old=fs.readFileSync(f,'utf8')
fs.writeFileSync(f,'> **Estado vigente (2026-10-05): migración completada.** React + Tailwind tw:, sin dependencias CoreUI/Bootstrap. Esta fase/inventario es histórico; seguir [patrones actuales]('+ (f==='contextovisual.md'?'docs/visual-patterns.md':'visual-patterns.md') +') y el [reporte final]('+(f==='contextovisual.md'?'docs/tailwind-migration-complete.md':'tailwind-migration-complete.md')+').\n\n'+old)
}
// Name the chart token reader for its current purpose instead of the old vendor.
fs.renameSync('components/dashboard/cuiColors.ts','components/dashboard/chartColors.ts')
for(const f of fs.readdirSync('components/dashboard').filter(n=>/\.tsx?$/.test(n))) {
const path='components/dashboard/'+f
fs.writeFileSync(path,fs.readFileSync(path,'utf8').replaceAll('./cuiColors','./chartColors').replaceAll('CuiColors','ChartColors').replaceAll('cuiColors','chartColors').replaceAll('tokens.css + coreui-bridge.css','tokens.css'))
}
for(const f of ['tests/dashboard-year.test.mjs']) {
fs.writeFileSync(f,fs.readFileSync(f,'utf8').replaceAll('./cuiColors','./chartColors').replaceAll('cuiColors:','chartColors:'))
}
if(fs.existsSync('components/Modal.styles.ts'))fs.unlinkSync('components/Modal.styles.ts')
console.log('Updated architecture instructions and visual documentation.')
