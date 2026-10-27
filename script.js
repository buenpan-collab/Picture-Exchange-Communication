"use strict";
const $ = id => document.getElementById(id);
const EMOJIS = ["💧","🍚","🥛","🍞","🍎","🍌","😀","😢","😠","😴","🤕","🧸","⚽","📺","🚽","🛁","🎵","🏠"];
const DEFAULT = {
  cats: [{id:"food",name:"🍽️ Food"},{id:"emo",name:"😊 Emotions"},{id:"act",name:"🎈 Activities"}],
  cards: [
    {id:1,cat:"food",label:"Water",emoji:"💧"},{id:2,cat:"food",label:"Rice",emoji:"🍚"},
    {id:3,cat:"food",label:"Milk",emoji:"🥛"},{id:4,cat:"food",label:"Bread",emoji:"🍞"},
    {id:5,cat:"emo",label:"Happy",emoji:"😀"},{id:6,cat:"emo",label:"Sad",emoji:"😢"},
    {id:7,cat:"emo",label:"Angry",emoji:"😠"},{id:8,cat:"emo",label:"Tired",emoji:"😴"},
    {id:9,cat:"emo",label:"It hurts",emoji:"🤕"},{id:10,cat:"act",label:"Play",emoji:"🧸"},
    {id:11,cat:"act",label:"Toilet",emoji:"🚽"},{id:12,cat:"act",label:"Watch TV",emoji:"📺"}
  ],
  lang:"en-US", rate:0.8
};

function load(k,d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } }
function save(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{ showMsg("Storage full — use smaller photos."); } }

let data = load("pecs_data", structuredClone(DEFAULT));
let log = load("pecs_log", []);
let curCat = data.cats[0]?.id, careMode = false, strip = [];
let draft = {emoji:EMOJIS[0], img:null}, formStart = null, errors = 0;

/* ---------- Text-to-speech (Web Speech API) ---------- */
function speak(text){
  if(!("speechSynthesis" in window)) return showMsg("This browser has no text-to-speech.");
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = data.lang; u.rate = data.rate;
  speechSynthesis.speak(u);
}

/* ---------- Render ---------- */
function picHTML(c, cls){
  return c.img ? `<img src="${c.img}" alt="">` : c.emoji;
}
function renderTabs(){
  const t = $("tabs"); t.innerHTML = "";
  data.cats.forEach(c => {
    const b = document.createElement("button");
    b.textContent = c.name; b.className = c.id===curCat ? "on" : "";
    b.onclick = () => { curCat = c.id; renderTabs(); renderGrid(); };
    t.appendChild(b);
  });
  $("catSel").innerHTML = data.cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  $("catSel").value = curCat;
}
function renderGrid(){
  const g = $("grid"); g.innerHTML = "";
  const cards = data.cards.filter(c => c.cat === curCat);
  if(!cards.length){ g.innerHTML = '<p class="empty">No cards yet. Open Caregiver mode to add some.</p>'; return; }
  cards.forEach(c => {
    const b = document.createElement("div"); b.className = "card"; b.tabIndex = 0; b.setAttribute("role","button");
    b.setAttribute("aria-label", c.label);
    b.innerHTML = `<div class="pic">${picHTML(c)}</div><div class="lbl"></div>`;
    b.querySelector(".lbl").textContent = c.label;
    const tap = () => { speak(c.label); strip.push(c); renderStrip(); b.classList.add("say"); setTimeout(()=>b.classList.remove("say"),400); };
    b.onclick = tap;
    b.onkeydown = e => { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); tap(); } };
    if(careMode){
      const d = document.createElement("button"); d.className="del"; d.textContent="🗑"; d.setAttribute("aria-label","Delete "+c.label);
      d.onclick = e => { e.stopPropagation(); data.cards = data.cards.filter(x=>x.id!==c.id); save("pecs_data",data); renderGrid(); };
      b.appendChild(d);
    }
    g.appendChild(b);
  });
}
function renderStrip(){
  $("stripCards").innerHTML = strip.map(c=>`<div class="mini">${picHTML(c)}</div>`).join("");
}
$("speakStrip").onclick = () => { if(strip.length) speak("I want " + strip.map(c=>c.label).join(", ")); };
$("clearStrip").onclick = () => { strip = []; renderStrip(); speechSynthesis.cancel(); };

