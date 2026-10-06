import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const files = []
function scan(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const file=path.join(dir,entry.name)
    if(entry.isDirectory())scan(file)
    else if(/\.(tsx?|jsx?)$/.test(file))files.push(file)
  }
}
for(const dir of ['app','components','lib','hooks'])scan(dir)
const adapters=Object.fromEntries(fs.readdirSync('components/ui').filter(file=>file.endsWith('.tsx')).map(file=>[path.resolve('components/ui',file),[]]))
for(const file of files){
  const text=fs.readFileSync(file,'utf8')
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  function walk(node){
    if(ts.isStringLiteral(node)&& (ts.isImportDeclaration(node.parent)||ts.isCallExpression(node.parent))){
      const spec=node.text
      const base=spec.startsWith('@/')?path.resolve(root,spec.slice(2)):spec.startsWith('.')?path.resolve(path.dirname(file),spec):null
      const target=base&&[base,base+'.tsx',base+'.ts',base+'.jsx'].find(candidate=>adapters[candidate])
      if(target)adapters[target].push(file.replaceAll('\\','/'))
    }
    ts.forEachChild(node,walk)
  }
  walk(source)
}
const report=Object.entries(adapters).map(([file,consumers])=>({file:file.replaceAll('\\','/'),consumers}))
fs.writeFileSync('.performance/legacy-ui-consumers.json',JSON.stringify(report,null,2))
console.log(JSON.stringify(report.map(item=>({file:path.basename(item.file),consumers:item.consumers.length})),null,2))
