import { FILTERS, validateActivities, filterActivities, pickActivity } from './core.js';
import { createActivityHistory } from './history.js';
const activityHistory = createActivityHistory({
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value)
});
const app = document.querySelector('#app');
const gradeButton = document.querySelector('#change-grade');
const status = document.querySelector('#status');
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { announce('Prehliadač nepovolil uloženie. Výber zostane zachovaný počas tohto otvorenia.'); return false; } }
let favorites = read('rk-favorites-v2', []);
if (!Array.isArray(favorites)) favorites = [];
let grade = read('rk-grade', 1);
if (![1,2].includes(grade)) grade = 1;
let activities = [], current = null, filter = {kind:'all'}, screen = 'home', fromList = false;
let statusTimer;
let selectionTimer = null;
let selecting = false;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function announce(message) { clearTimeout(statusTimer); status.textContent = message; statusTimer = setTimeout(() => status.textContent = '', 5000); }
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  arrow:'<path d="m9 5 7 7-7 7"/>', back:'<path d="M20 12H4m7-7-7 7 7 7"/>',
  dice:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01" stroke-width="3"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  calm:'<circle cx="12" cy="12" r="9"/><path d="M6 9q2 3 4 0m4 0q2 3 4 0M8 15q4 4 8 0"/>',
  bolt:'<path d="m14 2-9 12h7l-2 8 9-12h-7Z"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5v2"/>',
  target:'<circle cx="11" cy="13" r="9"/><circle cx="11" cy="13" r="5"/><path d="m11 13 10-10m-5 0h5v5"/>',
  bag:'<rect x="5" y="7" width="14" height="14" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2M9 14h6"/>',
  chat:'<path d="M21 11a9 8 0 0 1-9 8H4l-2 3V11a9 8 0 0 1 19 0Z"/><path d="M7 11h.01M12 11h.01M17 11h.01" stroke-width="3"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  pencil:'<path d="m3 21 5-1L21 7l-4-4L4 16l-1 5Zm11-15 4 4"/>',
  sparkle:'<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 16v4m-2-2h4"/>',
  question:'<path d="M8 7a4 4 0 0 1 8 0c0 4-4 3-4 7m0 4v1"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.people}</svg>`;
