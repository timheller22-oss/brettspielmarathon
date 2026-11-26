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
/* BGG-Gesamtrangliste (Stand Nov. 2026): Platz, BGG-Durchschnitt */
const BGG_TOP={"Arche Nova":[2,8.54],"Dune Imperium":[6,8.41],"Terraforming Mars":[9,8.33],"Great Western Trail":[21,8.14],
  "7 Wonders Duel":[24,8.07],"Ein Fest für Odin":[26,8.16],"Sky Team":[32,8.11],"Terra Mystica":[36,8.03],
  "Flügelschlag":[38,7.99],"Puerto Rico":[58,7.90],"Caverna":[63,7.92],
  "Azul":[101,7.71],"Mombasa":[148,7.83],"Mischwald":[150,7.73],"Der Kartograph":[186,7.54]};
function bggOf(name){const b=String(name||"").replace(/\s*\(Tisch \d+\)$/,"");const r=BGG_TOP[b];return r?{name:b,rank:r[0],avg:r[1]}:null;}
const ORD=["","beste","zweitbeste","drittbeste","viertbeste","fünftbeste","sechstbeste","siebtbeste","achtbeste","neuntbeste","zehntbeste"];
const dez=v=>String(v).replace(".",",");

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

  // Spiele im Rampenlicht (Spielinfos + Daten aus dem Spielplan)
  const spot=(S.infos||[]).map(i=>{const g=games.find(x=>x.name===i.name)||{};
    return {...i,desc:i.desc||g.desc||"",cover:i.cover||g.cover||"",rating:g.rating??null,weight:g.weight??null,start:g.start||"",plan:!!g.name};});

  // Ordinal der Siege pro Person (für Meldungen wie „3. Sieg“)
  const winNo={},cnt={};
  done.slice().sort((a,b)=>a.e-b.e).forEach(p=>{const w=p.team?p.players.filter(x=>x.win):p.players.filter(x=>x.place===1);
    w.forEach(x=>{const k=norm(x.name);cnt[k]=(cnt[k]||0)+1;winNo[p.id+"|"+k]=cnt[k];});});
  const ord=n=>n+".";
  const seed=Math.floor(now/20);  // wechselt alle 20 Minuten
  const pick=(arr,n,off)=>{if(!arr.length)return[];const out=[];for(let i=0;i<Math.min(n,arr.length);i++)out.push(arr[(seed*7+i*3+(off||0))%arr.length]);return [...new Set(out)];};

  const ticker=[];
  // Live
  plays.filter(p=>!p.done).forEach(p=>ticker.push(p.dur>=60?`${p.game} läuft schon seit ${fmtDur(p.dur)}`:`${p.game} läuft seit ${p.start} Uhr`));
  // Ergebnisse
  done.slice().sort((a,b)=>b.e-a.e).slice(0,5).forEach(p=>{
    if(p.team){const w=p.players.filter(x=>x.win).map(x=>x.name);if(w.length)ticker.push(`${w.join(" & ")} ${w.length>1?"gewinnen":"gewinnt"} ${p.game}`);}
    else{const r=p.players.slice().sort((a,b)=>(a.place||99)-(b.place||99));if(r[0]){const n=winNo[p.id+"|"+norm(r[0].name)];
      ticker.push(`${r[0].name} gewinnt ${p.game}`+(r[1]?` vor ${r[1].name}`:"")+(n>1?` und holt den ${ord(n)} Sieg des Tages`:""));}}});
  // Rekorde und Serien
  if(medals[0])ticker.push(`Im Medaillenspiegel führt ${medals[0].name} mit ${medals[0].gold}× Gold`);
  if(byPoints[0]&&byPoints[1])ticker.push(`${byPoints[0].name} hat ${byPoints[0].points-byPoints[1].points} Punkte Vorsprung auf ${byPoints[1].name}`);
  const streaker=people.filter(x=>x.streak>=2).sort((a,b)=>b.streak-a.streak)[0];
  if(streaker)ticker.push(`${streaker.name} ist heiß: ${streaker.streak} Siege in Folge`);
  if(done.length){const l=done.slice().sort((a,b)=>b.dur-a.dur)[0];ticker.push(`Längste Partie bisher: ${l.game} mit ${fmtDur(l.dur)}`);}
  if(totalTime>0)ticker.push(`Gemeinsam schon ${fmtDurShort(totalTime)} Stunden gespielt`);
  if(tim.delay!=null&&Math.abs(tim.delay)>5)ticker.push(tim.delay>0?`Der Zeitplan hinkt ${tim.delay} Minuten hinterher`:`Ihr seid ${-tim.delay} Minuten vor dem Zeitplan`);
  // Vorschau mit freien Plätzen
  upcoming.slice(0,3).forEach(g=>{const booked=(S.bookings||[]).filter(b=>b.key===g.name).length,free=g.seats-(g.host!==false?1:0)-booked;
    ticker.push(free>0?`${g.name} um ${g.start} Uhr: noch ${free} ${free===1?"Platz":"Plätze"} frei`:`${g.name} um ${g.start} Uhr ist ausgebucht`);});
  // Wusstest du?
  pick(spot.filter(x=>x.fact),3).forEach(x=>ticker.push(`Wusstest du? ${x.fact}`));
  if(!ticker.length)ticker.push("Willkommen zum Brettspielmarathon","Heute wird 18 Stunden gespielt");

  // Stunden-News für den Comic-Sprecher: bis zu 3 Meldungen + 2 wechselnde Rubriken
  const news=[];
  if(byPoints[0])news.push({k:"SPITZE",t:`${byPoints[0].name} führt die Rangliste an!`});
  const last=done.slice().sort((a,b)=>b.e-a.e)[0];
  const lastOrder=last?(last.team?[...last.players.filter(x=>x.win),...last.players.filter(x=>!x.win)]:last.players.slice().sort((a,b)=>(a.place||99)-(b.place||99))):[];
  const lastWin=last?(last.team?last.players.filter(x=>x.win).map(x=>x.name).join(" & "):(lastOrder[0]||{}).name):"";
  if(lastWin)news.push({k:"SIEG",t:`${lastWin} schnappt sich ${last.game}!`});
  const runs=plays.filter(p=>!p.done);
  if(runs.length)news.push({k:"LIVE",t:runs.length===1?`Gerade läuft ${runs[0].game}.`:`Gerade laufen ${runs.map(p=>p.game).join(" und ")}.`});
  else if(next[0])news.push({k:"GLEICH",t:`Um ${next[0].start} Uhr startet ${next.map(g=>g.name).join(" und ")}!`});
  if(news.length<2&&tim.delay!=null)news.push({k:"ZEITPLAN",t:Math.abs(tim.delay)<=5?"Wir liegen voll im Zeitplan!":tim.delay>0?`${tim.delay} Minuten Verspätung. Tempo, Leute!`:`${-tim.delay} Minuten Vorsprung auf den Plan!`});
  if(!news.length)news.push({k:"HALLO",t:"Willkommen zu Tims Brettspielmarathon! Gleich geht's los."});

  const hour=Math.floor(now/60), names=people.map(x=>x.name).filter(n=>norm(n)!==norm(host));
  const pickOne=(arr,o)=>arr.length?arr[(hour*5+(o||0))%arr.length]:null;
  const focus=runs[0]||(next[0]?{game:next[0].name,plan:next[0]}:null);
  const tisch=g=>String(g).replace(/\s+/g,"-")+"-Tisch";
  const focusGame=focus?focus.game:null, focusW=focus&&focus.plan?focus.plan.weight:null;
  const bookedNext=next[0]?(S.bookings||[]).filter(b=>b.key===next[0].name).map(b=>b.name):[];
  const rub={
    WETTER:()=>{if(!focusGame)return null;
      const w=focusW==null?2.5:focusW;
      const f=w>=3.5?"schwere Gewitter aus Grübelfalten, die Konzentration erreicht Rekordwerte":w>=2.8?"dichte Denkwolken, gelegentlich Schauer aus Ressourcen":w>=2?"wechselhaft mit sonnigen Abschnitten und kurzen Taktik-Böen":"strahlender Sonnenschein, beste Laune und viel Gelächter";
      const who=pickOne(names,1);
      return `Spielwetter am ${tisch(focusGame)}: ${f}.`+(who?` Für ${who} besteht leichte Pechgefahr.`:"");},
    BÖRSE:()=>{if(!last||!lastOrder.length)return null;
      const up=lastOrder[0],down=lastOrder[lastOrder.length-1];if(!up||!down||up===down)return null;
      const pu=P[norm(up.name)],gain=last.team?last.players.filter(x=>!x.win).length:last.players.length-1;
      const pct=pu&&pu.points>gain?Math.round(gain/(pu.points-gain)*100):100;
      return `Börsenticker: Die ${up.name}-Aktie steigt um ${Math.min(pct,250)} Prozent! ${down.name} gibt nach dem letzten Platz leicht nach.`;},
    SPORT:()=>{if(!last||!lastWin)return null;
      const second=last.team?null:(lastOrder[1]||{}).name, over=last.plan?Math.round(last.dur-last.plan.duration):0;
      return `Was für ein Finale bei ${last.game}! ${lastWin} setzt sich durch`+(second?`, ${second} kämpft bis zur letzten Sekunde`:"")+(over>10?`, und das nach ${over} Minuten Nachspielzeit`:"")+"!";},
    HOROSKOP:()=>{const who=pickOne(bookedNext.length?bookedNext:names,2);if(!who)return null;
      const g=next[0]?next[0].name:"der nächsten Partie";
      return `Für ${who} stehen die Sterne gut bei ${g}. Glückszahl: ${(hour*7)%9+1}. Glücksfarbe: ${["Rot","Blau","Grün","Gelb","Lila"][hour%5]}.`;},
    RANKING:()=>{const g=focusGame&&bggOf(focusGame);
      const ranked=Object.keys(BGG_TOP).map(bggOf);
      if(g){const lead=runs.length?"Gerade läuft":"Gleich startet";
        const pos=g.rank<=10?`das ${ORD[g.rank]} Brettspiel der Welt`:`Platz ${g.rank} der BoardGameGeek-Weltrangliste`;
        return `${lead} am ${tisch(g.name)} ${pos}! Die Community gibt im Schnitt ${dez(g.avg.toFixed(1))}.`;}
      const r=ranked[((hour%ranked.length)+ranked.length)%ranked.length];
      return `${ranked.length} Spiele aus Tims Regal stehen in den BoardGameGeek-Top-200. Heute im Blick: ${r.name} auf Platz ${r.rank}.`;},
    GERÜCHT:()=>{const a=pickOne(names,3),b=pickOne(names,4),g=focusGame||"Dune Imperium";
      const t=[`Insider berichten von geheimen Allianzen am ${tisch(g)}.`,
        a?`Man munkelt, ${a} hat heimlich die Regeln von ${g} auswendig gelernt.`:null,
        a&&b&&a!==b?`Gerüchten zufolge haben ${a} und ${b} einen Nichtangriffspakt geschlossen.`:null,
        `Unbestätigten Quellen zufolge plant Marlene schon die nächste Snack-Offensive.`,
        `Aus Tims Umfeld heißt es: Er gibt sich siegessicher, wirkt aber nervös.`].filter(Boolean);
      return t[hour%t.length];}
  };
  const keys=Object.keys(rub);let added=0;
  for(let i=0;i<keys.length&&added<2;i++){const k=keys[(hour*2+i)%keys.length],t=rub[k]();if(t){news.push({k,t,r:1});added++;}}
  const FACTS=[
    "Das Königliche Spiel von Ur ist rund 4.500 Jahre alt. Seine Regeln wurden auf einer babylonischen Keilschrifttafel entziffert.",
    "Monopoly geht auf „The Landlord's Game“ von Elizabeth Magie zurück. Das sollte 1904 eigentlich vor Monopolen warnen.",
    "Das Wort „Meeple“ entstand im Jahr 2000 bei einer Partie Carcassonne, als Mischung aus „my“ und „people“.",
    "Das Spiel des Jahres gibt es seit 1979. Der allererste Gewinner war Hase und Igel.",
    "Der erste Kennerspiel-des-Jahres-Preis ging 2011 an 7 Wonders.",
    "In Flügelschlag stecken 170 verschiedene Vogelkarten, jede mit echten Infos zum Vogel.",
    "Es gibt mehr mögliche Schachpartien als Atome im beobachtbaren Universum.",
    "Gegenüberliegende Seiten eines normalen Würfels ergeben zusammen immer 7.",
    "Mensch ärgere Dich nicht wurde um 1907 von Josef Friedrich Schmidt erfunden. Vorbild war das indische Pachisi.",
    "BoardGameGeek wurde im Jahr 2000 gegründet und ist heute die größte Brettspiel-Datenbank der Welt.",
    "Die Spielemesse SPIEL in Essen ist die größte Brettspielmesse der Welt, mit fast 200.000 Besuchern.",
    "Die Gloomhaven-Box wiegt fast 10 Kilo. Damit ist sie eher Möbelstück als Spiel.",
    "Catan-Erfinder Klaus Teuber war eigentlich Zahntechniker.",
    "Agricola und Caverna stammen beide von Uwe Rosenberg aus Ostfriesland.",
    "Azul ist von den portugiesischen Azulejo-Fliesen inspiriert und wurde 2018 Spiel des Jahres.",
    "Puerto Rico stand jahrelang auf Platz 1 der BoardGameGeek-Rangliste.",
    "Sky Team, ein Spiel für genau zwei Piloten, wurde 2024 Spiel des Jahres.",
    "Terra Mystica bietet 14 verschiedene Völker, jedes mit eigener Fähigkeit.",
    "Trivial Pursuit wurde 1979 von zwei Kanadiern beim Scrabble-Spielen erfunden.",
    "2016 besiegte die KI AlphaGo den Go-Weltklassespieler Lee Sedol, viele Jahre früher als erwartet."];
  news.splice(4);news.push({k:"GEEK-FAKT",t:FACTS[((hour%FACTS.length)+FACTS.length)%FACTS.length],g:1});

  return {spot,news,ticker,now,plays,running:plays.filter(p=>!p.done),done,people,byPoints,byQuote,medals,awards,tim,stats,next,host};
}

function coverOf(S,name){if(!S||!name)return "";const base=String(name).replace(/\s*\(Tisch \d+\)$/,"");const g=(S.games||[]).find(x=>x.name===name)||(S.games||[]).find(x=>x.name===base);if(g&&g.cover)return g.cover;const p=(S.plays||[]).slice().reverse().find(x=>(x.game===name||x.game===base)&&x.cover);return p?p.cover:"";}

window.BSM={BGG_TOP,bggOf,dez,coverOf,API,toMin,nowMin,fmtClock,fmtDur,fmtDurShort,norm,esc,api,loadState,compute};
})();
