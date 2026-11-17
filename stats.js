/* Leaderboard-Berechnungen, gemeinsam genutzt von index.html, tv.html und admin.html */
(function(){
const API="https://script.google.com/macros/s/AKfycbzHu9OrC208V3B74OLSMjs4xAChZDG37u3_v7FbdHJULaMXV7_i9RhBlG3q_L-_d2weXw/exec";
const DAY_START=6*60, MARATHON_START=8*60;

function toMin(t){const m=/^(\d{1,2}):(\d{2})/.exec(String(t||"").trim());if(!m)return NaN;let v=+m[1]*60+ +m[2];if(v<DAY_START)v+=1440;return v;}
function nowMin(){const d=new Date();let v=d.getHours()*60+d.getMinutes()+d.getSeconds()/60;if(v<DAY_START)v+=1440;return v;}
function fmtClock(v){v=((Math.floor(v)%1440)+1440)%1440;return String(Math.floor(v/60)).padStart(2,"0")+":"+String(v%60).padStart(2,"0");}
function fmtDur(min){min=Math.max(0,Math.round(min));const h=Math.floor(min/60),m=min%60;return h?`${h} h ${String(m).padStart(2,"0")} min`:`${m} min`;}
function fmtDurShort(min){min=Math.max(0,Math.round(min));const h=Math.floor(min/60),m=min%60;return h+":"+String(m).padStart(2,"0");}
const norm=s=>String(s||"").trim().toLowerCase();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function api(fn,args){
  return fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({fn:fn,args:args})})
    .then(r=>r.json()).then(r=>{if(r&&r.error)throw new Error(r.error);return r;});
}
function loadState(code){return fetch(API+"?api=state&code="+encodeURIComponent(code||"")).then(r=>r.json());}

