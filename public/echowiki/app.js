let docs=[];
const titles={overview:'知识库首页',library:'示例文档',templates:'模板工坊',reader:'阅读文档'};
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n;};
function route(){
  const hash=location.hash.slice(1)||'overview';
  if(hash==='onboarding'){location.replace('onboarding/');return;}
  const key=hash.startsWith('doc/')?'reader':titles[hash]?hash:'overview';
  document.querySelectorAll('.view').forEach(n=>n.hidden=n.id!==key);
  document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===key));
  document.getElementById('breadcrumb').textContent=titles[key];
  if(key==='reader'){
    const doc=docs.find(p=>p.id===hash.slice(4));
    document.getElementById('reader-title').textContent=doc?.name||'没有找到这篇示例';
    document.getElementById('reader-body').textContent=doc?.body||'请返回文档列表选择。';
    document.getElementById('copy-state').textContent='';
    document.getElementById('copy-text').hidden=!doc;
    document.getElementById('copy-text').onclick=async()=>{try{await navigator.clipboard.writeText(doc.body);document.getElementById('copy-state').textContent='已复制，可以粘贴到你的编辑器。';}catch{document.getElementById('copy-state').textContent='浏览器未允许复制，请选中文本手动复制。';}};
  }
  window.scrollTo(0,0);
}
function library(q=''){
  const list=document.getElementById('library-list');list.replaceChildren();
  docs.filter(p=>(p.name+p.description+p.category+p.body).includes(q)).forEach(p=>{const card=el('article','library-card');const a=el('a','', '阅读示例 →');a.href='#doc/'+p.id;card.append(el('span','small-badge',p.category),el('h3','',p.name),el('p','',p.description),a);list.append(card);});
  if(!list.children.length)list.append(el('p','muted','没有匹配的示例文档。'));
}
function render(){
  const spaces=document.getElementById('spaces');spaces.replaceChildren();
  [['新人入门','从认识团队开始，独立维护的入门知识库。','onboarding/','◈'],['团队文档模板','需求、技术、会议、复盘、玩法和 Bug。','#templates','▦']].forEach(([name,description,url,icon])=>{const a=el('a','space-card');a.href=url;a.append(el('div','space-icon mint',icon),el('h3','',name),el('p','',description),el('span','space-meta',name==='新人入门'?'4 篇入门示例 →':'6 个记录模板 →'));spaces.append(a);});
  const recent=document.getElementById('recent');recent.replaceChildren();docs.slice(0,3).forEach(p=>{const a=el('a','doc-row');a.href='#doc/'+p.id;a.append(el('span','doc-glyph','DOC'),el('b','',p.name),el('span','','→'));recent.append(a);});
  const templates=document.getElementById('template-list');templates.replaceChildren();docs.filter(p=>p.category==='团队文档模板').forEach(p=>{const card=el('article','template-card');const a=el('a','btn primary','查看并复制模板 →');a.href='#doc/'+p.id;card.append(el('span','small-badge','TEAM TEMPLATE'),el('h3','',p.name),el('p','',p.description),a);templates.append(card);});
  library();route();
}
window.addEventListener('hashchange',route);
document.getElementById('search').oninput=e=>library(e.target.value.trim());
function search(q){document.getElementById('search').value=q;library(q);location.hash='library';}
document.getElementById('global-search').onsubmit=e=>{e.preventDefault();search(e.currentTarget.querySelector('input').value.trim());};
document.querySelectorAll('[data-search]').forEach(b=>b.onclick=()=>search(b.dataset.search));
route();
fetch('examples.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{docs=data;render();}).catch(()=>{document.getElementById('spaces').textContent='示例目录暂时无法读取，请刷新重试。';});