/* ---------- Mode switch ---------- */
function setMode(care){
  careMode = care; $("carePanel").hidden = !care;
  $("careBtn").classList.toggle("on", care); $("childBtn").classList.toggle("on", !care);
  if(care && formStart===null){ formStart = performance.now(); errors = 0; }
  renderGrid();
}
$("childBtn").onclick = () => setMode(false);
$("careBtn").onclick = () => setMode(true);

/* ---------- Card form ---------- */
function showMsg(t, ok){ $("msg").textContent = t; $("msg").className = ok ? "ok" : ""; }
function renderPreview(){ $("preview").innerHTML = draft.img ? `<img src="${draft.img}" alt="Preview">` : draft.emoji; }
EMOJIS.forEach(e => {
  const b = document.createElement("button"); b.type="button"; b.textContent=e; b.setAttribute("aria-label","Icon "+e);
  b.onclick = () => { draft.emoji = e; draft.img = null; $("fileIn").value=""; [...$("emojiPick").children].forEach(x=>x.classList.toggle("sel",x===b)); renderPreview(); };
  $("emojiPick").appendChild(b);
});
$("emojiPick").firstChild.classList.add("sel");

// Upload + shrink photo (keeps localStorage small; later send to Flask/MySQL)
$("fileIn").onchange = e => {
  const f = e.target.files[0]; if(!f) return;
  if(!f.type.startsWith("image/")){ errors++; return showMsg("⚠ Please choose an image file."); }
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const s = 300 / Math.max(img.width, img.height, 300);
    const cv = document.createElement("canvas"); cv.width = img.width*s; cv.height = img.height*s;
    cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
    draft.img = cv.toDataURL("image/jpeg",0.8); URL.revokeObjectURL(url); renderPreview();
  };
  img.src = url;
};

$("saveCard").onclick = () => {
  const label = $("labelIn").value.trim();
  if(!label){ errors++; return showMsg("⚠ Please type the word to speak."); }
  if(data.cards.some(c=>c.cat===$("catSel").value && c.label.toLowerCase()===label.toLowerCase())){
    errors++; return showMsg("⚠ That card already exists in this category.");
  }
  data.cards.push({id:Date.now(), cat:$("catSel").value, label, emoji:draft.emoji, img:draft.img});
  save("pecs_data", data);
  const secs = Math.round((performance.now()-formStart)/100)/10;
  log.push({secs, errors}); save("pecs_log", log);
  curCat = $("catSel").value; formStart = performance.now(); errors = 0;
  $("labelIn").value = ""; draft.img = null; $("fileIn").value=""; renderPreview();
  showMsg("Card saved ✔", true); renderTabs(); renderGrid(); renderLog();
};
$("addCat").onclick = () => {
  const n = $("catIn").value.trim();
  if(!n){ errors++; return showMsg("⚠ Type a category name."); }
  const id = "c"+Date.now(); data.cats.push({id,name:n}); curCat = id; save("pecs_data",data);
  $("catIn").value=""; renderTabs(); renderGrid(); showMsg("Category added ✔", true);
};

/* ---------- Voice settings ---------- */
$("langSel").value = data.lang; $("rateIn").value = data.rate;
$("langSel").onchange = () => { data.lang = $("langSel").value; save("pecs_data",data); };
$("rateIn").onchange = () => { data.rate = Number($("rateIn").value); save("pecs_data",data); };
$("testVoice").onclick = () => speak("Hello! This is my voice.");

/* ---------- Research log ---------- */
function renderLog(){
  $("logTable").tBodies[0].innerHTML = log.map((r,i)=>`<tr><td>${i+1}</td><td>${r.secs}</td><td>${r.errors}</td></tr>`).join("");
}
$("csvBtn").onclick = () => {
  const csv = "card,setup_seconds,errors\n" + log.map((r,i)=>`${i+1},${r.secs},${r.errors}`).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = "pecs_usability_log.csv"; a.click();
};
$("clearLog").onclick = () => { log = []; save("pecs_log",log); renderLog(); };
$("resetAll").onclick = () => { if(confirm("Reset board to default cards?")){ data = structuredClone(DEFAULT); curCat = data.cats[0].id; save("pecs_data",data); renderTabs(); renderGrid(); } };

renderTabs(); renderGrid(); renderStrip(); renderPreview(); renderLog();