/* Hauptberechnung */
function compute(S){
  const now=nowMin(), host=S.host||"Tim";
  const plays=(S.plays||[]).map(p=>{
    const s=toMin(p.start), e=p.end?toMin(p.end):NaN, done=!!p.end&&!isNaN(e);
    let end=done?e:now; if(done&&e<s) end=e+1440;
    const plan=(S.games||[]).find(g=>g.name===p.game);
    return {...p,s,e:done?end:NaN,done,dur:Math.max(0,(done?end:now)-s),plan};
  }).filter(p=>!isNaN(p.s)).sort((a,b)=>a.s-b.s);

  const P={}; // Personen
  const person=n=>{const k=norm(n);return P[k]=P[k]||{key:k,name:n.trim(),plays:0,time:0,points:0,quotes:[],gold:0,silver:0,bronze:0,seconds:0,wins:0,beatTim:0,history:[]};};

  for(const p of plays){
    for(const pl of p.players){const x=person(pl.name);x.time+=p.dur;}
    if(!p.done)continue;
    const n=p.players.length;
    if(p.team){
      const W=p.players.filter(x=>x.win),L=p.players.filter(x=>!x.win);
      for(const pl of p.players){const x=person(pl.name);x.plays++;
        if(pl.win){x.points+=L.length;x.quotes.push(1);x.gold++;x.wins++;}else{x.quotes.push(0);}
        x.history.push({t:p.e,win:pl.win});}
      const timL=L.some(x=>norm(x.name)===norm(host));
      if(timL)W.forEach(w=>person(w.name).beatTim++);
    }else{
      const tim=p.players.find(x=>norm(x.name)===norm(host));
      for(const pl of p.players){const x=person(pl.name);x.plays++;
        const place=pl.place||n;
        x.points+=n-place;
        if(n>1)x.quotes.push((n-place)/(n-1));
        if(place===1){x.gold++;x.wins++;}else if(place===2){x.silver++;x.seconds++;}else if(place===3)x.bronze++;
        if(tim&&norm(pl.name)!==norm(host)&&place<(tim.place||n))x.beatTim++;
        x.history.push({t:p.e,win:place===1});}
    }
  }
  const people=Object.values(P);
  people.forEach(x=>{
    x.quote=x.quotes.length?x.quotes.reduce((a,b)=>a+b,0)/x.quotes.length:null;
    let best=0,cur=0;x.history.sort((a,b)=>a.t-b.t).forEach(h=>{cur=h.win?cur+1:0;best=Math.max(best,cur);});x.streak=best;
  });

  const byPoints=people.filter(x=>x.plays).sort((a,b)=>b.points-a.points||b.wins-a.wins||a.name.localeCompare(b.name));
  const byQuote=people.filter(x=>x.plays>=2&&x.quote!=null).sort((a,b)=>b.quote-a.quote||b.plays-a.plays);
  const medals=people.filter(x=>x.gold+x.silver+x.bronze).sort((a,b)=>b.gold-a.gold||b.silver-a.silver||b.bronze-a.bronze||a.name.localeCompare(b.name));
  const top=(arr,f,min)=>{const s=arr.filter(x=>f(x)>=(min||1)).sort((a,b)=>f(b)-f(a));return s.length?s[0]:null;};
  const guests=people.filter(x=>norm(x.name)!==norm(host));

  const awards=[{icon:"🍲",title:"Catering-Award",who:"Marlene",val:"für die beste Verpflegung des Tages"}];
  if(byPoints[0])awards.push({icon:"🏆",title:"Marathon-Champion",who:byPoints[0].name,val:byPoints[0].points+" Punkte"});
  if(byQuote[0])awards.push({icon:"🎯",title:"Spielkönig",who:byQuote[0].name,val:Math.round(byQuote[0].quote*100)+" % Leistungsquote"});
  const sitz=top(guests,x=>x.time,1);if(sitz)awards.push({icon:"🪑",title:"Sitzfleisch",who:sitz.name,val:fmtDur(sitz.time)+" gespielt"});
  const serie=top(people,x=>x.streak,2);if(serie)awards.push({icon:"🔥",title:"Seriensieger",who:serie.name,val:serie.streak+" Siege in Folge"});
  const zweiter=top(people,x=>x.seconds,2);if(zweiter)awards.push({icon:"🥈",title:"Ewiger Zweiter",who:zweiter.name,val:zweiter.seconds+"× Platz 2"});
  const feind=top(guests,x=>x.beatTim,1);if(feind)awards.push({icon:"😈",title:"Tims Erzfeind",who:feind.name,val:feind.beatTim+"× vor Tim gelandet"});

  // Tims Marathon
  const timP=P[norm(host)];
  const planned=plays.filter(p=>p.plan&&!p.spontan);
  const lastStarted=planned.length?planned[planned.length-1]:null;
  const delay=lastStarted?Math.round(lastStarted.s-toMin(lastStarted.plan.start)):null;
  const games=(S.games||[]);
  const lastEnd=games.length?Math.max(...games.map(g=>g.e)):MARATHON_START+18*60;
  const progress=Math.max(0,Math.min(100,Math.round((now-MARATHON_START)/(lastEnd-MARATHON_START)*100)));
  const tim={time:timP?timP.time:0,plays:timP?timP.plays:0,wins:timP?timP.wins:0,quote:timP&&timP.plays?timP.wins/timP.plays:null,delay,progress};

  // Statistiken
  const stats=[];
  const totalTime=people.reduce((a,x)=>a+x.time,0);
  stats.push({icon:"⏱️",title:"Gemeinsame Spielzeit",big:fmtDurShort(totalTime)+" h",text:"haben alle zusammen schon gespielt"});
  const done=plays.filter(p=>p.done);
  if(done.length){const l=done.slice().sort((a,b)=>b.dur-a.dur)[0];
    const over=l.plan?Math.round(l.dur-l.plan.duration):null;
    stats.push({icon:"🐌",title:"Längste Partie",big:fmtDur(l.dur),text:l.game+(over!=null?(over>0?` (${over} min über dem Plan)`:` (${-over} min unter dem Plan)`):""),game:l.game});}
  else stats.push({icon:"🐌",title:"Längste Partie",big:"–",text:"Noch keine Partie beendet"});
  const gameFans={};plays.forEach(p=>{const k=p.game.replace(/\s*\(Tisch \d+\)$/,"");gameFans[k]=gameFans[k]||new Set();p.players.forEach(x=>gameFans[k].add(norm(x.name)));});
  const fav=Object.entries(gameFans).sort((a,b)=>b[1].size-a[1].size)[0];
  if(fav)stats.push({icon:"❤️",title:"Beliebtestes Spiel",big:fav[0],text:fav[1].size+" verschiedene Mitspieler",game:fav[0]});
  else stats.push({icon:"❤️",title:"Beliebtestes Spiel",big:"–",text:"Noch keine Partie gestartet"});
  const pairs={};plays.forEach(p=>{const ns=p.players.map(x=>x.name).filter(n=>norm(n)!==norm(host));
    for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++){const k=[ns[i],ns[j]].sort().join(" & ");pairs[k]=(pairs[k]||0)+1;}});
  const duo=Object.entries(pairs).sort((a,b)=>b[1]-a[1])[0];
  if(duo)stats.push({icon:"👯",title:"Unzertrennlich",big:duo[0],text:duo[1]+"× zusammen am Tisch"});
  else stats.push({icon:"👯",title:"Unzertrennlich",big:"–",text:"Wer sitzt am häufigsten zusammen am Tisch?"});
  // Rivalen-Duell: direkte Bilanz zweier Personen
  const h2h={};
  done.forEach(p=>{const ps=p.players;for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
    const a=ps[i],b=ps[j];let wa=0,wb=0;
    if(p.team){if(a.win===b.win)continue;a.win?wa=1:wb=1;}else{const pa=a.place||99,pb=b.place||99;if(pa===pb)continue;pa<pb?wa=1:wb=1;}
    const [x,y,sx,sy]=a.name.localeCompare(b.name)<0?[a.name,b.name,wa,wb]:[b.name,a.name,wb,wa];
    const k=x+"|"+y;h2h[k]=h2h[k]||{x,y,a:0,b:0};h2h[k].a+=sx;h2h[k].b+=sy;}});
  const riv=Object.values(h2h).filter(r=>r.a+r.b>=2).sort((r,s)=>(s.a+s.b)-(r.a+r.b)||Math.abs(r.a-r.b)-Math.abs(s.a-s.b))[0];
  if(riv){const [l,r]=riv.a>=riv.b?[riv.x,riv.y]:[riv.y,riv.x];stats.push({icon:"⚔️",title:"Rivalen-Duell",big:Math.max(riv.a,riv.b)+" : "+Math.min(riv.a,riv.b),text:l+" gegen "+r});}
  else stats.push({icon:"⚔️",title:"Rivalen-Duell",big:"–",text:"Wer hat die beste direkte Bilanz?"});
  // Comeback-Kid: letzter Platz, danach direkt gewonnen
  const cb={};
  people.forEach(x=>{const hist=done.filter(p=>p.players.some(q=>norm(q.name)===x.key)).sort((a,b)=>a.e-b.e)
    .map(p=>{const q=p.players.find(q=>norm(q.name)===x.key),n=p.players.length;return {last:p.team?!q.win:(q.place||n)===n&&n>1,win:p.team?q.win:q.place===1};});
    for(let i=1;i<hist.length;i++)if(hist[i-1].last&&hist[i].win)cb[x.name]=(cb[x.name]||0)+1;});
  const kid=Object.entries(cb).sort((a,b)=>b[1]-a[1])[0];
  stats.push(kid?{icon:"🦸",title:"Comeback-Kid",big:kid[0],text:"vom letzten Platz direkt zum Sieg"+(kid[1]>1?` (${kid[1]}×)`:"")}:{icon:"🦸",title:"Comeback-Kid",big:"–",text:"Wer gewinnt direkt nach einem letzten Platz?"});
  // Allrounder: meiste verschiedene Spiele
  const variety=people.map(x=>({name:x.name,n:new Set(plays.filter(p=>p.players.some(q=>norm(q.name)===x.key)).map(p=>p.game.replace(/\s*\(Tisch \d+\)$/,""))).size}))
    .filter(x=>norm(x.name)!==norm(host)).sort((a,b)=>b.n-a.n)[0];
  stats.push(variety&&variety.n>1?{icon:"🎲",title:"Allrounder",big:variety.name,text:variety.n+" verschiedene Spiele gespielt"}:{icon:"🎲",title:"Allrounder",big:"–",text:"Wer spielt die meisten verschiedenen Spiele?"});
  stats.push({icon:"🏁",title:"Marathon-Fortschritt",big:progress+" %",text:"des Tages sind geschafft",bar:progress});

  // Als Nächstes
  const startedNames=new Set(plays.map(p=>p.game));
  const upcoming=games.filter(g=>!startedNames.has(g.name)&&g.e>now).sort((a,b)=>a.s-b.s);
  const next=upcoming.length?upcoming.filter(g=>g.s===upcoming[0].s):[];

  const ticker=[];
  done.slice().sort((a,b)=>b.e-a.e).slice(0,8).forEach(p=>{
    if(p.team){const w=p.players.filter(x=>x.win).map(x=>x.name);if(w.length)ticker.push(`${w.join(" & ")} ${w.length>1?"gewinnen":"gewinnt"} ${p.game}`);}
    else{const r=p.players.slice().sort((a,b)=>(a.place||99)-(b.place||99));if(r[0])ticker.push(`${r[0].name} gewinnt ${p.game}`+(r[1]?` vor ${r[1].name}`:""));}});
  plays.filter(p=>!p.done).forEach(p=>ticker.unshift(`${p.game} läuft seit ${p.start} Uhr`));
  if(next.length)ticker.push(`Gleich geht's los: ${next.map(g=>g.name).join(" und ")} um ${next[0].start} Uhr`);
  if(!done.length&&!plays.length)ticker.push("Willkommen zum Brettspielmarathon","Heute wird 18 Stunden gespielt");

  return {ticker,now,plays,running:plays.filter(p=>!p.done),done,people,byPoints,byQuote,medals,awards,tim,stats,next,host};
}

function coverOf(S,name){if(!S||!name)return "";const base=String(name).replace(/\s*\(Tisch \d+\)$/,"");const g=(S.games||[]).find(x=>x.name===name)||(S.games||[]).find(x=>x.name===base);if(g&&g.cover)return g.cover;const p=(S.plays||[]).slice().reverse().find(x=>(x.game===name||x.game===base)&&x.cover);return p?p.cover:"";}

window.BSM={coverOf,API,toMin,nowMin,fmtClock,fmtDur,fmtDurShort,norm,esc,api,loadState,compute};
})();
