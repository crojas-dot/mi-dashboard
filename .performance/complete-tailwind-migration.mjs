// One-time, presentation-only migration. The snapshot is kept outside source control.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import postcss from 'postcss'

const files = []
function scan(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = `${dir}/${e.name}`; if (e.isDirectory()) scan(f); else if (/\.tsx$/.test(f)) files.push(f) } }
for (const dir of ['app', 'components', 'lib', 'hooks']) scan(dir)
const original = Object.fromEntries(files.map(f => [f, fs.readFileSync(f, 'utf8')]))
fs.mkdirSync('.performance', { recursive: true })
if (fs.existsSync('.performance/tailwind-final-before.json')) throw new Error('Snapshot already exists; do not rerun migration')
fs.writeFileSync('.performance/tailwind-final-before.json', JSON.stringify(original))

const tableClasses = 'tw:w-full tw:border-collapse tw:bg-surface tw:text-foreground tw:text-base tw:[&_th]:whitespace-nowrap tw:[&_th]:border-b tw:[&_th]:border-border tw:[&_th]:bg-background tw:[&_th]:px-3 tw:[&_th]:py-3 tw:[&_th]:text-left tw:[&_th]:font-semibold tw:[&_td]:border-b tw:[&_td]:border-border tw:[&_td]:px-3 tw:[&_td]:py-3.5 tw:[&_td]:align-middle tw:[&_tbody_tr]:hover:bg-hover'
const aliases = {
  'd-flex':'flex','d-inline-flex':'inline-flex','d-block':'block','d-none':'hidden','d-md-flex':'min-[768px]:flex',
  'align-items-center':'items-center','align-items-end':'items-end','justify-content-center':'justify-center','justify-content-between':'justify-between','justify-content-end':'justify-end',
  'flex-column':'flex-col','flex-grow-1':'grow','h-100':'h-full','min-vh-100':'min-h-dvh','me-auto':'me-auto','ms-auto':'ms-auto',
  'fs-3':'text-[1.75rem]','fs-5':'text-xl','h6':'text-base','fw-semibold':'font-semibold','fw-medium':'font-medium','lh-1':'leading-none',
  'small':'text-sm','text-body-secondary':'text-muted','text-body':'text-foreground','bg-body':'bg-surface','bg-body-tertiary':'bg-background','text-uppercase':'uppercase',
  'text-nowrap':'whitespace-nowrap','text-end':'text-right','text-decoration-none':'no-underline','text-success':'text-qms-success','text-danger':'text-qms-danger',
  'visually-hidden':'sr-only','border-start':'border-s','border-start-4':'border-s-4','border-start-success':'border-s-qms-success','border-start-warning':'border-s-qms-warning',
  'border-start-danger':'border-s-qms-danger','border-start-info':'border-s-qms-info','border-start-primary':'border-s-primary','border-start-secondary':'border-s-muted',
  'row':'grid grid-cols-12 gap-4','col-md-6':'col-span-12 min-[768px]:col-span-6','col-md-4':'col-span-12 min-[768px]:col-span-4','g-3':'gap-4',
  'coreui-scope':'font-sans text-foreground','coreui-module':'min-h-full text-foreground',
  'coreui-record-table':tableClasses,'qms-record-table':tableClasses,
  'table-responsive':'overflow-auto overscroll-contain [contain:paint]',
  'monday-scroll':'[scrollbar-width:auto] [scrollbar-color:var(--color-qms-scroll)_transparent] overscroll-contain [contain:paint]',
  'monday-scroll-no-x':'[&::-webkit-scrollbar:horizontal]:hidden',
  'no-print':'print:hidden','informe-content':'print:absolute print:inset-0 print:block print:w-full print:overflow-visible',
  'reporte-cabecera':'break-inside-avoid','reporte-kpi':'break-inside-avoid','reporte-dash':'break-inside-avoid',
  'resumen':'','gestion':'','user':'','qms-page-header':'','qms-error-state':'','modal-detalle':'',
  'btn':'inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-base font-medium focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60',
  'btn-outline-primary':'border-primary bg-surface text-primary hover:bg-primary hover:text-white',
}
function classes(value) {
  return value.split(/\s+/).filter(Boolean).flatMap(c => {
    if (c.startsWith('tw:')) return c
    if (aliases[c] !== undefined) return aliases[c].split(' ').filter(Boolean).map(x=>x.startsWith('tw:')?x:`tw:${x}`)
    // CoreUI spacing utilities were !important and followed Bootstrap's scale.
    const match = c.match(/^(m[trblesxy]?|p[trblesxy]?|gap)-(3|4|5)$/)
    if (match) c = `${match[1]}-${{3:4,4:6,5:12}[match[2]]}`
    if (c === 'text-xs') c = 'text-sm'; else if (c === 'text-sm') c = 'text-base'
    if (c === 'text-qms-dark') c = 'text-foreground'
    if (c === 'text-qms-muted') c = 'text-muted'
    return `tw:${c}`
  }).join(' ')
}

