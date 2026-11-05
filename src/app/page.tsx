import { query } from "@/lib/db";
const cards = [["Browse items","Browse, filter, and edit archived files.","/items"],["Import files","Add a file from disk or upload it.","/import"],["Search archive","Search titles and extracted text.","/search"],["Organize","Manage collections and tags.","/collections"],["Activity","Review recent access and searches.","/activity"],["Reports","View archive statistics and reports.","/reports"]];
export const dynamic = "force-dynamic";
export default async function Home() {
  let totals={items:0,collections:0,tags:0};
  try { const r=await query<{items:string;collections:string;tags:string}>("SELECT (SELECT count(*) FROM item) items,(SELECT count(*) FROM collection) collections,(SELECT count(*) FROM tag) tags"); totals={items:Number(r.rows[0].items),collections:Number(r.rows[0].collections),tags:Number(r.rows[0].tags)}; } catch {}
  return <><p className="muted">YOUR PRIVATE, LOCAL ARCHIVE</p><h1>Everything you keep, in one place.</h1><p>Files stay on your device. Search extracted text and organize items into collections.</p><div className="grid" style={{marginTop:24}}>{Object.entries(totals).map(([k,v])=><section className="panel" key={k}><span className="muted">{k}</span><h2>{v}</h2></section>)}</div><div className="grid">{cards.map(([title,detail,href])=><a className="card" href={href} key={href}><h2>{title}</h2><p>{detail}</p></a>)}</div></>;
}
