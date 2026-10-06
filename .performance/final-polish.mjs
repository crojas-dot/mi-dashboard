import fs from 'node:fs'
import ts from 'typescript'
const snapshot=JSON.parse(fs.readFileSync('.performance/tailwind-final-before.json','utf8'))
for(const f of fs.readdirSync('tests').filter(f=>f.endsWith('.test.mjs'))) {
 const p=`tests/${f}`
 let text=fs.readFileSync(p,'utf8').replaceAll('@/components/Modal', '@/components/ui/tailwind/Modal').replace(/(@\/components\/ui\/)(Button|Select|Badge|Switch|Table|EmptyState|ErrorState|PageHeader|Pagination)(['"])/g,'$1tailwind/$2$3')
 // Presentation primitives must be mocked separately from the business hooks.
 if(['entity-request-guard.test.mjs','usuarios-reliability.test.mjs'].includes(f)) text=text.replace("    '@coreui/react': new Proxy({}, { get: (_target, key) => key }),", "    '@/components/ui/tailwind/Tabs': { Tabs: 'Tabs', Tab: 'Tab' },").replace("    '@coreui/react': new Proxy({}, { get: (_, key) => key }),", "    '@/components/ui/tailwind/Tabs': { Tabs: 'Tabs', Tab: 'Tab' },")
 fs.writeFileSync(p,text)
}
// The documents error boundary was deliberately outside the previous ten-file batch.
const err='app/documentos/error.tsx'
fs.writeFileSync(err,fs.readFileSync(err,'utf8').replace('min-h-[60vh] flex items-center justify-center p-4','tw:min-h-[60vh] tw:flex tw:items-center tw:justify-center tw:p-4').replace('w-full max-w-lg','tw:w-full tw:max-w-lg'))
// Add linked ids only to static sibling labels/controls; existing ids remain untouched.
for(const file of Object.keys(snapshot)) {
 if(!fs.existsSync(file)||file.startsWith('components/ui/'))continue
 let text=fs.readFileSync(file,'utf8'),n=0
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[]
 function attrs(node){return (ts.isJsxElement(node)?node.openingElement:node).attributes.properties}
 function tag(node){return (ts.isJsxElement(node)?node.openingElement:node).tagName.getText(source)}
 function walk(node,inLoop=false) {
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='map')inLoop=true
  if(ts.isJsxElement(node)&&!inLoop){
    const children=node.children.filter(c=>ts.isJsxElement(c)||ts.isJsxSelfClosingElement(c))
    const label=children.find(c=>tag(c)==='Label'),input=children.find(c=>['Input','Textarea','Select','Range'].includes(tag(c)))
    if(label&&input&&!attrs(label).some(a=>a.name?.text==='htmlFor')) {
      const existing=attrs(input).find(a=>a.name?.text==='id')
      const id=existing?.initializer?.getText(source)??JSON.stringify(`${file.replace(/\.tsx$/,'').replaceAll('/','-')}-field-${++n}`)
      edits.push([label.openingElement.tagName.end,label.openingElement.tagName.end,` htmlFor=${id}`])
      if(!existing){const element=ts.isJsxElement(input)?input.openingElement:input;edits.push([element.tagName.end,element.tagName.end,` id=${id}`])}
    }
  }
  ts.forEachChild(node,c=>walk(c,inLoop))
 }
 walk(source)
 for(const[a,b,v]of edits.sort((a,b)=>b[0]-a[0]))text=text.slice(0,a)+v+text.slice(b)
 if(text!==fs.readFileSync(file,'utf8'))fs.writeFileSync(file,text)
}
// Replace mechanical arbitrary properties with readable standard utilities when exact.
const files=[]
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=`${dir}/${e.name}`;if(e.isDirectory())scan(f);else if(f.endsWith('.styles.ts'))files.push(f)}}scan('app');scan('components')
const axes={padding:'p','padding-top':'pt','padding-bottom':'pb','padding-inline':'px','padding-left':'pl','padding-right':'pr',margin:'m','margin-top':'mt','margin-bottom':'mb','margin-inline':'mx','gap':'gap',width:'w',height:'h','min-width':'min-w','min-height':'min-h','top':'top','left':'left','right':'right',inset:'inset','border-radius':'rounded'}
const values={0:'0','0px':'0','4px':'1','6px':'1.5','8px':'2','12px':'3','14px':'3.5','16px':'4','18px':'4.5','20px':'5','24px':'6','28px':'7','32px':'8','40px':'10','44px':'11'}
const colors={'var(--color-qms-background)':'background','var(--color-qms-surface)':'surface','var(--color-qms-border)':'border','var(--color-qms-primary)':'primary','var(--color-qms-muted-foreground)':'muted','var(--color-qms-foreground)':'foreground','#ffffff':'white'}
for(const f of files) {
 let text=fs.readFileSync(f,'utf8').replaceAll('tw:[--cui-secondary-color:#4b5563]','tw:[--color-qms-muted-foreground:#4b5563]')
 text=text.replace(/\[([\w-]+):([^\[\]]+)\]/g,(m,p,v)=> {
  if(axes[p]&&values[v]&&p!=='border-radius')return `${axes[p]}-${values[v]}`
  if(['width','height','min-width','min-height'].includes(p)&&v==='100%')return `${axes[p]}-full`
  if(p==='margin-inline'&&v==='auto')return 'mx-auto'
  if(p==='font-size'&&['14px','16px','18px','20px'].includes(v))return `text-${{'14px':'sm','16px':'base','18px':'lg','20px':'xl'}[v]}`
  if(p==='color'&&colors[v])return `text-${colors[v]}`
  if(['background','background-color'].includes(p)&&colors[v])return `bg-${colors[v]}`
  if(p==='border-radius'&&v==='8px')return 'rounded-lg'
  if(p==='border-radius'&&v==='6px')return 'rounded-md'
  if(p==='pointer-events'&&v==='none')return 'pointer-events-none'
  if(p==='text-decoration'&&v==='underline')return 'underline'
  if(p==='text-decoration'&&v==='none')return 'no-underline'
  if(p==='flex'&&v==='1')return 'flex-1'
  if(p==='text-overflow'&&v==='ellipsis')return 'text-ellipsis'
  return m
 })
 fs.writeFileSync(f,text)
}
