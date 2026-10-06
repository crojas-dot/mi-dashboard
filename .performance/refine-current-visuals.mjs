import fs from 'node:fs'
import ts from 'typescript'
import crypto from 'node:crypto'
const files=[]
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=`${dir}/${e.name}`;if(e.isDirectory())scan(f);else if(/\.tsx?$/.test(f))files.push(f)}}
for(const dir of ['app','components','lib','hooks'])scan(dir)
const before=Object.fromEntries(files.map(f=>[f,fs.readFileSync(f,'utf8')]))
fs.writeFileSync('.performance/current-visual-before.json',JSON.stringify(before))
fs.writeFileSync('.performance/current-globals-before.css',fs.readFileSync('app/globals.css'))
function edit(file,fn){fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8')))}
edit('app/globals.css',text=>text.replace('Estilo Bootstrap estandarizado (ECA-QMS)','Identidad visual ECA-QMS — Tailwind CSS v4').replace('@theme {',`@theme {
  /* Escala de lectura común: cambiar aquí, no pantalla por pantalla. */
  --text-xs: 0.875rem;
  --text-xs--line-height: 1.45;
  --text-sm: 0.9375rem;
  --text-sm--line-height: 1.5;
  --text-base: 1.0625rem;
  --text-base--line-height: 1.55;
`).replace('--color-qms-primary: #0d6efd','--color-qms-primary: #4257be').replace('--color-qms-primary-dark: #0b5ed7','--color-qms-primary-dark: #34469f').replace('--color-qms-primary-hover: #0b5ed7','--color-qms-primary-hover: #34469f').replace('--color-qms-dark: #212529','--color-qms-dark: #212631').replace('--color-qms-muted: #6c757d','--color-qms-muted: #526174').replace('--color-qms-border: #dee2e6','--color-qms-border: #d7dde5').replace('--color-qms-header: #343a40','--color-qms-header: #eef1f6').replace('--color-qms-background: #f4f7f6','--color-qms-background: #f3f4f7').replace('--color-qms-hover-bg: #f8f9fa','--color-qms-hover-bg: #f6f8fb').replace('--color-soft-blue-bg: #e7f1ff','--color-soft-blue-bg: #edf0fb').replace('--color-soft-blue-text: #0d6efd','--color-soft-blue-text: #34469f').replace('font-size: 0.875rem;','font-size: 1.0625rem;\n  line-height: 1.55;'))
edit('components/ui/Table.tsx',text=>text.replace('overflow-x-auto rounded-card','overflow-auto overscroll-contain [contain:paint] rounded-card bg-qms-surface shadow-sm').replace('w-full text-left text-[0.85rem]','w-full min-w-[720px] border-collapse text-left text-base').replace('whitespace-nowrap bg-qms-header px-3 py-2 text-left text-[0.8125rem] font-semibold text-white','min-w-[120px] whitespace-nowrap border-b border-qms-border bg-qms-header px-4 py-4 text-left text-base font-semibold text-qms-dark').replace('px-3 py-2 align-middle text-qms-dark','px-4 py-4 align-middle text-qms-dark').replace('hover:bg-black/[0.03]','hover:bg-qms-hover-bg'))
edit('components/ui/Button.tsx',text=>text.replace("sm: 'px-2 py-1 text-sm'","sm: 'min-h-9 px-3 py-1.5 text-sm'").replace("md: 'px-3 py-1.5 text-sm'","md: 'min-h-11 px-4 py-2 text-base'").replace('gap-2 rounded-button','gap-2 rounded-button [&_svg.lucide]:h-5 [&_svg.lucide]:w-5 [&_svg.lucide]:stroke-[1.75]').replace('focus:outline-none','focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-qms-primary'))
edit('components/ui/Select.tsx',text=>text.replace('px-3 py-2 pr-8 text-sm','min-h-11 px-3 py-2 pr-9 text-base').replace('h-3.5 w-3.5','h-4 w-4'))
edit('components/ui/PageHeader.tsx',text=>text.replace('flex items-center justify-between mb-4','mb-5 flex flex-wrap items-center justify-between gap-3').replace('text-[0.85rem]','text-base').replace('h-4 w-4','h-5 w-5'))
edit('components/StatCard.tsx',text=>text.replace('text-[0.8125rem]','text-sm').replace('rounded-card border border-qms-border bg-qms-surface p-4','rounded-card border border-qms-border bg-qms-surface p-5 shadow-sm').replace('h-11 w-11','h-12 w-12').replace('rounded-card ${cs.bg}','rounded-card [&_svg]:h-6 [&_svg]:w-6 [&_svg]:stroke-[1.75] ${cs.bg}'))
edit('components/Sidebar.tsx',text=>text.replace('text-[9px]','text-xs').replace('text-white/25','text-white/55').replace('text-white/35','text-white/65').replace('text-[0.95rem]','text-base').replace("'h-4 w-4 shrink-0'","'h-5 w-5 shrink-0 stroke-[1.75]'"))
edit('components/Modal.tsx',text=>text.replace('text-sm font-semibold','text-lg font-semibold').replace('text-white/40','text-white/80').replace('h-4 w-4','h-5 w-5').replace('bg-qms-hover-bg px-4 py-3','bg-qms-surface px-5 py-5'))
for(const file of ['app/quejas/page.tsx','app/mis-quejas/page.tsx'])edit(file,text=>text.replace(/px-3 py-2\.5/g,'px-4 py-4').replace('text-left text-sm','text-left text-base').replace('bg-qms-header','bg-qms-header text-qms-dark').replaceAll('font-semibold text-white whitespace-nowrap','font-semibold text-qms-dark whitespace-nowrap').replaceAll('min-w-[160px]','min-w-[250px]').replaceAll('min-w-[140px]','min-w-[190px]').replaceAll('font-mono text-sm','font-mono text-base').replace('overflow-auto rounded-card','overflow-auto overscroll-contain [contain:paint] rounded-card bg-qms-surface shadow-sm').replace('min-w-[1000px]','min-w-[1160px]').replace('w-full select-text text-left text-base','w-full min-w-[1160px] select-text text-left text-base').replace('h-[38px]','h-11').replace('h-[34px]','h-11').replace('h-4 w-4 -translate-y-1/2','h-5 w-5 -translate-y-1/2').replace('text-sm outline-none','text-base outline-none').replace('flex items-center gap-2 mb-3 shrink-0','mb-4 grid shrink-0 grid-cols-1 items-center gap-3 md:grid-cols-[auto_minmax(240px,2fr)_minmax(150px,1fr)_minmax(150px,1fr)]'))
// Record business contracts from the version the user chose to keep.
const printer=ts.createPrinter({removeComments:true}),hash=a=>crypto.createHash('sha256').update(a.join('\n')).digest('hex')
const signatures=(f,t)=>{const s=ts.createSourceFile(f,t,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),hooks=[],events=[];function walk(n){if(ts.isCallExpression(n)&&/^use[A-Z]/.test(n.expression.getText(s)))hooks.push(printer.printNode(ts.EmitHint.Unspecified,n,s));if(ts.isJsxAttribute(n)&&/^on[A-Z]/.test(n.name.text))events.push(printer.printNode(ts.EmitHint.Unspecified,n,s));ts.forEachChild(n,walk)}walk(s);return{hooks:hash(hooks),events:hash(events)}}
const changed=Object.keys(before).filter(f=>fs.readFileSync(f,'utf8')!==before[f]),diff=[]
for(const f of changed)if(JSON.stringify(signatures(f,before[f]))!==JSON.stringify(signatures(f,fs.readFileSync(f,'utf8'))))diff.push(f)
fs.writeFileSync('.performance/current-visual-contracts.json',JSON.stringify({changed,diff},null,2))
if(diff.length)throw Error(`Business changed: ${diff}`)
console.log({changed,diff})