// Convert existing geometry to co-located, editable Tailwind class recipes.
// Only tokens and data-driven numeric geometry remain CSS variables/inline styles.
const replacements = { '--cui-body-bg':'--color-qms-surface','--cui-tertiary-bg':'--color-qms-background','--cui-border-color':'--color-qms-border','--cui-body-color':'--color-qms-foreground','--cui-secondary-color':'--color-qms-muted-foreground','--cui-primary-bg-subtle':'--color-qms-primary-subtle','--cui-primary':'--color-qms-primary','--cui-border-radius':'--radius-qms-control','--cui-font-sans-serif':'--font-qms-inter' }
const properties = { display:{flex:'flex',grid:'grid',block:'block',none:'hidden'}, position:{fixed:'fixed',sticky:'sticky',relative:'relative',absolute:'absolute'}, 'align-items':{center:'items-center',baseline:'items-baseline',start:'items-start','flex-start':'items-start','flex-end':'items-end'}, 'justify-content':{center:'justify-center','space-between':'justify-between','flex-end':'justify-end'}, 'flex-direction':{column:'flex-col',row:'flex-row'}, 'flex-shrink':{'0':'shrink-0'}, 'flex-wrap':{wrap:'flex-wrap',nowrap:'flex-nowrap'}, 'font-weight':{'700':'font-bold','600':'font-semibold','500':'font-medium'}, 'text-align':{center:'text-center',left:'text-left'}, 'text-transform':{uppercase:'uppercase',none:'normal-case'}, 'white-space':{nowrap:'whitespace-nowrap','pre-wrap':'whitespace-pre-wrap'}, 'overflow-y':{auto:'overflow-y-auto'}, overflow:{auto:'overflow-auto',hidden:'overflow-hidden'}, 'overscroll-behavior':{contain:'overscroll-contain'}, 'user-select':{text:'select-text'}, 'cursor':{pointer:'cursor-pointer'}, 'font-style':{italic:'italic'}, 'font-variant-numeric':{'tabular-nums':'tabular-nums'} }
function declaration(d) {
  if (['composes','animation','will-change','-webkit-font-smoothing'].includes(d.prop)) return null
  let val = d.value.replace(/!important/g,'').trim()
  for (const [old, n] of Object.entries(replacements)) val = val.replaceAll(old,n)
  const utility = properties[d.prop]?.[val]
  return utility ?? `[${d.prop}:${val.replaceAll(' ','_')}]`
}
const cssFiles = new Set()
for (const [f, text] of Object.entries(original)) for (const m of text.matchAll(/import styles from ['"]([^'"]+\.module\.css)['"]/g)) cssFiles.add(m[1].startsWith('@/') ? m[1].slice(2) : path.posix.normalize(`${path.posix.dirname(f)}/${m[1]}`))
for (const cssFile of cssFiles) {
  const recipes = {}
  postcss.parse(fs.readFileSync(cssFile,'utf8')).walkRules(rule => {
    if (rule.parent.type === 'atrule' && rule.parent.name === 'keyframes') return
    for (const selector of rule.selector.split(/,\s*(?![^()]*\))/)) {
      const m = selector.trim().match(/^\.([\w]+)(.*)$/)
      if (!m) continue
      const key=m[1]; recipes[key] ??= []
      let rest=m[2].replace(/:global\(([^)]+)\)/g,'$1').trim()
      // Local nested targets are native HTML after migration.
      rest=rest.replace(/\.nav-link/g,'button').replace(/\.nav\b/g,'nav').replace(/\.active/g,'[aria-current="page"]').replace(/\.btn\b/g,'button').replace(/\.badge/g,'[data-slot="badge"]').replace(/\.qms-icon/g,'svg').replace(/\.form-control/g,':is(input,textarea)').replace(/\.form-select/g,'select').replace(/\.form-label/g,'label').replace(/\.coreui-record-table/g,'').replace(/\.modal-content/g,'dialog').replace(/\.modal-body/g,'div').replace(/\.table-responsive/g,'[data-slot="table-scroll"]').replace(/\.table\b/g,'table').replace(/\.text-xs/g,'').replace(/\.folio/g,'button').replace(/\+\s*\.panel/g,'+div')
      let variant = rest ? `[&${rest.startsWith(':') ? '' : '_'}${rest.replaceAll(' ','_').replaceAll('"',"'") }]:` : ''
      if (rule.parent.type === 'atrule' && rule.parent.name === 'media') {
        const max=rule.parent.params.match(/max-width:\s*(\d+)px/)
        if (!max) continue
        variant=`max-[${Number(max[1])+1}px]:${variant}`
      }
      for (const d of rule.nodes.filter(n=>n.type==='decl')) { const u=declaration(d); if(u) recipes[key].push(`tw:${variant}${u}`) }
      if (key==='skeleton') recipes[key].push('tw:animate-pulse')
    }
  })
  fs.writeFileSync(cssFile.replace('.module.css','.styles.ts'), `// Presentation recipes: keep data/hooks in the view; edit only tw: classes here.\nexport default ${JSON.stringify(Object.fromEntries(Object.entries(recipes).map(([k,v])=>[k,[...new Set(v)].join(' ')])),null,2)} as const\n`)
}

