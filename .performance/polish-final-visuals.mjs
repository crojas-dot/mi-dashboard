import fs from 'node:fs'
import ts from 'typescript'
const before=JSON.parse(fs.readFileSync('.performance/tailwind-final-before.json','utf8'))
for(const [file,old]of Object.entries(before)) {
 if(!fs.existsSync(file)||file.startsWith('components/ui/'))continue
 let text=fs.readFileSync(file,'utf8'),edits=[]
 const parse=t=>ts.createSourceFile(file,t,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 const src=parse(text),orig=parse(old)
 const opening=n=>ts.isJsxElement(n)?n.openingElement:n
 const tag=n=>opening(n).tagName.getText(src)
 const attr=(n,key)=>opening(n).attributes.properties.find(p=>p.name?.text===key)
 let next=0
 function fields(node,inLoop=false) {
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='map')inLoop=true
  if(ts.isJsxElement(node)&&!inLoop) {
   const directLabels=node.children.filter(c=>ts.isJsxElement(c)&&tag(c)==='Label')
   if(directLabels.length===1&&!attr(directLabels[0],'htmlFor')) {
    const label=directLabels[0],controls=[]
    function find(c){if(c===label)return;if(ts.isJsxElement(c)||ts.isJsxSelfClosingElement(c)){if(['Input','Select','Textarea','Range'].includes(tag(c))){controls.push(c);return}if(tag(c)==='Label')return}ts.forEachChild(c,find)}
    node.children.forEach(find)
    if(controls.length>0&&controls.length<=2) {
     const id=attr(controls[0],'id')?.initializer?.getText(src)??JSON.stringify(`${file.replace(/\.tsx$/,'').replaceAll('/','-')}-linked-${++next}`)
     edits.push([label.openingElement.tagName.end,label.openingElement.tagName.end,` htmlFor=${id}`])
     for(const input of controls)if(!attr(input,'id'))edits.push([opening(input).tagName.end,opening(input).tagName.end,` id=${id}`])
    }
   }
  }
  ts.forEachChild(node,c=>fields(c,inLoop))
 }
 fields(src)
 // Preserve the original visual button intent using our kit's public variants.
 const buttons=s=>{const a=[];function walk(n){if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&['CButton','Button'].includes(n.tagName.getText(s)))a.push(n);ts.forEachChild(n,walk)}walk(s);return a}
 const oldButtons=buttons(orig),currentButtons=buttons(src)
 if(oldButtons.length===currentButtons.length)oldButtons.forEach((oldButton,i)=>{
  const get=name=>oldButton.attributes.properties.find(p=>p.name?.text===name)?.initializer
  const variant=get('variant'),color=get('color')
  if(!variant||!ts.isStringLiteral(variant)||!color||!ts.isStringLiteral(color))return
  let extra=''
  if(variant.text==='outline'&&color.text==='primary')extra='tw:border-primary tw:text-primary tw:enabled:hover:bg-primary tw:enabled:hover:text-white'
  if(variant.text==='outline'&&color.text==='danger')extra='tw:border-danger tw:text-danger tw:enabled:hover:bg-danger tw:enabled:hover:text-white'
  if(variant.text==='ghost'&&color.text==='danger')extra='tw:text-danger tw:enabled:hover:bg-red-50 tw:enabled:hover:text-danger'
  if(variant.text==='ghost'&&color.text==='primary')extra='tw:text-primary tw:enabled:hover:bg-primary-subtle tw:enabled:hover:text-primary'
  if(!extra)return
  const button=currentButtons[i],c=button.attributes.properties.find(p=>p.name?.text==='className')
  if(!c)edits.push([button.tagName.end,button.tagName.end,` className=${JSON.stringify(extra)}`])
  else if(ts.isStringLiteral(c.initializer))edits.push([c.initializer.getStart(src),c.initializer.end,JSON.stringify(c.initializer.text+' '+extra)])
  else if(ts.isJsxExpression(c.initializer))edits.push([c.initializer.getStart(src),c.initializer.end,'{`'+ '${'+c.initializer.expression.getText(src)+'} '+extra+'`}'])
 })
 for(const[a,b,v]of edits.sort((a,b)=>b[0]-a[0]))text=text.slice(0,a)+v+text.slice(b)
 if(text!==fs.readFileSync(file,'utf8'))fs.writeFileSync(file,text)
}
const config='app/configuracion/configuracion.styles.ts'
fs.writeFileSync(config,fs.readFileSync(config,'utf8').replace('"sectionHeader": "tw:flex ','"sectionHeader": "tw:flex tw:justify-start tw:flex-nowrap '))
const detail='app/quejas/components/QuejaDetalleModal.styles.ts'
let styles=fs.readFileSync(detail,'utf8')
styles=styles.replace(/"modalText": "[^"]+"/, '"modalText": "tw:font-sans tw:text-foreground tw:[text-rendering:optimizeLegibility] tw:[--color-qms-muted-foreground:#4b5563]"')
fs.writeFileSync(detail,styles)
const general='components/dashboard/GeneralTab.tsx'
fs.writeFileSync(general,fs.readFileSync(general,'utf8').replace('<CardFooter>','<CardFooter className="tw:block">'))
// Move the one-time codemod out of maintained scripts: it must never run again.
if(fs.existsSync('scripts/complete-tailwind-migration.mjs'))fs.renameSync('scripts/complete-tailwind-migration.mjs','.performance/complete-tailwind-migration.mjs')
