import fs from 'node:fs'
import postcss from 'postcss'
const file='C:/Users/Soporte/Downloads/Inicio - ANE (5_10_2026 22：25：14).html'
const html=fs.readFileSync(file,'utf8'),styles=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1].replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&'))
const colors=new Map(),fonts=new Map(),rules=[]
for(const css of styles){let parsed;try{parsed=postcss.parse(css)}catch{continue}parsed.walkRules(rule=>{
 const vals=[]
 for(const d of rule.nodes.filter(n=>n.type==='decl')){
  if(d.value.includes('data:'))continue
  if(d.prop==='font-family')fonts.set(d.value,(fonts.get(d.value)??0)+1)
  if(/color|background/.test(d.prop))for(const c of d.value.matchAll(/#[\da-f]{3,8}\b/gi))colors.set(c[0],(colors.get(c[0])??0)+1)
  if(/^(font-family|font-size|font-weight|line-height|color|background-color|border-radius|padding|height)$/.test(d.prop))vals.push(`${d.prop}:${d.value}`)
 }
 if(vals.length&&/body|\.btn|header|navbar|h1|h2|h3|\.card|:root|\.text-primary/i.test(rule.selector)&&!rule.selector.includes('svg'))rules.push({selector:rule.selector.slice(0,140),values:vals.join('; ').slice(0,400)})
})}
const result={colors:[...colors].sort((a,b)=>b[1]-a[1]).slice(0,35),fonts:[...fonts].sort((a,b)=>b[1]-a[1]).slice(0,12),rules:rules.slice(-75)}
fs.writeFileSync('.performance/ane-reference-style-audit.json',JSON.stringify(result,null,2))
console.log(JSON.stringify(result,null,2))