const componentMap = {
 CButton:['Button','Button','default'], CCard:['Card','Card'], CCardHeader:['CardHeader','Card'], CCardBody:['CardContent','Card'], CCardFooter:['CardFooter','Card'],
 CFormInput:['Input','Input','default'],CFormLabel:['Label','Label','default'],CFormTextarea:['Textarea','Textarea','default'],CFormSelect:['Select','Select','default'],
 CTable:['DataTable','DataTable'],CTableHead:['TableHead','Table'],CTableHeaderCell:['TableHeaderCell','Table'],CTableDataCell:['TableCell','Table'],CTableRow:['tr'],CTableBody:['tbody'],
 CRow:['GridRow','Grid'],CCol:['GridCol','Grid'],CNav:['Tabs','Tabs'],CNavLink:['Tab','Tabs'],CNavItem:['div'],
 CSpinner:['Spinner','Spinner'],CAlert:['Alert','Alert'],CFormCheck:['Checkbox','Checkbox'],CFormRange:['Range','Range'],CProgress:['Progress','Progress'],
 CListGroup:['AttachmentList','AttachmentList'],CListGroupItem:['AttachmentItem','AttachmentList'],CWidgetStatsF:['MetricCard','MetricCard'],CCardGroup:['div'],
 CAccordion:['div'],CAccordionItem:['details'],CAccordionHeader:['summary'],CAccordionBody:['div'],CInputGroup:['InputGroup','InputGroup'],CInputGroupText:['InputAdornment','InputGroup'],
}
for (const [file, originalText] of Object.entries(original)) {
  if (file.startsWith('components/ui/') && !file.startsWith('components/ui/tailwind/')) continue
  if (file.startsWith('components/ui/tailwind/')) continue
  if (/^app\/(procesos|auditorias|riesgos|revision|documentos)\//.test(file)) continue
  if (['components/Modal.tsx','components/StatCard.tsx','components/dashboard/Chart.tsx','components/dashboard/cuiColors.ts'].includes(file)) continue
  let text=originalText.replace(/import styles from (['"])([^'"]+)\.module\.css\1/g, "import styles from $1$2.styles$1")
  const imports=new Map()
  text=text.replace(/import\s*\{([^}]+)\}\s*from ['"]@coreui\/react['"];?/g,(_,names)=>{
    for(const old of names.split(',').map(s=>s.trim()).filter(Boolean)) {
      const spec=componentMap[old]; if(!spec) throw Error(`Unsupported ${old}`)
      if(spec[1]) imports.set(spec[0],`import ${spec[2]==='default'?spec[0]:`{ ${spec[0]} }`} from '@/components/ui/tailwind/${spec[1]}'`)
    }
    return ''
  })
  for(const [old,spec] of Object.entries(componentMap)) text=text.replace(new RegExp(`\\b${old}\\b`,'g'),spec[0])
  text=text.replace(/\s*import CIcon from ['"]@coreui\/icons-react['"]/g,'').replace(/\s*import \{[^}]+\} from ['"]@coreui\/icons['"]/g,'')
  if(text.includes('<CIcon')) {
    imports.set('icons', "import { Search, Eye, RefreshCw } from 'lucide-react'")
    text=text.replace(/<CIcon\s+icon=\{(cilSearch|cilLowVision|cilReload)\}/g, (_,icon)=>`<${{cilSearch:'Search',cilLowVision:'Eye',cilReload:'RefreshCw'}[icon]}`)
  }
  text=text.replace(/import \{ CChart \} from ['"]@coreui\/react-chartjs['"]/,"import Chart from '@/components/dashboard/Chart'").replace(/\bCChart\b/g,'Chart')
  // Point all migrated callers directly at the canonical kit; no duplicate adapters.
  text=text.replace(/(@\/components\/ui\/)(Button|Select|Badge|Switch|Table|EmptyState|ErrorState|PageHeader|Pagination)(['"])/g,'$1tailwind/$2$3')
  text=text.replace(/(['"])@\/components\/Modal\1/g,"'@/components/ui/tailwind/Modal'")
  // Visual variants: keep events and other DOM attributes byte-for-byte.
  text=text.replace(/<Button\b([^>]*?)>/gs,(whole,attrs)=> {
    const c=attrs.match(/\scolor="([\w]+)"/),v=attrs.match(/\svariant="([\w]+)"/)
    if(!c && (!v || ['primary','secondary','danger','ghost'].includes(v[1]))) return whole
    const variant=v?.[1]==='ghost'?'ghost':v?.[1]==='outline'?'secondary':c?.[1]==='danger'?'danger':c?.[1]==='secondary'?'secondary':'primary'
    attrs=attrs.replace(/\scolor="[\w]+"/g,'').replace(/\svariant="[\w]+"/g,'')
    return `<Button variant="${variant}"${attrs}>`
  })
  text=text.replace(/<tr\b([^>]*?)\sitemKey="[^"]*"/g,'<tr$1').replace(/<details\b([^>]*?)\sitemKey="[^"]*"/g,'<details$1')
  if(imports.size) { const pos=text.indexOf('\n'); text=text.slice(0,pos+1)+[...imports.values()].join('\n')+'\n'+text.slice(pos+1) }
  // Rewrite only class expressions; template spans and event handlers stay intact.
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[]
  function literal(node) {
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)) { const start=node.getStart(source); edits.push([start+1,node.end-1,classes(node.text)]) }
    else if([ts.SyntaxKind.TemplateHead,ts.SyntaxKind.TemplateMiddle,ts.SyntaxKind.TemplateTail].includes(node.kind)) {
      const start=node.getStart(source),end=node.end,head=node.kind===ts.SyntaxKind.TemplateHead,tail=node.kind===ts.SyntaxKind.TemplateTail
      const raw=text.slice(start+1,end-(tail?1:2)); const leading=/^\s/.test(raw)?' ':'',trailing=/\s$/.test(raw)?' ':''
      edits.push([start+1,end-(tail?1:2),leading+classes(node.text)+trailing]); void head
    } else ts.forEachChild(node,literal)
  }
  function walk(node) {
    if(ts.isJsxAttribute(node)&&['className','classNames','bodyClassName','contentClassName'].includes(node.name.text)) literal(node.initializer)
    else ts.forEachChild(node,walk)
  }
  walk(source)
  for(const [start,end,value] of edits.sort((a,b)=>b[0]-a[0])) text=text.slice(0,start)+value+text.slice(end)
  // Style maps used outside className expressions.
  text=text.replace(/'border-start-(success|warning|danger|info|primary|secondary)'/g,(_,c)=>`'${classes(`border-start-${c}`)}'`)
  if(text!==originalText) fs.writeFileSync(file,text)
}
console.log(`Processed ${files.length} files; snapshot retained; ${cssFiles.size} style recipes created.`)
