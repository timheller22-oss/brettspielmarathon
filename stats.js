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

  const awards=[];
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
  if(totalTime>0)stats.push({icon:"⏱️",title:"Gemeinsame Spielzeit",big:fmtDurShort(totalTime)+" h",text:"haben alle zusammen schon gespielt"});
  const done=plays.filter(p=>p.done);
  if(done.length){const l=done.slice().sort((a,b)=>b.dur-a.dur)[0];
    const over=l.plan?Math.round(l.dur-l.plan.duration):null;
    stats.push({icon:"🐌",title:"Längste Partie",big:fmtDur(l.dur),text:l.game+(over!=null?(over>0?` (${over} min über dem Plan)`:` (${-over} min unter dem Plan)`):"")});}
  const gameFans={};plays.forEach(p=>{const k=p.game.replace(/\s*\(Tisch \d+\)$/,"");gameFans[k]=gameFans[k]||new Set();p.players.forEach(x=>gameFans[k].add(norm(x.name)));});
  const fav=Object.entries(gameFans).sort((a,b)=>b[1].size-a[1].size)[0];
  if(fav&&fav[1].size>1)stats.push({icon:"❤️",title:"Beliebtestes Spiel",big:fav[0],text:fav[1].size+" verschiedene Mitspieler"});
  const pairs={};plays.forEach(p=>{const ns=p.players.map(x=>x.name).filter(n=>norm(n)!==norm(host));
    for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++){const k=[ns[i],ns[j]].sort().join(" & ");pairs[k]=(pairs[k]||0)+1;}});
  const duo=Object.entries(pairs).sort((a,b)=>b[1]-a[1])[0];
  if(duo&&duo[1]>1)stats.push({icon:"👯",title:"Unzertrennlich",big:duo[0],text:duo[1]+"× zusammen am Tisch"});
  stats.push({icon:"🏁",title:"Marathon-Fortschritt",big:progress+" %",text:"des Tages sind geschafft",bar:progress});

  // Als Nächstes
  const startedNames=new Set(plays.map(p=>p.game));
  const upcoming=games.filter(g=>!startedNames.has(g.name)&&g.e>now).sort((a,b)=>a.s-b.s);
  const next=upcoming.length?upcoming.filter(g=>g.s===upcoming[0].s):[];

  return {now,plays,running:plays.filter(p=>!p.done),done,people,byPoints,byQuote,medals,awards,tim,stats,next,host};
}

window.BSM={API,toMin,nowMin,fmtClock,fmtDur,fmtDurShort,norm,esc,api,loadState,compute};
})();
