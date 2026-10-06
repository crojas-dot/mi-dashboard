import fs from 'node:fs'
import ts from 'typescript'
const before=JSON.parse(fs.readFileSync('.performance/tailwind-final-before.json','utf8'))
fs.writeFileSync('components/ui/icons.tsx', `// Stable application icon names, backed only by Lucide. No UI/CSS dependency here.
export { Activity, ArrowLeft, Bell, BellRing, BellOff, BookOpen, Bolt, Brain,
  Check, CheckCircle, ChevronLeft, ChevronRight, ClipboardCheck, FileCheck2,
  ClipboardList, Clock, Copy, Download, Pencil as Edit, Pencil, ExternalLink,
  Eye, EyeOff, FileQuestionMark as FileQuestion, FileText, GitBranch, History,
  Inbox, Info, Key, KeyRound, Lock, Link, ListChecks, RefreshCw, RotateCcw,
  LogOut, Maximize, Minimize, Layers, MessageSquareWarning, MoreVertical,
  Play, Plus, Printer, Save, Search, SearchCheck, Send, Settings, ShieldAlert,
  ShieldCheck, Sparkles, Gauge as Speedometer, Tag, Target, Trash2, Upload,
  UserCheck, UserX, Users, Wifi, X, XCircle, LoaderCircle as Loader2 } from 'lucide-react'
`)
for(const [f,old] of Object.entries(before)) {
  if(!fs.existsSync(f)) continue
  let text=fs.readFileSync(f,'utf8')
  const parse=t=>ts.createSourceFile(f,t,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const comparisons=new Map()
  function collect(n,src,save,edits) {
    if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(n.operatorToken.kind)&&ts.isStringLiteral(n.right)) {
      const key=n.left.getText(src)+n.operatorToken.getText(src)
      if(save) comparisons.set(key,(comparisons.get(key)??[]).concat(n.right.text))
      else { const list=comparisons.get(key);if(list?.length){const val=list.shift(); if(val!==n.right.text)edits.push([n.right.getStart(src),n.right.end,JSON.stringify(val)])} }
    }
    ts.forEachChild(n,c=>collect(c,src,save,edits))
  }
  const orig=parse(old),cur=parse(text),edits=[]
  function classAttrs(n,src,save) { if(ts.isJsxAttribute(n)&&['className','bodyClassName','contentClassName'].includes(n.name.text)) collect(n,src,save,edits);else ts.forEachChild(n,c=>classAttrs(c,src,save)) }
  classAttrs(orig,orig,true);classAttrs(cur,cur,false)
  for(const [a,b,v] of edits.sort((a,b)=>b[0]-a[0]))text=text.slice(0,a)+v+text.slice(b)
  const seen=new Set()
  text=text.replace(/^import [^\n]+ from ['"]@\/components\/ui\/tailwind\/[^'"\n]+['"]\r?$/gm,line=>{if(seen.has(line))return '';seen.add(line);return line})
  text=text.replace(/variant=\{([^}\n]+)\}/g,(m,expr)=>m.includes("'outline'")?`variant={${expr.replaceAll("'outline'","'secondary'")}}`:m)
  if(text!==fs.readFileSync(f,'utf8')) fs.writeFileSync(f,text)
}
const obsolete=['components/Modal.tsx','components/Modal.module.css','components/LegacyViewBoundary.tsx',...['Button','Select','Badge','Switch','Table','EmptyState','ErrorState','PageHeader','Pagination'].map(n=>`components/ui/${n}.tsx`)]
for(const [f,text] of Object.entries(before))for(const m of text.matchAll(/import styles from ['"]([^'"]+\.module\.css)['"]/g)) {
 if(m[1].startsWith('@/')) obsolete.push(m[1].slice(2)); else obsolete.push(f.slice(0,f.lastIndexOf('/')+1)+m[1].replace(/^\.\//,''))
}
for(const f of new Set(obsolete)) if(fs.existsSync(f))fs.unlinkSync(f)
let auth=fs.readFileSync('components/AuthShell.tsx','utf8').replace(/^import LegacyViewBoundary[^\n]+\r?\n/m,'').replace('<LegacyViewBoundary>{children}</LegacyViewBoundary>','{children}')
fs.writeFileSync('components/AuthShell.tsx',auth)
for(const f of fs.readdirSync('tests').filter(f=>f.endsWith('.mjs'))) {
 const p=`tests/${f}`,text=fs.readFileSync(p,'utf8')
 fs.writeFileSync(p,text.replace(/components\/ui\/(Button|Select|Badge|Switch|Table|EmptyState|ErrorState|PageHeader|Pagination)\.tsx/g,'components/ui/tailwind/$1.tsx'))
}
console.log('Removed obsolete adapters/CSS modules; restored selection predicates.')
