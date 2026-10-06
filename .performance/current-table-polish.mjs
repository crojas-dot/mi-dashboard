import fs from 'node:fs'
import ts from 'typescript'
const files=[]
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=`${dir}/${e.name}`;if(e.isDirectory())scan(f);else if(f.endsWith('.tsx'))files.push(f)}}scan('app');scan('components')
for(const file of files) {
 if(file.includes('/tailwind/')||file.includes('/dashboard/'))continue
 let text=fs.readFileSync(file,'utf8')
 text=text.replaceAll('bg-qms-header','bg-qms-table-head')
 const src=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[]
 function walk(n){
  if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)) {
   const tag=n.tagName.getText(src),c=n.attributes.properties.find(p=>p.name?.text==='className')
   if(c&&ts.isStringLiteral(c.initializer)&&['th','td','table'].includes(tag)) {
    const cls=c.initializer.text.replace(/\bpx-3\b/g,'px-4').replace(/\bpy-2(?:\.5)?\b/g,'py-3.5').replace(/\btext-sm\b/g,'text-base')
    const value=tag==='th'?cls.replace(/\btext-white\b/g,'text-qms-dark'):cls
    if(value!==c.initializer.text)edits.push([c.initializer.getStart(src)+1,c.initializer.end-1,value])
   }
  }
  ts.forEachChild(n,walk)
 }
 walk(src)
 for(const[a,b,v]of edits.sort((a,b)=>b[0]-a[0]))text=text.slice(0,a)+v+text.slice(b)
 fs.writeFileSync(file,text)
}
const css='app/globals.css'
fs.writeFileSync(css,fs.readFileSync(css,'utf8').replace('--color-qms-header: #eef1f6;','--color-qms-header: #343a40;\n  --color-qms-table-head: #eef1f6;'))