const plural = n => n === 1 ? 'aktivita' : n >= 2 && n <= 4 ? 'aktivity' : 'aktivít';
const number = id => escape(id.replace(/^0+(?=\d)/, ''));
function render(focus = true) {
  if (selecting) { clearTimeout(statusTimer); status.textContent = ''; }
  clearTimeout(selectionTimer);
  selectionTimer = null;
  selecting = false;
  app.setAttribute('aria-busy', 'false');
  app.className = `card ${screen}`;
  gradeButton.hidden = screen === 'home';
  gradeButton.innerHTML = `${icon('people')} ${grade}. stupeň <span>Zmeniť</span>`;
  gradeButton.setAttribute('aria-label', `Zmeniť stupeň, aktuálne ${grade}. stupeň`);
  if (screen === 'home') {
    const count = g => activities.filter(a => a.gradeLevel === g).length;
    const favCount = activities.filter(a => favorites.includes(a.id)).length;
    app.innerHTML = `<section class="hero"><h1 tabindex="-1">Odporúčané aktivity <em>z Príručky pre ranné kruhy</em></h1><p class="lead">Aktivity v aplikácii vychádzajú z Príručky pre ranné kruhy, ktorú vydalo Ministerstvo školstva, výskumu, vývoja a mládeže Slovenskej republiky.</p></section><section class="grades"><h2>Vyber si:</h2><div class="grade-grid">${[1,2].map(g => `<button class="grade-card" data-action="grade" data-value="${g}"><span class="grade-num" aria-hidden="true">${g}.</span><span class="grade-text"><strong>Aktivity pre ${g}. stupeň</strong><small>${count(g)} ${plural(count(g))}</small></span>${icon('arrow')}</button>`).join('')}</div><button class="fav-row" data-action="favorites-all">${icon('heart')}<span class="grow">Moje obľúbené</span><span class="badge">${favCount}</span>${icon('arrow')}</button></section>`;
  }
  if (screen === 'choose') {
    const catCount = value => filterActivities(activities, grade, {kind:'category', value}).length;
    const favCount = activities.filter(a => a.gradeLevel === grade && favorites.includes(a.id)).length;
    app.innerHTML = `<p class="crumb">${grade}. stupeň</p><h1 tabindex="-1">Vyber si <em>dnešnú aktivitu.</em></h1><button class="random-card" data-action="all"><span class="random-icon">${icon('sparkle')}</span><strong class="grow">Vybrať náhodnú aktivitu</strong>${icon('arrow')}</button><h2 class="section-title">Vybrať podľa typu aktivity</h2><div class="cat-grid">${FILTERS.map(f => `<button class="cat" data-action="category" data-value="${f.value}"><span class="cat-emoji" aria-hidden="true">${f.emoji}</span><strong>${f.label}</strong><small>${catCount(f.value)} ${plural(catCount(f.value))}</small></button>`).join('')}</div><button class="fav-row" data-action="favorites">${icon('heart')}<span class="grow">Moje obľúbené</span><span class="badge">${favCount}</span>${icon('arrow')}</button>`;
  }
  if (screen === 'activity' && current) {
    const a = current, liked = favorites.includes(a.id);
    const selectionLabel = filter.kind === 'all' ? `Výber zo všetkých aktivít · ${grade}. stupeň` : filter.kind === 'favorites-all' ? `Obľúbené · ${grade}. stupeň` : filter.kind === 'favorites' ? `Výber z obľúbených · ${grade}. stupeň` : `Typ výberu: ${FILTERS.find(f => f.value === filter.value)?.label || ''} · ${grade}. stupeň`;
    app.innerHTML = `<div class="activity-top"><button class="back" data-action="${fromList?'list':'back'}">${icon('back')} ${fromList?'Späť na zoznam':'Zmeniť výber'}</button><div class="activity-tools"><span class="activity-number">Aktivita ${number(a.id)}</span><button class="heart ${liked?'liked':''}" data-action="favorite" aria-label="${liked?'Odstrániť z obľúbených':'Pridať medzi obľúbené'}" aria-pressed="${liked}">${icon('heart')}</button></div></div><div class="activity-heading"><h1 tabindex="-1">${escape(a.title)}</h1></div><div class="metadata"><p class="activity-type" aria-label="Typ aktivity">${a.types.map(t => `<span class="chip">${escape(t)}</span>`).join('')}</p><p class="activity-materials">${icon('bag')}<span><b>Pomôcky:</b> ${escape(a.materials)}</span></p></div><section class="steps"><h2>Čo robíme?</h2><ol>${a.steps.map(s=>`<li>${escape(s)}</li>`).join('')}</ol></section><div class="activity-extra"><details><summary>${icon('chat')}<span>Reflexia</span></summary><ul>${a.reflection.map(q=>`<li>${escape(q)}</li>`).join('')}</ul></details><details><summary>${icon('pencil')}<span>Podrobný návod</span></summary><p>${escape(a.details)}</p></details></div>${fromList?'':`<button class="another" data-action="another">${icon('sparkle')} Iná aktivita</button>`}<p class="filter-note">${escape(selectionLabel)}</p>`;
  }
  if (screen === 'list') {
    const allFav = filter.kind === 'favorites-all';
    const label = FILTERS.find(f => f.value === filter.value);
    const items = allFav ? activities.filter(a => favorites.includes(a.id)) : filterActivities(activities, grade, filter, favorites);
    const title = allFav ? 'Moje obľúbené' : label ? `<span aria-hidden="true">${label.emoji}</span> ${escape(label.label)}` : 'Aktivity';
    const crumb = `${allFav ? '' : `${grade}. stupeň · `}${items.length} ${plural(items.length)}`;
    const empty = allFav ? 'Zatiaľ nemáš obľúbenú aktivitu. Pri aktivite ťukni na srdiečko a nájdeš ju tu.' : 'Pre tento výber zatiaľ nie sú pridané aktivity.';
    app.innerHTML = `<button class="back" data-action="${allFav?'home':'back'}">${icon('back')} ${allFav?'Späť na úvod':'Zmeniť výber'}</button><div class="list-head"><p class="crumb">${crumb}</p><h1 tabindex="-1">${title}</h1></div>${items.length ? `<ul class="activity-list">${items.map(a => `<li><button class="list-item" data-action="open" data-value="${escape(a.id)}"><span class="list-number">${number(a.id)}</span><span class="list-text"><strong>${escape(a.title)}</strong><small class="list-materials">${icon('bag')}<span>Pomôcky: ${escape(a.materials)}</span></small></span>${allFav ? `<span class="list-grade">${a.gradeLevel}. stupeň</span>` : ''}${icon('arrow')}</button></li>`).join('')}</ul>` : `<p class="intro">${empty}</p>`}`;
  }
  if (screen === 'empty') app.innerHTML = `<button class="back" data-action="back">${icon('back')} Zmeniť výber</button><div class="empty-icon">${icon(filter.kind==='favorites'?'heart':'search')}</div><h1 tabindex="-1">${filter.kind==='favorites'?'Tvoje obľúbené <em>ešte len prídu.</em>':'Tu je zatiaľ ticho.'}</h1><p class="intro">${filter.kind==='favorites'?'Pre tento stupeň zatiaľ nemáš obľúbenú aktivitu. Pri aktivite ťukni na srdiečko a nájdeš ju tu.':'Pre tento výber zatiaľ nie sú pridané aktivity.'}</p><button class="another" data-action="back">Vybrať aktivitu ${icon('arrow')}</button>`;
  if (focus) { app.querySelector('h1')?.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'}); }
}
function choose(duration = 0, another = false) {
  if (selecting) return;
  const pool = filterActivities(activities, grade, filter, favorites);
  // Favorites retain their original random selection; all displayed activities
  // still contribute to the shared history used by the other filters.
  const next = pickActivity(pool, current?.id, Math.random,
    filter.kind === 'favorites' ? {} : activityHistory.snapshot());
  const reveal = () => {
    current = next;
    screen = current ? 'activity' : 'empty';
    render();
    // Record only after reveal, never when a pending dice animation is cancelled.
    if (current) activityHistory.record(current.id);
    if (current && !reducedMotion.matches) {
      // Animate new content, so even consecutive activities with similar titles feel distinct.
      app.querySelectorAll('.activity-heading, .metadata, .steps, .another').forEach((element, index) => {
        element.animate(
          [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 220, delay: index * 30, easing: 'ease-out', fill: 'backwards' }
        );
      });
    }
    if (pool.length === 1) announce('V tomto výbere je zatiaľ jedna aktivita.');
  };
  // Empty and single-item pools do not pretend to roll for a different result.
  if (!duration || reducedMotion.matches || pool.length < 2) { reveal(); return; }
  selecting = true;
  clearTimeout(statusTimer);
  status.textContent = '';
  const content = document.createElement('div');
  content.className = 'selection-content';
  content.inert = true;
  content.setAttribute('aria-hidden', 'true');
  content.append(...app.childNodes);
  const overlay = document.createElement('div');
  overlay.className = 'selection-overlay';
  const label = another ? 'Vyberám ďalšiu aktivitu…' : 'Vyberám aktivitu…';
  overlay.innerHTML = `<div class="book-stage" aria-hidden="true"><div class="book"><span class="book-cover"></span>${[1,2,3,4,5].map(n => `<span class="page page-${n}"><i></i><i></i><i></i></span>`).join('')}</div></div><p role="status">${label}</p>`;
  app.append(content, overlay);
  app.classList.add('is-selecting');
  app.setAttribute('aria-busy', 'true');
  window.scrollTo({top:0,behavior:'instant'});
  selectionTimer = setTimeout(() => { status.textContent = ''; reveal(); }, duration);
}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && selecting) {
    clearTimeout(selectionTimer);
    selecting = false;
    status.textContent = '';
    choose();
  }
});
app.addEventListener('click', event => {
  if (selecting) return;
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const {action,value} = button.dataset;
  if (action==='grade') { grade=Number(value); save('rk-grade',grade); screen='choose'; render(); }
  else if (action==='back') { fromList=false; screen='choose'; render(); }
  else if (action==='list') { screen='list'; render(); }
  else if (action==='home') home();
  else if (action==='favorites-all') { fromList=false; filter={kind:'favorites-all'}; screen='list'; render(); }
  else if (action==='category') { fromList=false; filter={kind:'category',value}; screen='list'; render(); }
  else if (action==='open') { const a=activities.find(x=>x.id===value); if (a) { fromList=true; if (a.gradeLevel!==grade) { grade=a.gradeLevel; save('rk-grade',grade); } current=a; screen='activity'; render(); activityHistory.record(a.id); } }
  else if (action==='favorite') { const adding=!favorites.includes(current.id); favorites=adding?[...favorites,current.id]:favorites.filter(id=>id!==current.id); const saved=save('rk-favorites-v2',favorites); render(false); app.querySelector('.heart').focus(); if (saved) announce(adding?'Aktivita je medzi obľúbenými.':'Aktivita bola odstránená z obľúbených.'); }
  else if (action==='another') choose(800, true);
  else if (['all','favorites'].includes(action)) { fromList=false; filter={kind:action,value}; choose(action==='all' ? 900 : 0); }
});
function home() { screen='home'; render(); }
gradeButton.addEventListener('click', home);
document.querySelector('.logo').addEventListener('click', e=>{ e.preventDefault(); home(); });
async function init() {
  try { localStorage.removeItem('rk-favorites'); localStorage.removeItem('rk-activity-history'); } catch { /* Storage may be unavailable. */ }
  try { const response=await fetch('./activities.json'); if (!response.ok) throw new Error('Načítanie zlyhalo'); activities=validateActivities(await response.json()); app.setAttribute('aria-busy','false'); render(false); app.classList.add('welcome-enter'); }
  catch { app.setAttribute('aria-busy','false'); app.innerHTML='<h1>Aktivity sa nepodarilo načítať.</h1><p>Skontroluj pripojenie a skús to znova.</p><button class="another primary" id="retry">Skúsiť znova</button>'; document.querySelector('#retry').onclick=init; }
}
init();
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
