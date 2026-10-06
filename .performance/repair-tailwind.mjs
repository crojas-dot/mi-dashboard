import fs from 'node:fs'
import ts from 'typescript'
const before=JSON.parse(fs.readFileSync('.performance/tailwind-final-before.json','utf8'))
for(const f of Object.keys(before)) {
 if(!fs.existsSync(f)||f.startsWith('components/ui/tailwind/'))continue
 let text=fs.readFileSync(f,'utf8')
 const source=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),names=new Set(),edits=[]
 for(const n of source.statements) if(ts.isImportDeclaration(n)&&n.moduleSpecifier.text.includes('/ui/tailwind/')) {
   const name=n.importClause?.name?.text
   if(name&&names.has(name))edits.push([n.getStart(source),n.end,'']);else if(name)names.add(name)
 }
 for(const [a,b,v]of edits.sort((a,b)=>b[0]-a[0]))text=text.slice(0,a)+v+text.slice(b)
 text=text.replaceAll("? 'primary' : 'outline'", "? 'primary' : 'secondary'")
 text=text.replace(/(@\/components\/ui\/)(Button|Select|Badge|Switch|Table|EmptyState|ErrorState|PageHeader|Pagination)(['"])/g,'$1tailwind/$2$3')
 fs.writeFileSync(f,text)
}
