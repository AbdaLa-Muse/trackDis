(() => {
'use strict'

const CONFIG = window.TRADEFLOW_CONFIG || {}
const SESSION_KEY = 'tradeflow_cloud_session_v1'
const THEME_CACHE_KEY = 'tradeflow_cloud_theme_v1'
const LEGACY_REVIEWS_KEY = 'tradeflow_simple_reviews_v1'
const LEGACY_PREFS_KEY = 'tradeflow_simple_preferences_v1'
const LEGACY_THEME_KEY = 'tradeflow_simple_theme_v1'
const BACKUP_SCHEMA = 'tradeflow-supabase-backup'
const SCHEMA_VERSION = 11

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const now = new Date()
const state = {
  unlocked: false,
  reviews: [],
  accounts: [],
  accountRisks: [],
  trades: [],
  accountResets: [],
  goals: [],
  goalsError: '',
  weeklyNotes: {},
  weeklyNotesError: '',
  weeklyStart: mondayKey(new Date()),
  systemPeriodMode: 'this_week',
  systemCustomStart: '2026-10-22',
  systemCustomEnd: localDateKey(),
  settings: { officialStartDate: '2026-10-22', theme: 'dark' },
  draft: { risk: null, strategy: null, result: null, noTrade: false, trades: [] },
  reviewDate: localDateKey(),
  page: 'dashboard',
  range: '30',
  calendarMonth: new Date(now.getFullYear(), now.getMonth(), 1),
  filters: { result: 'all', discipline: 'all' },
  pendingImport: null,
  inactivityTimer: null,
}

function configReady() {
  return /^https:\/\/.+\.supabase\.co$/i.test(CONFIG.SUPABASE_URL || '') &&
    /^sb_(publishable|anon)_/i.test(CONFIG.SUPABASE_PUBLISHABLE_KEY || '')
}
function sessionToken() { return sessionStorage.getItem(SESSION_KEY) || '' }
function setSession(token) { if (token) sessionStorage.setItem(SESSION_KEY, token); else sessionStorage.removeItem(SESSION_KEY) }
function setSync(text, type = '') { const el = $('#syncStatus'); if (!el) return; el.textContent = text; el.className = `sync-pill ${type}` }
function showLoading(text = 'Loading TradeFlow…') { $('#loadingText').textContent = text; $('#loadingOverlay').classList.add('show') }
function hideLoading() { $('#loadingOverlay').classList.remove('show') }
function localDateKey(d = new Date()) { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}` }
function parseKey(k) { const [y,m,d]=String(k).split('-').map(Number); return new Date(y,m-1,d) }
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function mondayKey(d=new Date()){const x=new Date(d);x.setHours(0,0,0,0);const day=(x.getDay()+6)%7;return localDateKey(addDays(x,-day))}
function weekEndKey(start){return localDateKey(addDays(parseKey(start),6))}
function currentWeekStart(){return mondayKey(new Date())}
function clampWeekStart(k){const official=String(state?.settings?.officialStartDate||'2026-10-22');const first=mondayKey(parseKey(official));const cur=currentWeekStart();if(k<first)return first;if(k>cur)return cur;return k}
function isWeekendDate(d){const day=d.getDay();return day===0||day===6}
function validDateKey(k){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(k)))return false;const x=parseKey(k);return !Number.isNaN(x.getTime())&&localDateKey(x)===k}
function validDiscipline(v){return v==='followed'||v==='broke'}
function validSetup(v){return ['setup_1','setup_2','setup_3','setup_4'].includes(v)}
function setupShort(v){return v==='setup_1'?'Setup 1':v==='setup_2'?'Setup 2':v==='setup_3'?'Setup 3':v==='setup_4'?'Setup 4':'—'}
function setupLabel(v){return v==='setup_1'?'Setup 1 — 5M Break + Gap / Breaker Block':v==='setup_2'?'Setup 2 — 5M Inducement + Liquidity Sweep':v==='setup_3'?'Setup 3 — Consolidation Sweep + Structure Break':v==='setup_4'?'Setup 4 — Multi-Timeframe Alignment + Gap':'N/A'}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function accountById(id){return state.accounts.find(a=>a.id===id)||null}
function tradeOutcome(ret){const n=Number(ret);return !Number.isFinite(n)?null:n>1e-9?'win':n<-1e-9?'loss':'break_even'}
function normalizeTrade(x){
  if(!x||!x.account_id||!validDateKey(String(x.review_date||x.trade_date||'')))return null
  const risk=Number(x.risk_pct),ret=Number(x.trade_return_pct),order=Number(x.trade_order||x.sequence||1),setup=x.setup
  if(![1,2].includes(risk)||!Number.isFinite(ret)||(setup!=null&&!validSetup(setup)))return null
  return {id:x.id||null,review_date:String(x.review_date||x.trade_date),trade_order:Number.isInteger(order)&&order>0?order:1,account_id:String(x.account_id),risk_pct:risk,trade_return_pct:ret,setup,outcome:tradeOutcome(ret),violated:!!x.violated,violation_reasons:Array.isArray(x.violation_reasons)?x.violation_reasons:[],created_at:x.created_at||null,updated_at:x.updated_at||null}
}
function reviewTrades(date){return state.trades.filter(x=>x.review_date===date).sort((a,b)=>a.trade_order-b.trade_order||(a.created_at||'').localeCompare(b.created_at||''))}
function reviewAccountRisks(date){return reviewTrades(date)}
function normalizeAccountRisk(x){
  const risk=Number(x?.risk_pct),ret=x?.trade_return_pct==null?null:Number(x.trade_return_pct)
  return x&&x.account_id&&validDateKey(x.review_date)&&[1,2].includes(risk)?{account_id:x.account_id,review_date:x.review_date,risk_pct:risk,trade_return_pct:Number.isFinite(ret)?ret:null,violated:!!x.violated,created_at:x.created_at||null}:null
}
function normalizeAccount(a){if(!a||!a.id)return null;const size=Number(a.account_size);return {...a,account_size:Number.isFinite(size)&&size>0?size:null,active:a.active!==false}}
function normalizeReset(x){return x&&x.account_id&&validDateKey(x.reset_date)?{id:x.id||null,account_id:x.account_id,reset_date:x.reset_date,created_at:x.created_at||null,is_explicit:x.is_explicit===true}:null}
function normalizeGoal(g){
  if(!g||!g.id||!String(g.title||'').trim())return null
  const status=g.status==='completed'?'completed':'active'
  return {id:String(g.id),title:String(g.title).trim(),status,created_at:g.created_at||null,completed_at:g.completed_at||null}
}
function normalizeGoals(list){return (Array.isArray(list)?list:[]).map(normalizeGoal).filter(Boolean).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))}
function fmtGoalDate(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(d)}
function cycleNumberFromReturn(total){return Math.max(1,Math.floor(Number(total||0)/5)+3)}
function cycleLabel(n){return n<=1?'Very High Risk':n===2?'Danger Zone':n===3?'Caution':n===4?'Growth Zone':n===5?'Strong Growth':'Expansion'}
function cycleBasePct(n){return (Math.max(1,n)-3)*5}
function cycleText(n){return `Cycle ${n>=6?'6+':n} · ${cycleLabel(n)}`}
function accountTrackingStart(accountId,targetDate='9999-12-31'){
  const resets=state.accountResets.filter(x=>x.account_id===accountId&&x.is_explicit===true&&x.reset_date<=targetDate).sort((a,b)=>a.reset_date.localeCompare(b.reset_date)||(a.created_at||'').localeCompare(b.created_at||''));
  return resets.length?resets[resets.length-1].reset_date:null
}
function processTradeState(rows){
  let total=0,cycle=3,twoUsed=false
  for(const r of rows){
    const before=cycleNumberFromReturn(total);if(before!==cycle){cycle=before;twoUsed=false}
    if(Number(r.risk_pct)===2)twoUsed=true
    total+=Number(r.trade_return_pct||0)
    const after=cycleNumberFromReturn(total);if(after!==before){cycle=after;twoUsed=false}else cycle=before
  }
  cycle=cycleNumberFromReturn(total);const basePct=cycleBasePct(cycle),progressPct=total-basePct,bufferAvailable=progressPct>=2-1e-9
  return {totalReturn:total,cycle,basePct,progressPct,twoUsed,bufferAvailable,status:twoUsed?'Already Used':bufferAvailable?'Available':'Not Available',safeRisk:!twoUsed&&bufferAvailable?'1% or 2%':'1%'}
}
function accountRowsBefore(accountId,targetDate='9999-12-31',tradeOrder=Infinity,draftTrades=null){
  const resetDate=accountTrackingStart(accountId,targetDate)
  const saved=state.trades.filter(x=>x.account_id===accountId&&(!resetDate||x.review_date>=resetDate)&&(x.review_date<targetDate||(x.review_date===targetDate&&Number(x.trade_order)<tradeOrder)))
  let rows=saved
  if(Array.isArray(draftTrades)&&targetDate!=='9999-12-31'){
    rows=state.trades.filter(x=>x.account_id===accountId&&(!resetDate||x.review_date>=resetDate)&&x.review_date<targetDate)
    rows=rows.concat(draftTrades.map((x,i)=>({...x,trade_order:i+1,review_date:targetDate})).filter(x=>x.account_id===accountId&&x.trade_order<tradeOrder&&Number.isFinite(Number(x.trade_return_pct))))
  }
  return rows.sort((a,b)=>a.review_date.localeCompare(b.review_date)||Number(a.trade_order||1)-Number(b.trade_order||1)||(a.created_at||'').localeCompare(b.created_at||''))
}
function simulateAccount(accountId,targetDate='9999-12-31',excludeDate=null){
  const account=accountById(accountId);if(!account?.account_size)return {configured:false,totalReturn:0,cycle:3,basePct:0,progressPct:0,twoUsed:false,bufferAvailable:false,status:'Not Available',safeRisk:'1%'}
  const resetDate=accountTrackingStart(accountId,targetDate)
  const rows=state.trades.filter(x=>x.account_id===accountId&&(!resetDate||x.review_date>=resetDate)&&x.review_date<targetDate&&x.review_date!==excludeDate).sort((a,b)=>a.review_date.localeCompare(b.review_date)||a.trade_order-b.trade_order)
  return {configured:true,...processTradeState(rows)}
}
function simulateBeforeTrade(accountId,date,tradeOrder,draftTrades=null){
  const account=accountById(accountId);if(!account?.account_size)return {configured:false,totalReturn:0,cycle:3,basePct:0,progressPct:0,twoUsed:false,bufferAvailable:false,status:'Not Available',safeRisk:'1%'}
  return {configured:true,...processTradeState(accountRowsBefore(accountId,date,tradeOrder,draftTrades))}
}
function riskReasonsForTrade(x,date,tradeOrder=x.trade_order||1,draftTrades=null){
  const reasons=[],s=simulateBeforeTrade(x.account_id,date,tradeOrder,draftTrades)
  if(Number(x.risk_pct)===2){if(!s.bufferAvailable)reasons.push('2% risk used before 2% buffer was available.');if(s.twoUsed)reasons.push('2% risk was already used in this cycle.')}
  const ret=Number(x.trade_return_pct),risk=Number(x.risk_pct)
  if(Number.isFinite(ret)&&Number.isFinite(risk)&&ret<0&&Math.abs(ret)>risk+1e-9)reasons.push('Loss exceeded the selected risk percentage.')
  return reasons
}
function riskReasonsForSelection(x,date){return riskReasonsForTrade(x,date,x.trade_order||1,null)}
function draftRiskStatus(d=state.draft,date=localDateKey()){
  if(d.noTrade)return {risk:null,violation:false,reasons:[]}
  if(!Array.isArray(d.trades)||!d.trades.length)return {risk:null,violation:false,reasons:[]}
  const reasons=[];d.trades.forEach((x,i)=>reasons.push(...riskReasonsForTrade(x,date,i+1,d.trades)))
  const unique=[...new Set(reasons)];return {risk:unique.length?'broke':'followed',violation:!!unique.length,reasons:unique}
}
function paintRiskStatus(riskState,riskEl,warn){
  if(riskEl){riskEl.className=`overall ${riskState.risk==='broke'?'red':riskState.risk==='followed'?'green':'grey'}`;riskEl.innerHTML=riskState.risk==='broke'?'<i class="dot red"></i>Broke Rules':riskState.risk==='followed'?'<i class="dot green"></i>Followed':'<i class="dot grey"></i>N/A'}
  if(warn){warn.style.display=riskState.violation?'block':'none';warn.innerHTML=riskState.reasons.map(x=>`<div><strong>Reason:</strong> ${esc(x)}</div>`).join('')}
}
function accountRiskSummary(date){
  const rows=reviewTrades(date);if(!rows.length)return '—'
  return rows.map(x=>`${esc(accountById(x.account_id)?.name||'Archived account')} · Risk ${x.risk_pct}% · Return ${x.trade_return_pct>0?'+':''}${x.trade_return_pct}% · ${setupShort(x.setup)}`).join('<br>')
}
function normalizeReview(r){
  if(!r||!validDateKey(r.date))return null
  const result=['win','loss','break_even','no_trade'].includes(r.result)?r.result:null
  let risk=validDiscipline(r.risk)?r.risk:null,strategy=validDiscipline(r.strategy)?r.strategy:null
  let setup=validSetup(r.setup)?r.setup:null
  if(result==='no_trade'){risk=null;strategy=null;setup=null}
  if(result!=='no_trade'&&(!risk||!strategy))return null
  return {id:r.id||null,date:r.date,risk,strategy,setup,result,accountManaged:!!(r.account_managed??r.accountManaged),createdAt:r.created_at||r.createdAt||null,updatedAt:r.updated_at||r.updatedAt||null}
}
function normalizeReviews(list){const map=new Map();(Array.isArray(list)?list:[]).forEach(x=>{const r=normalizeReview(x);if(r)map.set(r.date,r)});return [...map.values()].sort((a,b)=>b.date.localeCompare(a.date))}
function getReview(date){return state.reviews.find(r=>r.date===date)||null}
function reviewDateKey(){return validDateKey(state.reviewDate)?state.reviewDate:localDateKey()}
function reviewDateAllowed(date){return validDateKey(date)&&date>=String(state.settings.officialStartDate||'2026-10-22')&&date<=localDateKey()}
function blankDraft(){return {risk:null,strategy:null,result:null,noTrade:false,trades:[]}}
function loadDraftForDate(date){
  if(!reviewDateAllowed(date))return false
  state.reviewDate=date
  const saved=getReview(date)
  if(!saved){state.draft=blankDraft();return true}
  const trades=reviewTrades(date).map(x=>({id:x.id,account_id:x.account_id,risk_pct:x.risk_pct,trade_return_pct:x.trade_return_pct,setup:x.setup}))
  state.draft={risk:saved.risk,strategy:saved.strategy,result:saved.result,noTrade:saved.result==='no_trade',trades}
  return true
}

async function rpc(name, args = {}) {
  if (!configReady()) throw new Error('Supabase is not configured yet.')
  let res
  try {
    res = await fetch(`${String(CONFIG.SUPABASE_URL).replace(/\/$/,'')}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        'apikey': CONFIG.SUPABASE_PUBLISHABLE_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(args)
    })
  } catch {
    throw new Error('Could not reach Supabase. Check your internet connection.')
  }
  const text = await res.text()
  let data = null
  if (text) { try { data = JSON.parse(text) } catch { data = text } }
  if (!res.ok) {
    const msg = data?.message || data?.hint || data?.details || 'TradeFlow request failed'
    if (/invalid or expired session/i.test(msg)) lockApp('Session expired. Enter your access code again.')
    throw new Error(msg)
  }
  resetInactivityTimer()
  return data
}

async function api(action, payload = {}) {
  const token = sessionToken()
  if (!token) throw new Error('TradeFlow is locked.')

  if (action === 'bootstrap') {
    return await rpc('tradeflow_bootstrap', { p_token: token })
  }
  if (action === 'set_theme') {
    return await rpc('tradeflow_set_theme', { p_token: token, p_theme: payload.theme })
  }
  if (action === 'upsert_review') {
    const r = payload.review
    return await rpc('tradeflow_upsert_review_v4', {p_token:token,p_date:r.date,p_strategy:r.strategy,p_no_trade:!!r.noTrade,p_trades:r.trades||[]})
  }
  if(action==='add_account') return await rpc('tradeflow_add_account_v3',{p_token:token,p_name:payload.name,p_account_size:payload.accountSize})
  if(action==='update_account') return await rpc('tradeflow_update_account_v3',{p_token:token,p_account_id:payload.id,p_name:payload.name,p_account_size:payload.accountSize})
  if(action==='set_account_stage') return await rpc('tradeflow_set_account_stage',{p_token:token,p_account_id:payload.id,p_stage:payload.stage})
  if(action==='reset_account') return await rpc('tradeflow_reset_account_v3',{p_token:token,p_account_id:payload.id})
  if(action==='archive_account') return await rpc('tradeflow_archive_account',{p_token:token,p_account_id:payload.id})
  if(action==='unarchive_account') return await rpc('tradeflow_unarchive_account',{p_token:token,p_account_id:payload.id})
  if (action === 'delete_review') {
    return await rpc('tradeflow_delete_review', { p_token: token, p_date: payload.date })
  }
  if (action === 'import_backup') {
    const rows = (payload.reviews || []).map(r=>({date:r.date,risk:r.risk,strategy:r.strategy,setup:r.setup||null,result:r.result}))
    return await rpc('tradeflow_import_v4', {p_token:token,p_reviews:rows,p_accounts:payload.accounts||[],p_trades:payload.trades||[],p_account_risks:payload.accountRisks||[],p_account_resets:payload.accountResets||[],p_theme:['dark','light'].includes(payload.theme)?payload.theme:null})
  }
  if (action === 'migrate_local') {
    const rows = (payload.reviews || []).map(r=>({date:r.date,risk:r.risk,strategy:r.strategy,setup:r.setup||null,result:r.result}))
    return await rpc('tradeflow_import', {p_token:token,p_reviews:rows,p_theme:['dark','light'].includes(payload.theme)?payload.theme:null})
  }
  if(action==='list_goals') return await rpc('tradeflow_list_goals',{p_token:token})
  if(action==='add_goal') return await rpc('tradeflow_add_goal',{p_token:token,p_title:payload.title})
  if(action==='complete_goal') return await rpc('tradeflow_complete_goal',{p_token:token,p_goal_id:payload.id})
  if(action==='delete_goal') return await rpc('tradeflow_delete_goal',{p_token:token,p_goal_id:payload.id})
  if(action==='get_weekly_notes') return await rpc('tradeflow_get_weekly_notes',{p_token:token,p_week_start:payload.weekStart})
  if(action==='save_weekly_notes') return await rpc('tradeflow_save_weekly_notes',{p_token:token,p_week_start:payload.weekStart,p_biggest_mistake:payload.biggestMistake||'',p_main_lesson:payload.mainLesson||'',p_next_week_focus:payload.nextWeekFocus||''})
  throw new Error('Unknown TradeFlow action')
}

function applyThemeLocal(theme){
  if(!['dark','light'].includes(theme))return
  document.documentElement.dataset.theme=theme
  try{localStorage.setItem(THEME_CACHE_KEY,theme)}catch{}
  renderThemeButtons()
}
async function applyTheme(theme, sync = true){
  const previous = document.documentElement.dataset.theme || 'dark'
  applyThemeLocal(theme)
  if(!sync || !state.unlocked)return
  try { setSync('Saving theme…','busy'); await api('set_theme',{theme}); state.settings.theme=theme; setSync('Synced','ok'); toast('Theme saved') }
  catch(e){ applyThemeLocal(previous); setSync('Sync error','error'); toast(e.message || 'Could not save theme') }
}

function unlockUi(){
  state.unlocked=true
  $('#authScreen').classList.add('hidden')
  $('.app').classList.remove('is-locked')
  $('.mobile-nav').classList.remove('is-locked')
  resetInactivityTimer()
}
function lockApp(message = ''){
  state.unlocked=false
  setSession('')
  clearTimeout(state.inactivityTimer)
  $('.app').classList.add('is-locked')
  $('.mobile-nav').classList.add('is-locked')
  $('#authScreen').classList.remove('hidden')
  $('#accessCode').value=''
  $('#authError').textContent=message
  setSync('Locked')
}
function resetInactivityTimer(){
  clearTimeout(state.inactivityTimer)
  if(!state.unlocked)return
  const minutes = Math.max(5, Number(CONFIG.AUTO_LOCK_MINUTES || 30))
  state.inactivityTimer = setTimeout(()=>lockApp('TradeFlow locked after inactivity.'), minutes*60*1000)
}
;['click','keydown','touchstart'].forEach(evt=>document.addEventListener(evt,()=>{if(state.unlocked)resetInactivityTimer()},{passive:true}))

async function unlockWithCode(code){
  if(!/^\d{4}$/.test(code)){ $('#authError').textContent='Enter a 4-digit code.'; return }
  $('#authError').textContent=''; $('#unlockBtn').disabled=true; $('#unlockBtn').textContent='Checking…'
  try{
    const result = await rpc('tradeflow_unlock', { p_code: code })
    if(!result?.ok || !result?.token) throw new Error(result?.message || 'Incorrect code')
    setSession(result.token)
    unlockUi()
    toast('Access granted')
    await bootstrap()
  }catch(e){
    $('#authError').textContent=e.message || 'Incorrect code'
  }finally{ $('#unlockBtn').disabled=false; $('#unlockBtn').textContent='Unlock TradeFlow' }
}

async function bootstrap(){
  showLoading('Loading TradeFlow…'); setSync('Syncing…','busy')
  try{
    const data = await api('bootstrap')
    state.reviews = normalizeReviews(data.reviews)
    state.accounts = (Array.isArray(data.accounts)?data.accounts:[]).map(normalizeAccount).filter(Boolean)
    state.trades = (Array.isArray(data.trades)?data.trades:[]).map(normalizeTrade).filter(Boolean).sort((a,b)=>a.review_date.localeCompare(b.review_date)||a.trade_order-b.trade_order)
    state.accountRisks = state.trades.map(x=>({account_id:x.account_id,review_date:x.review_date,risk_pct:x.risk_pct,trade_return_pct:x.trade_return_pct,violated:x.violated,trade_order:x.trade_order,setup:x.setup}))
    state.accountResets = (Array.isArray(data.account_resets)?data.account_resets:[]).map(normalizeReset).filter(Boolean)
    state.settings = {officialStartDate:data.settings?.official_start_date || '2026-10-22', theme:data.settings?.theme || 'dark'}
    if(!reviewDateAllowed(state.reviewDate))state.reviewDate=localDateKey()
    state.weeklyStart=clampWeekStart(state.weeklyStart||currentWeekStart())
    loadDraftForDate(state.reviewDate)
    try{state.goals=normalizeGoals(await api('list_goals'));state.goalsError=''}catch(goalErr){state.goals=[];state.goalsError=goalErr?.message||'Goals database update required'}
    applyThemeLocal(state.settings.theme)
    renderAll(); setSync('Synced','ok')
  }catch(e){
    setSync('Sync error','error'); toast(e.message || 'Could not load data')
  }finally{hideLoading()}
}

function validateDraft(data){
  if(!validDateKey(data.date))return {ok:false,msg:'Invalid date'}
  if(data.noTrade)return {ok:true,review:{date:data.date,strategy:null,noTrade:true,result:'no_trade',trades:[]}}
  if(!validDiscipline(data.strategy))return {ok:false,msg:'Choose Strategy'}
  const trades=Array.isArray(data.trades)?data.trades:[]
  if(!trades.length)return {ok:false,msg:'Add at least one trade or choose No Trade'}
  const out=[]
  for(let i=0;i<trades.length;i++){
    const x=trades[i],a=accountById(x.account_id),ret=Number(x.trade_return_pct),risk=Number(x.risk_pct)
    if(!a)return {ok:false,msg:`Choose an account for Trade ${i+1}`}
    if(!a.account_size)return {ok:false,msg:`Set Account Size for ${a.name} in Settings`}
    if(![1,2].includes(risk))return {ok:false,msg:`Choose 1% or 2% risk for Trade ${i+1}`}
    if(!Number.isFinite(ret))return {ok:false,msg:`Enter Trade Return % for Trade ${i+1}`}
    if(!validSetup(x.setup))return {ok:false,msg:`Choose a Setup for Trade ${i+1}`}
    out.push({id:x.id||null,trade_order:i+1,account_id:x.account_id,risk_pct:risk,trade_return_pct:ret,setup:x.setup})
  }
  const total=out.reduce((n,x)=>n+x.trade_return_pct,0),result=total>1e-9?'win':total<-1e-9?'loss':'break_even'
  return {ok:true,review:{date:data.date,strategy:data.strategy,noTrade:false,result,trades:out}}
}

async function saveReview(data){const v=validateDraft(data);if(!v.ok)throw new Error(v.msg);setSync('Saving…','busy');await api('upsert_review',{review:v.review});await bootstrap();setSync('Synced','ok');return getReview(v.review.date)}
async function deleteReview(date){
  setSync('Deleting…','busy'); await api('delete_review',{date}); await bootstrap(); setSync('Synced','ok')
}

function overall(r){if(!r)return {key:'none',label:'No Review',color:'grey'};if(r.result==='no_trade')return {key:'na',label:'N/A',color:'grey'};if(!validDiscipline(r.risk)||!validDiscipline(r.strategy))return {key:'na',label:'N/A',color:'grey'};if(r.risk==='followed'&&r.strategy==='followed')return {key:'perfect',label:'Perfect Day',color:'green'};if(r.risk==='broke'&&r.strategy==='broke')return {key:'poor',label:'Poor Discipline',color:'red'};return {key:'mixed',label:'Mixed Day',color:'orange'}}
function resultLabel(v){return v==='win'?'Win':v==='loss'?'Loss':v==='break_even'?'Break Even':v==='no_trade'?'No Trade':'Unrecorded'}
function resultBadge(v){return `<span class="badge ${v||'unrecorded'}">${resultLabel(v)}</span>`}
function reviewSetupText(date){const xs=[...new Set(reviewTrades(date).map(t=>t.setup).filter(validSetup))];return !xs.length?'—':xs.length===1?setupShort(xs[0]):`Multiple (${xs.length})`}
function rowClass(v){return v==='win'?'row-win':v==='loss'?'row-loss':v==='break_even'?'row-break_even':v==='no_trade'?'row-no_trade':''}
function applicableDisciplineReviews(list){return list.filter(r=>r.result!=='no_trade'&&validDiscipline(r.risk)&&validDiscipline(r.strategy))}
function reviewsForRange(range=state.range){if(range==='all')return [...state.reviews];const days=Number(range),start=addDays(new Date(),-(days-1));start.setHours(0,0,0,0);return state.reviews.filter(r=>parseKey(r.date)>=start)}
function disciplinePct(field,reviews){const applicable=reviews.filter(r=>r.result!=='no_trade'&&validDiscipline(r[field]));if(!applicable.length)return null;return Math.round(applicable.filter(r=>r[field]==='followed').length/applicable.length*100)}
function perfectCount(reviews){return reviews.filter(r=>overall(r).key==='perfect').length}
function minMaxReviewDates(){if(!state.reviews.length)return null;const dates=state.reviews.map(r=>r.date).sort();return {min:dates[0],max:dates[dates.length-1]}}
function currentDisciplineStreak(){const mm=minMaxReviewDates();if(!mm)return 0;let cursor=parseKey(mm.max),n=0;while(cursor>=parseKey(mm.min)){const r=getReview(localDateKey(cursor));if(!r){if(isWeekendDate(cursor)){cursor=addDays(cursor,-1);continue}break}if(r.result==='no_trade'){cursor=addDays(cursor,-1);continue}if(overall(r).key!=='perfect')break;n++;cursor=addDays(cursor,-1)}return n}
function disciplineStreaks(){const mm=minMaxReviewDates();if(!mm)return[];let d=parseKey(mm.min),end=parseKey(mm.max),cur=0,out=[];while(d<=end){const r=getReview(localDateKey(d));if(!r){if(!isWeekendDate(d)&&cur){out.push(cur);cur=0}}else if(r.result==='no_trade'){}else if(overall(r).key==='perfect'){cur++}else{if(cur){out.push(cur);cur=0}}d=addDays(d,1)}if(cur)out.push(cur);return out}
function bestDisciplineStreak(){const s=disciplineStreaks();return s.length?Math.max(...s):0}
function previousDisciplineStreak(){const s=disciplineStreaks();const current=currentDisciplineStreak();if(!s.length)return null;if(current>0&&s[s.length-1]===current)return s.length>1?s[s.length-2]:null;return s[s.length-1]||null}
function previousBestDisciplineStreak(){const s=disciplineStreaks().sort((a,b)=>b-a);return s.length>1?s[1]:null}
function setupPerformanceStats(){const stats={setup_1:{trades:0,wins:0,losses:0},setup_2:{trades:0,wins:0,losses:0},setup_3:{trades:0,wins:0,losses:0},setup_4:{trades:0,wins:0,losses:0}};for(const t of state.trades){if(!validSetup(t.setup))continue;stats[t.setup].trades++;if(t.outcome==='win')stats[t.setup].wins++;else if(t.outcome==='loss')stats[t.setup].losses++}for(const key of Object.keys(stats)){const x=stats[key],d=x.wins+x.losses;x.winRate=d?Math.round((x.wins/d*100)*10)/10:null}return stats}
function formatSetupWinRate(v){return v==null?'Win Rate —':`Win Rate ${Number.isInteger(v)?v:v.toFixed(1)}%`}
function performance(){const trading=[...state.trades].filter(t=>t.outcome==='win'||t.outcome==='loss').sort((a,b)=>b.review_date.localeCompare(a.review_date)||b.trade_order-a.trade_order);const wins=trading.filter(t=>t.outcome==='win').length,losses=trading.length-wins,breakEvens=state.trades.filter(t=>t.outcome==='break_even').length,winRate=trading.length?Math.round(wins/trading.length*100):0;let winStreak=0,lossStreak=0;if(trading[0]?.outcome==='win')for(const t of trading){if(t.outcome!=='win')break;winStreak++}if(trading[0]?.outcome==='loss')for(const t of trading){if(t.outcome!=='loss')break;lossStreak++}return {wins,losses,breakEvens,winRate,winStreak,lossStreak}}
function last30Summary(){let perfect=0,mixed=0,poor=0,none=0;for(let i=0;i<30;i++){const r=getReview(localDateKey(addDays(new Date(),-i))),o=overall(r);if(o.key==='perfect')perfect++;else if(o.key==='mixed')mixed++;else if(o.key==='poor')poor++;else none++}return {perfect,mixed,poor,none}}
function fmtDate(k,short=false){if(k===localDateKey())return 'Today';return new Intl.DateTimeFormat('en-GB',short?{day:'2-digit',month:'short'}:{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(parseKey(k))}
function fmtStartDate(k){return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(parseKey(k))}
function dotStatus(v){if(v==='followed')return `<span class="status-cell"><i class="dot green"></i><span>Followed</span></span>`;if(v==='broke')return `<span class="status-cell"><i class="dot red"></i><span>Broke Rules</span></span>`;return `<span class="status-cell"><i class="dot grey"></i><span>N/A</span></span>`}
function overallHtml(r){const o=overall(r);return `<span class="overall ${o.color}"><i class="dot ${o.color}"></i>${o.label}</span>`}
function rangeLabel(){return state.range==='all'?'All Time':`${state.range} Days`}
function windowReviews(startDaysAgo,endDaysAgo){const start=addDays(new Date(),-startDaysAgo),end=addDays(new Date(),-endDaysAgo);start.setHours(0,0,0,0);end.setHours(23,59,59,999);return state.reviews.filter(r=>{const d=parseKey(r.date);return d>=start&&d<=end})}
function monthReviews(offset=0){const d=new Date(),y=d.getFullYear(),m=d.getMonth()+offset;const start=new Date(y,m,1),end=new Date(y,m+1,0);return state.reviews.filter(r=>{const x=parseKey(r.date);return x>=start&&x<=end})}
function setTrend(id,text,type='neutral'){const el=$(id);if(!el)return;el.textContent=text;el.className=`trend ${type}`}
function signed(n,suffix=''){return `${n>0?'+':''}${n}${suffix}`}
function renderComparisonText(){
 const cur=currentDisciplineStreak(),prev=previousDisciplineStreak();
 if(prev==null)setTrend('#streakTrend',cur?'New streak':'No previous data','neutral');else{const d=cur-prev;setTrend('#streakTrend',`${signed(d,' days')} from last streak`,d>0?'positive':d<0?'negative':'neutral')}
 const best=bestDisciplineStreak(),prevBest=previousBestDisciplineStreak();
 if(prevBest==null)setTrend('#bestStreakTrend',best?'New best':'No previous data','neutral');else{const d=best-prevBest;setTrend('#bestStreakTrend',`${signed(d,' days')} from previous best`,d>0?'positive':d<0?'negative':'neutral')}
 const c30=windowReviews(29,0),p30=windowReviews(59,30);
 for(const [field,id] of [['risk','#riskTrend'],['strategy','#strategyTrend']]){const c=disciplinePct(field,c30),p=disciplinePct(field,p30);if(c==null||p==null)setTrend(id,'No previous data','neutral');else{const d=c-p;setTrend(id,`${signed(d,'%')} vs previous 30 days`,d>0?'positive':d<0?'negative':'neutral')}}
 const cm=perfectCount(monthReviews(0)),pm=perfectCount(monthReviews(-1));if(!state.reviews.length||pm===0&&cm===0)setTrend('#perfectTrend','No previous data','neutral');else{const d=cm-pm;setTrend('#perfectTrend',`${signed(d)} from last month`,d>0?'positive':d<0?'negative':'neutral')}
}

function dailyAggregateReturn(date){const vals=reviewAccountRisks(date).map(x=>Number(x.trade_return_pct)).filter(Number.isFinite);if(!vals.length)return null;return vals.reduce((a,b)=>a+b,0)/vals.length}
function weeklyIndividualReturns(rows){const byDate=new Map(rows.filter(r=>['win','loss','break_even'].includes(r.result)).map(r=>[r.date,r]));const out=[];for(const [date,r] of byDate){for(const x of reviewAccountRisks(date)){const ret=Number(x.trade_return_pct);if(!Number.isFinite(ret))continue;out.push({r,ret,account_id:x.account_id,account:accountById(x.account_id)||null})}}return out}
function weeklyStreaks(rows){let w=0,l=0,bw=0,bl=0;for(const r of rows){if(r.result==='win'){w++;l=0;bw=Math.max(bw,w)}else if(r.result==='loss'){l++;w=0;bl=Math.max(bl,l)}else if(r.result==='break_even'||r.result==='no_trade'){} }return {bestWin:bw,bestLoss:bl}}
function weeklyDisciplineBest(start,end){let cur=0,best=0;for(let d=parseKey(start);localDateKey(d)<=end;d=addDays(d,1)){const k=localDateKey(d);if(k<state.settings.officialStartDate||k>localDateKey())continue;const r=getReview(k);if(!r){if(!isWeekendDate(d))cur=0;continue}const o=overall(r);if(o.key==='perfect'){cur++;best=Math.max(best,cur)}else if(o.key==='mixed'||o.key==='poor')cur=0}return best}
function meaningfulSetupStats(rows){const map={};for(const r of rows){if(!validSetup(r.setup)||!['win','loss','break_even'].includes(r.result))continue;const x=map[r.setup]||(map[r.setup]={setup:r.setup,w:0,l:0,be:0,t:0});x.t++;if(r.result==='win')x.w++;else if(r.result==='loss')x.l++;else x.be++}return Object.values(map).map(x=>({...x,decisive:x.w+x.l,rate:(x.w+x.l)?x.w/(x.w+x.l):null})).filter(x=>x.decisive>=2)}
function analyzePeriod(start,end){
 const official=state.settings.officialStartDate||'2026-10-22',today=localDateKey();
 start=start<official?official:start;end=end>today?today:end;if(end<start)end=start;
 const rows=state.reviews.filter(r=>r.date>=start&&r.date<=end).sort((a,b)=>a.date.localeCompare(b.date));
 const tradeRows=rows.filter(r=>['win','loss','break_even'].includes(r.result));
 const wins=rows.filter(r=>r.result==='win').length,losses=rows.filter(r=>r.result==='loss').length,noTrade=rows.filter(r=>r.result==='no_trade').length,wr=(wins+losses)?Math.round(wins/(wins+losses)*100):null;
 const returns=tradeRows.map(r=>({r,ret:dailyAggregateReturn(r.date)})).filter(x=>Number.isFinite(x.ret));
 const net=returns.reduce((a,x)=>a+x.ret,0);
 const individualReturns=weeklyIndividualReturns(tradeRows);
 const best=individualReturns.length?individualReturns.reduce((a,b)=>b.ret>a.ret?b:a):null,worst=individualReturns.length?individualReturns.reduce((a,b)=>b.ret<a.ret?b:a):null;
 const streak=weeklyStreaks(rows),perfect=rows.filter(r=>overall(r).key==='perfect').length,riskViol=rows.filter(r=>r.risk==='broke').length,stratViol=rows.filter(r=>r.strategy==='broke').length,discBest=weeklyDisciplineBest(start,end),setupStats=meaningfulSetupStats(rows);
 let bestSetup=null,worstSetup=null;if(setupStats.length>=2){bestSetup=[...setupStats].sort((a,b)=>b.rate-a.rate||b.decisive-a.decisive)[0];worstSetup=[...setupStats].sort((a,b)=>a.rate-b.rate||b.decisive-a.decisive)[0]}
 const problems={};for(const r of rows){if(r.risk==='broke')problems['Risk Rules Broken']=(problems['Risk Rules Broken']||0)+1;if(r.strategy==='broke')problems['Strategy Rules Broken']=(problems['Strategy Rules Broken']||0)+1;for(const x of reviewAccountRisks(r.date)){for(const reason of riskReasonsForSelection(x,r.date,r.result)){let key=reason.includes('Loss exceeded')?'Loss exceeded selected risk':reason.includes('already used')?'2% Risk Already Used':reason.includes('before 2% buffer')?'2% Risk Before Buffer':'Risk Rule';problems[key]=(problems[key]||0)+1}}}
 const problemEntry=Object.entries(problems).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]||null;
 const trading=tradeRows.length,riskFollow=rows.filter(r=>r.result!=='no_trade'&&r.risk==='followed').length,stratFollow=rows.filter(r=>r.result!=='no_trade'&&r.strategy==='followed').length;
 let strength='No clear strength';if(trading&&stratFollow===trading)strength=`Strategy followed on ${stratFollow}/${trading} trading days`;else if(trading&&riskFollow===trading)strength=`Risk rules followed on ${riskFollow}/${trading} trading days`;else if(perfect>=2)strength=`${perfect} Perfect Days`;else if(bestSetup)strength=`Strong ${setupShort(bestSetup.setup)} performance`;
 const disciplineScore=trading?((riskFollow+stratFollow)/(trading*2))*100:50;let type='normal';if(rows.length&&net>0&&disciplineScore>=80&&riskViol<=1&&stratViol<=1)type='good';if((net<0&&disciplineScore<70)||(streak.bestLoss>=3)||(riskViol>=2)||(stratViol>=2))type='bad';
 const wentWell=[];if(perfect)wentWell.push(`${perfect} Perfect Day${perfect===1?'':'s'}`);if(streak.bestWin>=2)wentWell.push(`Best Win Streak: ${streak.bestWin}`);if(trading&&riskFollow===trading)wentWell.push('Risk discipline remained strong');if(trading&&stratFollow===trading)wentWell.push('Strategy followed on all trading days');if(bestSetup)wentWell.push(`${setupShort(bestSetup.setup)} performed best`);if(best&&best.ret>0)wentWell.push(`Best Trade: ${best.ret>0?'+':''}${best.ret.toFixed(1).replace(/\.0$/,'')}%`);if(!wentWell.length)wentWell.push('No clear strength in this period yet');
 const wentWrong=[];if(streak.bestLoss>=2)wentWrong.push(`Longest Losing Streak: ${streak.bestLoss}`);if(worst&&worst.ret<0)wentWrong.push(`Worst Trade: ${worst.ret.toFixed(1).replace(/\.0$/,'')}%`);if(riskViol)wentWrong.push(`${riskViol} Risk Violation${riskViol===1?'':'s'}`);if(stratViol)wentWrong.push(`Strategy broken ${stratViol} time${stratViol===1?'':'s'}`);if(problemEntry&&problemEntry[0]!=='Risk Rules Broken'&&problemEntry[0]!=='Strategy Rules Broken')wentWrong.push(`${problemEntry[0]} — ${problemEntry[1]} time${problemEntry[1]===1?'':'s'}`);if(!wentWrong.length)wentWrong.push('No major issues in this period');
 let headline='Mixed performance with a balanced period overall.';if(type==='good')headline='Strong discipline and positive performance were the main strengths in this period.';if(type==='bad')headline=`${streak.bestLoss>=3?`A ${streak.bestLoss}-loss streak and `:''}${riskViol?`${riskViol} risk violation${riskViol===1?'':'s'} were`:'performance weakness was'} the main problem${riskViol===1&&!streak.bestLoss?'':'s'} in this period.`;
 return {start,end,rows,tradeRows,individualReturns,wins,losses,noTrade,winRate:wr,net,best,worst,streak,perfect,riskViol,stratViol,discBest,bestSetup,worstSetup,problem:problemEntry?`${problemEntry[0]} — ${problemEntry[1]} time${problemEntry[1]===1?'':'s'}`:'No major recurring issue',strength,type,wentWell,wentWrong,headline}
}
function analyzeWeek(start){start=clampWeekStart(start);const rawEnd=weekEndKey(start),end=rawEnd>localDateKey()?localDateKey():rawEnd,official=state.settings.officialStartDate||'2026-10-22';const actualStart=start<official?official:start;return analyzePeriod(actualStart,end)}

function fmtPct(v){if(v==null||!Number.isFinite(Number(v)))return '—';const n=Number(v);return `${n>0?'+':''}${n.toFixed(1).replace(/\.0$/,'')}%`}
function fmtWeeklyTrade(x){if(!x)return '—';return `${fmtPct(x.ret)} · ${setupShort(x.r.setup)} · ${new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short'}).format(parseKey(x.r.date))}`}
function loadWeeklyNoteIntoForm(){const n=state.weeklyNotes[state.weeklyStart]||{};if($('#weeklyBiggestMistake'))$('#weeklyBiggestMistake').value=n.biggest_mistake||'';if($('#weeklyMainLesson'))$('#weeklyMainLesson').value=n.main_lesson||'';if($('#weeklyNextFocus'))$('#weeklyNextFocus').value=n.next_week_focus||''}
async function loadWeeklyNotes(){try{const n=await api('get_weekly_notes',{weekStart:state.weeklyStart});state.weeklyNotes[state.weeklyStart]=n||{};state.weeklyNotesError='';loadWeeklyNoteIntoForm()}catch(e){state.weeklyNotesError=e?.message||'Weekly notes database update required';state.weeklyNotes[state.weeklyStart]={};loadWeeklyNoteIntoForm()}}
async function saveWeeklyNotes(){try{const b=$('#weeklySaveNotesBtn');if(b)b.disabled=true;await api('save_weekly_notes',{weekStart:state.weeklyStart,biggestMistake:$('#weeklyBiggestMistake')?.value.trim()||'',mainLesson:$('#weeklyMainLesson')?.value.trim()||'',nextWeekFocus:$('#weeklyNextFocus')?.value.trim()||''});await loadWeeklyNotes();toast('Weekly notes saved')}catch(e){toast(e.message||'Could not save weekly notes')}finally{if($('#weeklySaveNotesBtn'))$('#weeklySaveNotesBtn').disabled=false}}
function weeklyTradeParts(x){if(!x)return {value:'—',meta:'—'};const r=x.r||{},ret=Number(x.ret);const value=Number.isFinite(ret)?fmtPct(ret):'—';const account=x.account?.name||accountById(x.account_id)?.name||'';const setup=r.setup?setupShort(r.setup):'No Setup';const date=r.date?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short'}).format(parseKey(r.date)):'—';return {value,meta:[account,setup,date].filter(Boolean).join(' · ')}}

function buildNextPeriodFocus(a){
 const rows=a.rows||[],trading=a.tradeRows?.length||0;
 const specific={loss_exceeded:0,two_before:0,two_used:0};
 for(const r of rows){
  if(!['win','loss','break_even'].includes(r.result))continue;
  for(const x of reviewAccountRisks(r.date))for(const reason of riskReasonsForSelection(x,r.date,r.result)){
   if(reason.includes('Loss exceeded'))specific.loss_exceeded++;
   else if(reason.includes('before 2% buffer'))specific.two_before++;
   else if(reason.includes('already used'))specific.two_used++;
  }
 }
 const setupMap={};for(const r of rows){if(!validSetup(r.setup)||!['win','loss'].includes(r.result))continue;const x=setupMap[r.setup]||(setupMap[r.setup]={setup:r.setup,w:0,l:0,t:0});x.t++;if(r.result==='win')x.w++;else x.l++}
 const setupProblems=Object.values(setupMap).filter(x=>x.t>=2&&x.l>=2&&x.l/x.t>=.5).sort((a,b)=>b.l-a.l||b.t-a.t);
 const candidates=[];
 const add=(key,title,count,severity,reason,action)=>{if(count>0)candidates.push({key,title,count,severity,score:severity+(Math.min(count,5)-1)*12,reason,action})};
 add('loss_exceeded','Risk Control',specific.loss_exceeded,100,`${specific.loss_exceeded} loss${specific.loss_exceeded===1?'':'es'} exceeded the selected risk percentage during this period.`,'Keep every loss within the selected risk percentage.');
 add('two_before','2% Risk Discipline',specific.two_before,95,`2% risk was used before the required buffer ${specific.two_before} time${specific.two_before===1?'':'s'}.`,'Use 2% risk only when the 2% buffer is available.');
 add('two_used','2% Risk Discipline',specific.two_used,92,`2% risk was reused in the same cycle ${specific.two_used} time${specific.two_used===1?'':'s'}.`,'Use 2% risk only once per cycle.');
 const unexplainedRisk=Math.max(0,(a.riskViol||0)-Math.max(specific.loss_exceeded,specific.two_before,specific.two_used));
 add('risk','Risk Management',unexplainedRisk,82,`Risk rules were broken on ${unexplainedRisk} review${unexplainedRisk===1?'':'s'}.`,'Keep every trade within the active risk rules.');
 add('strategy','Strategy Discipline',a.stratViol||0,75,`Strategy rules were broken ${a.stratViol||0} time${a.stratViol===1?'':'s'}.`,'Only take trades that fully meet the strategy rules.');
 if((a.streak?.bestLoss||0)>=3)add('loss_streak','Loss-Streak Control',a.streak.bestLoss,68,`A ${a.streak.bestLoss}-loss streak occurred during this period.`,'After consecutive losses, require full strategy and risk compliance before the next trade.');
 if(setupProblems[0]){const x=setupProblems[0];add('setup',`${setupShort(x.setup)} Consistency`,x.l,58,`${setupShort(x.setup)} recorded ${x.l} losses across ${x.t} decisive trades.`,'Review this setup against its rules before increasing its use.');}
 if(trading>=3&&a.perfect/trading<.5)add('discipline','Discipline Consistency',trading-a.perfect,54,`Only ${a.perfect} of ${trading} trading days were Perfect Days.`,'Increase the share of trading days with both Risk and Strategy followed.');
 candidates.sort((x,y)=>y.score-x.score||y.count-x.count||x.title.localeCompare(y.title));
 const top=candidates[0]||null;
 const repeated=[];
 if(specific.loss_exceeded>=2)repeated.push(`Loss exceeded selected risk — ${specific.loss_exceeded} times`);
 if(specific.two_before>=2)repeated.push(`2% risk before buffer — ${specific.two_before} times`);
 if(specific.two_used>=2)repeated.push(`2% risk already used in cycle — ${specific.two_used} times`);
 if((a.stratViol||0)>=2)repeated.push(`Strategy rules broken — ${a.stratViol} times`);
 if((a.riskViol||0)>=2&&!specific.loss_exceeded&&!specific.two_before&&!specific.two_used)repeated.push(`Risk rules broken — ${a.riskViol} reviews`);
 if((a.streak?.bestLoss||0)>=3)repeated.push(`Longest Losing Streak — ${a.streak.bestLoss} losses`);
 for(const x of setupProblems.slice(0,2))repeated.push(`${setupShort(x.setup)} — ${x.l} losses in ${x.t} decisive trades`);
 const improve=[];
 const riskCompliance=trading?Math.round(rows.filter(r=>r.result!=='no_trade'&&r.risk==='followed').length/trading*100):null;
 const strategyCompliance=trading?Math.round(rows.filter(r=>r.result!=='no_trade'&&r.strategy==='followed').length/trading*100):null;
 const perfectRate=trading?Math.round(a.perfect/trading*100):null;
 if(riskCompliance!=null&&riskCompliance<100)improve.push(`Improve Risk compliance from ${riskCompliance}% toward full consistency`);
 if(strategyCompliance!=null&&strategyCompliance<100)improve.push(`Improve Strategy compliance from ${strategyCompliance}% toward full consistency`);
 if(perfectRate!=null&&perfectRate<80)improve.push(`Increase Perfect Day consistency (${a.perfect}/${trading} trading days)`);
 if(trading>=3&&(a.discBest||0)<Math.min(3,trading))improve.push(`Build a longer discipline streak (best: ${a.discBest} day${a.discBest===1?'':'s'})`);
 if(a.winRate!=null&&a.wins+a.losses>=3&&a.winRate<50)improve.push(`Improve decided-trade Win Rate from ${a.winRate}%`);
 if((a.streak?.bestLoss||0)>(a.streak?.bestWin||0)&&a.streak.bestLoss>=2)improve.push(`Reduce losing-streak length relative to the best win streak`);
 if(a.type==='good'){
  if(riskCompliance===100)improve.push('Maintain full Risk Management compliance');
  if(strategyCompliance===100)improve.push('Maintain full Strategy compliance');
  if((a.discBest||0)>=2)improve.push(`Extend the ${a.discBest}-day best discipline streak`);
  if(a.bestSetup)improve.push(`Maintain consistency on ${setupShort(a.bestSetup.setup)}`);
 }
 const uniqueImprove=[...new Set(improve)].slice(0,4);
 if(!uniqueImprove.length)uniqueImprove.push(trading?'Maintain current risk and strategy discipline':'Build a larger sample with fully compliant reviews');
 return {fixTitle:top?top.title:'No critical issue',fixReason:top?top.reason:'No major issue was detected in the selected period.',fixAction:top?top.action:'Maintain disciplined risk and strategy execution.',fixKey:top?top.key:null,repeated:repeated.length?repeated.slice(0,5):['No major recurring problems'],improve:uniqueImprove,specific,setupProblems,riskCompliance,strategyCompliance,perfectRate};
}


function progressPreviousPeriod(cfg){
 const official=state.settings.officialStartDate||'2026-10-22';
 let start,end;
 if(cfg.mode==='custom'){
  const days=Math.max(1,Math.round((parseKey(cfg.end)-parseKey(cfg.start))/86400000)+1);
  end=localDateKey(addDays(parseKey(cfg.start),-1));
  start=localDateKey(addDays(parseKey(end),-(days-1)));
 }else if(cfg.mode==='previous_week'){
  const currentStart=currentWeekStart();start=localDateKey(addDays(parseKey(currentStart),-14));end=localDateKey(addDays(parseKey(start),6));
 }else{
  const currentStart=currentWeekStart();start=localDateKey(addDays(parseKey(currentStart),-7));end=localDateKey(addDays(parseKey(start),6));
 }
 if(start<official||end<official)return null;
 return {start,end};
}
function progressStatusLower(prev,current){if(prev>0&&current===0)return 'Fixed';if(current<prev)return 'Improved';if(current>prev)return 'Worsened';return 'No Improvement'}
function progressStatusHigher(prev,current){if(current>prev)return 'Improved';if(current<prev)return 'Worsened';return 'No Improvement'}
function progressClass(status){return status.toLowerCase().replaceAll(' ','-')}
function setupPeriodMap(a){const map={};for(const r of a.rows||[]){if(!validSetup(r.setup)||!['win','loss'].includes(r.result))continue;const x=map[r.setup]||(map[r.setup]={setup:r.setup,w:0,l:0,t:0});x.t++;if(r.result==='win')x.w++;else x.l++}for(const x of Object.values(map))x.lossRate=x.t?x.l/x.t:null;return map}
function buildProgressFromPrevious(prev,current){
 if(!prev||!(prev.rows||[]).length)return {available:false,overall:'Not enough previous data',items:[]};
 const pf=buildNextPeriodFocus(prev),cf=buildNextPeriodFocus(current),items=[],seen=new Set();
 const add=(key,title,status,previous,currentValue,note='')=>{if(seen.has(key))return;seen.add(key);items.push({key,title,status,previous,current:currentValue,note})};
 const problem=(key,title,pv,cv,fmt=v=>String(v),note='')=>{if(pv<=0)return;const status=progressStatusLower(pv,cv);add(key,title,status,fmt(pv),fmt(cv),status==='No Improvement'&&pv>0?`${note?note+' · ':''}Recurring Issue`:note)};
 problem('loss_exceeded','Loss Control',pf.specific.loss_exceeded,cf.specific.loss_exceeded,v=>`${v} violation${v===1?'':'s'}`);
 problem('two_before','2% Buffer Discipline',pf.specific.two_before,cf.specific.two_before,v=>`${v} violation${v===1?'':'s'}`);
 problem('two_used','2% Cycle Discipline',pf.specific.two_used,cf.specific.two_used,v=>`${v} violation${v===1?'':'s'}`);
 const prevSpecific=pf.specific.loss_exceeded+pf.specific.two_before+pf.specific.two_used,curSpecific=cf.specific.loss_exceeded+cf.specific.two_before+cf.specific.two_used;
 if((prev.riskViol||0)>0&&prevSpecific===0)problem('risk','Risk Control',prev.riskViol||0,current.riskViol||0,v=>`${v} review${v===1?'':'s'}`);
 problem('strategy','Strategy Discipline',prev.stratViol||0,current.stratViol||0,v=>`${v} violation${v===1?'':'s'}`);
 if((prev.streak?.bestLoss||0)>=2)problem('loss_streak','Losing Streak Control',prev.streak.bestLoss,current.streak?.bestLoss||0,v=>`${v} loss${v===1?'':'es'}`);
 const pSetup=setupPeriodMap(prev),cSetup=setupPeriodMap(current);
 for(const x of pf.setupProblems||[]){const c=cSetup[x.setup];if(!c||c.t<2)continue;const prevRate=x.t?x.l/x.t:0,curRate=c.lossRate;let status=curRate<prevRate?'Improved':curRate>prevRate?'Worsened':'No Improvement';if(c.l===0&&x.l>0)status='Fixed';add(`setup_${x.setup}`,`${setupShort(x.setup)} Consistency`,status,`${x.l}/${x.t} losses`,`${c.l}/${c.t} losses`,status==='No Improvement'?'Recurring Issue':'') }
 const prevTrading=prev.tradeRows?.length||0,curTrading=current.tradeRows?.length||0;
 const prevPerfectRate=prevTrading?Math.round(prev.perfect/prevTrading*100):null,curPerfectRate=curTrading?Math.round(current.perfect/curTrading*100):null;
 if(prevPerfectRate!=null&&prevPerfectRate<80&&curPerfectRate!=null)add('perfect','Perfect Day Consistency',progressStatusHigher(prevPerfectRate,curPerfectRate),`${prevPerfectRate}% (${prev.perfect}/${prevTrading})`,`${curPerfectRate}% (${current.perfect}/${curTrading})`);
 if(prevTrading>=3&&(prev.discBest||0)<Math.min(3,prevTrading))add('discipline_streak','Discipline Consistency',progressStatusHigher(prev.discBest||0,current.discBest||0),`${prev.discBest||0} day${prev.discBest===1?'':'s'}`,`${current.discBest||0} day${current.discBest===1?'':'s'}`);
 if(prev.winRate!=null&&(prev.wins+prev.losses)>=3&&prev.winRate<50&&current.winRate!=null)add('win_rate','Win Rate',progressStatusHigher(prev.winRate,current.winRate),`${prev.winRate}%`,`${current.winRate}%`);
 if(Number.isFinite(prev.net)&&prev.net<0&&Number.isFinite(current.net))add('performance','Performance',progressStatusHigher(prev.net,current.net),fmtPct(prev.net),fmtPct(current.net),'Net Return comparison; discipline is evaluated separately.');
 if(prev.type==='good'){if(pf.riskCompliance===100)add('maintain_risk','Risk Discipline',cf.riskCompliance===100?'Maintained':'Worsened','100%',cf.riskCompliance==null?'—':`${cf.riskCompliance}%`);if(pf.strategyCompliance===100)add('maintain_strategy','Strategy Discipline',cf.strategyCompliance===100?'Maintained':'Worsened','100%',cf.strategyCompliance==null?'—':`${cf.strategyCompliance}%`)}
 // Put the previous Fix First at the front, then other repeated/improvement signals.
 const keyMap={loss_exceeded:'loss_exceeded',two_before:'two_before',two_used:'two_used',risk:'risk',strategy:'strategy',loss_streak:'loss_streak',discipline:'perfect'};
 const primary=pf.fixKey?keyMap[pf.fixKey]:null;if(primary){const i=items.findIndex(x=>x.key===primary);if(i>0)items.unshift(items.splice(i,1)[0])}
 const statuses=items.map(x=>x.status),fixed=statuses.filter(x=>x==='Fixed').length,improved=statuses.filter(x=>x==='Improved').length,worsened=statuses.filter(x=>x==='Worsened').length,no=statuses.filter(x=>x==='No Improvement').length,maintained=statuses.filter(x=>x==='Maintained').length;
 let overall='No Improvement';if(items.length===0)overall='Maintained';else if(worsened&&!(fixed||improved))overall='Worsened';else if(worsened&&(fixed||improved))overall='Mixed Progress';else if((fixed+improved)>=2&&fixed>=Math.ceil((fixed+improved)/2))overall='Strong Improvement';else if(fixed||improved)overall='Improving';else if(maintained&&!no)overall='Maintained';
 return {available:true,overall,items:items.slice(0,6)};
}
function renderProgressFromPrevious(cfg,current){
 const grid=$('#progressPeriodGrid'),empty=$('#progressPeriodEmpty'),overallEl=$('#progressOverall'),range=$('#progressRangeLabel');if(!grid||!empty||!overallEl)return;
 const pcfg=progressPreviousPeriod(cfg),fmt=k=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(parseKey(k));
 if(!pcfg){grid.innerHTML='';empty.style.display='block';empty.textContent='Not enough previous data for comparison yet.';overallEl.textContent='Not enough previous data';overallEl.className='progress-overall neutral';if(range)range.textContent='';return}
 const prev=analyzePeriod(pcfg.start,pcfg.end),progress=buildProgressFromPrevious(prev,current);if(range)range.textContent=`Previous: ${fmt(pcfg.start)} – ${fmt(pcfg.end)} · Current: ${fmt(current.start)} – ${fmt(current.end)}`;
 if(!progress.available){grid.innerHTML='';empty.style.display='block';empty.textContent='Not enough previous data for comparison yet.';overallEl.textContent='Not enough previous data';overallEl.className='progress-overall neutral';return}
 empty.style.display='none';overallEl.textContent=`Overall Progress: ${progress.overall}`;overallEl.className=`progress-overall ${progress.overall==='Strong Improvement'?'strong':progress.overall==='Improving'||progress.overall==='Maintained'?'improving':progress.overall==='Worsened'?'worsened':progress.overall==='Mixed Progress'?'mixed':'neutral'}`;
 if(!progress.items.length){grid.innerHTML='<div class="progress-empty">No previous focus issue requires comparison. Current strengths are being maintained.</div>';return}
 grid.innerHTML=progress.items.map(x=>`<div class="progress-item ${progressClass(x.status)}"><div class="progress-item-top"><h4>${esc(x.title)}</h4><span class="progress-status">${esc(x.status)}</span></div><div class="progress-values"><div><span>Previous</span><strong>${esc(x.previous)}</strong></div><div><span>Current</span><strong>${esc(x.current)}</strong></div></div>${x.note?`<div class="progress-note ${x.note.includes('Recurring')?'progress-recurring':''}">${esc(x.note)}</div>`:''}</div>`).join('');
}

function weeklyPresentationScores(a){const wr=a.winRate==null?50:a.winRate;const netScore=Math.max(0,Math.min(100,50+(a.net*8)));const lossPenalty=Math.min(25,a.streak.bestLoss*6);const performance=Math.round(Math.max(0,Math.min(100,(wr*.55)+(netScore*.45)-lossPenalty)));const trading=Math.max(1,a.tradeRows.length);const perfectRate=(a.perfect/trading)*100;const violationPenalty=Math.min(55,(a.riskViol+a.stratViol)*12);const streakBonus=Math.min(15,a.discBest*3);const discipline=Math.round(Math.max(0,Math.min(100,(perfectRate*.65)+35-violationPenalty+streakBonus)));return {performance,discipline}}
function systemPeriodConfig(){
 const today=localDateKey(),official=state.settings.officialStartDate||'2026-10-22';
 if(state.systemPeriodMode==='previous_week'){
  const s=clampWeekStart(localDateKey(addDays(parseKey(currentWeekStart()),-7))),e=weekEndKey(s)>today?today:weekEndKey(s);return {mode:'previous_week',label:'Previous Week',start:s<official?official:s,end:e};
 }
 if(state.systemPeriodMode==='custom'){
  let s=state.systemCustomStart||official,e=state.systemCustomEnd||today;if(s<official)s=official;if(e>today)e=today;if(e<s)e=s;return {mode:'custom',label:'Custom Range',start:s,end:e};
 }
 const s=currentWeekStart(),e=weekEndKey(s)>today?today:weekEndKey(s);return {mode:'this_week',label:'This Week',start:s<official?official:s,end:e};
}
function previousEquivalentPeriod(cfg){
 const days=Math.max(1,Math.round((parseKey(cfg.end)-parseKey(cfg.start))/86400000)+1),prevEnd=localDateKey(addDays(parseKey(cfg.start),-1)),prevStart=localDateKey(addDays(parseKey(prevEnd),-(days-1))),official=state.settings.officialStartDate||'2026-10-22';
 if(prevEnd<official)return null;return {start:prevStart<official?official:prevStart,end:prevEnd};
}
function setSystemCustomBounds(){const official=state.settings.officialStartDate||'2026-10-22',today=localDateKey(),from=$('#systemCustomFrom'),to=$('#systemCustomTo');if(!from||!to)return;from.min=official;from.max=today;to.min=official;to.max=today;from.value=state.systemCustomStart<official?official:state.systemCustomStart;to.value=state.systemCustomEnd>today?today:state.systemCustomEnd}
function renderWeeklyAnalysis(){
 if(!$('#weeklyRangeLabel'))return;
 const cfg=systemPeriodConfig();state.weeklyStart=mondayKey(parseKey(cfg.start));
 const a=analyzePeriod(cfg.start,cfg.end),prevCfg=previousEquivalentPeriod(cfg),prev=prevCfg?analyzePeriod(prevCfg.start,prevCfg.end):null,hasPrev=!!prevCfg;
 const fmtRangeDate=k=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(parseKey(k));
 $('#weeklyRangeLabel').textContent=`${fmtRangeDate(a.start)} – ${fmtRangeDate(a.end)}`;if($('#systemPeriodCaption'))$('#systemPeriodCaption').textContent=cfg.label;
 if($('#systemPeriodMode'))$('#systemPeriodMode').value=cfg.mode;const cr=$('#systemCustomRange');if(cr)cr.classList.toggle('active',cfg.mode==='custom');setSystemCustomBounds();
 $('#weeklyRangeNote').textContent=a.rows.length?`${a.rows.length} recorded day${a.rows.length===1?'':'s'}`:'No reviews recorded';
 const t=$('#weeklyType'),summary=$('#weeklySummaryCard'),periodWord=cfg.mode==='custom'?'Period':'Week';t.className=`week-type ${a.type}`;t.textContent=`${a.type==='good'?'Good':a.type==='bad'?'Bad':'Normal'} ${periodWord}`;if(summary)summary.className=`weekly-summary-card ${a.type}`;const weeklyPage=$('#weekly');if(weeklyPage)weeklyPage.dataset.weekType=a.type;const icon=$('#weeklyTypeIcon');if(icon)icon.textContent=a.type==='good'?'↗':a.type==='bad'?'▥':'⚖';$('#weeklyHeadline').textContent=a.headline;
 const scores=weeklyPresentationScores(a);if($('#weeklyPerformanceScore'))$('#weeklyPerformanceScore').textContent=`${scores.performance}%`;if($('#weeklyDisciplineScore'))$('#weeklyDisciplineScore').textContent=`${scores.discipline}%`;if($('#weeklyPerformanceRing'))$('#weeklyPerformanceRing').style.setProperty('--score',scores.performance);if($('#weeklyDisciplineRing'))$('#weeklyDisciplineRing').style.setProperty('--score',scores.discipline);
 $('#weeklyNetReturn').textContent=fmtPct(a.net);$('#weeklyWinRate').textContent=a.winRate==null?'—':`${a.winRate}%`;$('#weeklyTradingDays').textContent=a.tradeRows.length;$('#weeklyNoTradeDays').textContent=a.noTrade;
 const bp=weeklyTradeParts(a.best),wp=weeklyTradeParts(a.worst);$('#weeklyBestTrade').textContent=bp.value;$('#weeklyWorstTrade').textContent=wp.value;if($('#weeklyBestTradeMeta'))$('#weeklyBestTradeMeta').textContent=bp.meta;if($('#weeklyWorstTradeMeta'))$('#weeklyWorstTradeMeta').textContent=wp.meta;if($('#weeklyBestTradeDetail'))$('#weeklyBestTradeDetail').textContent=bp.value;if($('#weeklyWorstTradeDetail'))$('#weeklyWorstTradeDetail').textContent=wp.value;if($('#weeklyBestTradeDetailMeta'))$('#weeklyBestTradeDetailMeta').textContent=bp.meta;if($('#weeklyWorstTradeDetailMeta'))$('#weeklyWorstTradeDetailMeta').textContent=wp.meta;
 $('#weeklyWinStreak').textContent=String(a.streak.bestWin);$('#weeklyLossStreak').textContent=String(a.streak.bestLoss);if($('#weeklyWinStreakDetail'))$('#weeklyWinStreakDetail').textContent=String(a.streak.bestWin);if($('#weeklyLossStreakDetail'))$('#weeklyLossStreakDetail').textContent=String(a.streak.bestLoss);$('#weeklyBestReturn').textContent=a.best?fmtPct(a.best.ret):'—';$('#weeklyWorstReturn').textContent=a.worst?fmtPct(a.worst.ret):'—';$('#weeklyDisciplineStreak').textContent=String(a.discBest);if($('#weeklyDisciplineStreakDetail'))$('#weeklyDisciplineStreakDetail').textContent=String(a.discBest);$('#weeklyPerfectDays').textContent=a.perfect;if($('#weeklyPerfectDaysDetail'))$('#weeklyPerfectDaysDetail').textContent=a.perfect;const tradingText=`out of ${a.tradeRows.length} trading day${a.tradeRows.length===1?'':'s'}`;if($('#weeklyPerfectDaysMeta'))$('#weeklyPerfectDaysMeta').textContent=tradingText;if($('#weeklyPerfectDaysDetailMeta'))$('#weeklyPerfectDaysDetailMeta').textContent=tradingText;$('#weeklyRiskViolations').textContent=a.riskViol;$('#weeklyStrategyViolations').textContent=a.stratViol;if($('#weeklyRiskViolationsDetail'))$('#weeklyRiskViolationsDetail').textContent=a.riskViol;if($('#weeklyStrategyViolationsDetail'))$('#weeklyStrategyViolationsDetail').textContent=a.stratViol;
 $('#weeklyBestSetup').textContent=a.bestSetup?`${setupShort(a.bestSetup.setup)} · ${Math.round(a.bestSetup.rate*100)}%`:'—';$('#weeklyWorstSetup').textContent=a.worstSetup?`${setupShort(a.worstSetup.setup)} · ${Math.round(a.worstSetup.rate*100)}%`:'—';$('#weeklyProblem').textContent=a.problem;$('#weeklyStrength').textContent=a.strength;$('#weeklyWentWell').innerHTML=a.wentWell.map(x=>`<li>${esc(x)}</li>`).join('');$('#weeklyWentWrong').innerHTML=a.wentWrong.map(x=>`<li>${esc(x)}</li>`).join('');
 renderProgressFromPrevious(cfg,a);
 const focus=buildNextPeriodFocus(a);if($('#focusFixTitle'))$('#focusFixTitle').textContent=focus.fixTitle;if($('#focusFixReason'))$('#focusFixReason').textContent=focus.fixReason;if($('#focusFixAction'))$('#focusFixAction').textContent=`Next focus: ${focus.fixAction}`;if($('#focusRepeated'))$('#focusRepeated').innerHTML=focus.repeated.map(x=>`<li>${esc(x)}</li>`).join('');if($('#focusImprove'))$('#focusImprove').innerHTML=focus.improve.map(x=>`<li>${esc(x)}</li>`).join('');
 const ce=$('#weeklyCompareEmpty'),cc=$('#weeklyCompare'),ch=$('.weekly-compare-head h3');if(ch)ch.textContent=cfg.mode==='custom'?'Period vs Previous Period':'Week vs Previous Week';if(!hasPrev){ce.style.display='block';ce.textContent=cfg.mode==='custom'?'No previous period available':'No previous week available';cc.innerHTML=''}else{ce.style.display='none';const items=[['Net Return',fmtPct(a.net),fmtPct(prev.net)],['Win Rate',a.winRate==null?'—':`${a.winRate}%`,prev.winRate==null?'—':`${prev.winRate}%`],['Risk Violations',String(a.riskViol),String(prev.riskViol)],['Best Discipline Streak',String(a.discBest),String(prev.discBest)]];cc.innerHTML=items.map(([l,c,p])=>`<div><span>${esc(l)}</span><strong>${esc(c)} vs ${esc(p)}</strong></div>`).join('')}
 const prevBtn=$('#weeklyPrevBtn'),nextBtn=$('#weeklyNextBtn');if(prevBtn)prevBtn.disabled=cfg.mode==='custom';if(nextBtn)nextBtn.disabled=cfg.mode==='custom'||cfg.mode==='this_week';
 const manual=$('#weeklyManualPanel');if(manual)manual.classList.toggle('custom-disabled',cfg.mode==='custom');if(cfg.mode!=='custom')loadWeeklyNoteIntoForm();
}

function renderAll(){renderDashboard();renderHistory();renderReview();renderWeeklyAnalysis();renderAccountsOverview();renderGoals();renderThemeButtons();renderSettings()}
function renderGoals(){
 const active=state.goals.filter(g=>g.status==='active'),done=state.goals.filter(g=>g.status==='completed').sort((a,b)=>String(b.completed_at||'').localeCompare(String(a.completed_at||'')));
 const activeList=$('#activeGoalsList'),doneList=$('#completedGoalsList'),activeEmpty=$('#activeGoalsEmpty'),doneEmpty=$('#completedGoalsEmpty');if(!activeList||!doneList)return;
 activeList.innerHTML=active.map(g=>`<div class="goal-row"><div class="goal-copy"><div class="goal-title">${esc(g.title)}</div><div class="goal-meta"><span>Added: ${fmtGoalDate(g.created_at)}</span></div></div><div class="goal-actions"><button class="goal-complete" data-goal-complete="${esc(g.id)}">Completed</button><button class="goal-delete" data-goal-delete="${esc(g.id)}" data-goal-status="active">Delete</button></div></div>`).join('');
 doneList.innerHTML=done.map(g=>`<div class="goal-row completed"><div class="goal-copy"><div class="goal-title"><span class="goal-check">✓</span>${esc(g.title)}</div><div class="goal-meta"><span>Added: ${fmtGoalDate(g.created_at)}</span><span>Completed: ${fmtGoalDate(g.completed_at)}</span></div></div><div class="goal-actions"><button class="goal-delete" data-goal-delete="${esc(g.id)}" data-goal-status="completed">Delete</button></div></div>`).join('');
 if(state.goalsError){activeEmpty.textContent='Goals database update required. Run the supplied Goals SQL update.';activeEmpty.style.display='block'}else{activeEmpty.textContent='No active goals yet.';activeEmpty.style.display=active.length?'none':'block'}
 doneEmpty.style.display=done.length?'none':'block';
}
function renderDashboard(){
 const filtered=reviewsForRange(),applicable=applicableDisciplineReviews(filtered),rp=disciplinePct('risk',filtered),sp=disciplinePct('strategy',filtered),cur=currentDisciplineStreak(),best=bestDisciplineStreak();
 $('#streakValue').textContent=`${cur} day${cur===1?'':'s'}`;$('#bestStreakValue').textContent=`${best} day${best===1?'':'s'}`;$('#riskPct').textContent=rp==null?'—':`${rp}%`;$('#strategyPct').textContent=sp==null?'—':`${sp}%`;$('#perfectDays').textContent=perfectCount(filtered);$('#riskNote').textContent=`${rangeLabel()} · ${applicable.length} applicable`;$('#strategyNote').textContent=`${rangeLabel()} · ${applicable.length} applicable`;$('#perfectNote').textContent=rangeLabel();$$('[data-range]').forEach(b=>b.classList.toggle('active',b.dataset.range===state.range));
 $('#officialStartValue').textContent=state.settings.officialStartDate?fmtStartDate(state.settings.officialStartDate):'Oct 22, 2026';$('#officialStartNote').textContent='Locked permanently';
 const p=performance();$('#winsValue').textContent=p.wins;$('#lossesValue').textContent=p.losses;$('#breakEvensValue').textContent=p.breakEvens;$('#winRateValue').textContent=`${p.winRate}%`;$('#winStreakValue').textContent=p.winStreak;$('#lossStreakValue').textContent=p.lossStreak;const ss=setupPerformanceStats();for(const [n,key] of [[1,'setup_1'],[2,'setup_2'],[3,'setup_3'],[4,'setup_4']]){const x=ss[key];$(`#setup${n}Trades`).textContent=`${x.trades} trade${x.trades===1?'':'s'}`;$(`#setup${n}WinRate`).textContent=formatSetupWinRate(x.winRate)}renderComparisonText();
 const today=new Date(),day=today.getDay(),monday=addDays(today,day===0?-6:1-day);$('#weekStrip').innerHTML=Array.from({length:7},(_,i)=>{const d=addDays(monday,i),o=overall(getReview(localDateKey(d)));return `<div class="day"><div class="day-name">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</div><div class="day-date">${new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short'}).format(d)}</div><i class="dot ${o.color}" title="${o.label}"></i></div>`}).join('');
 const s=last30Summary();$('#sPerfect').textContent=s.perfect;$('#sMixed').textContent=s.mixed;$('#sPoor').textContent=s.poor;$('#sNone').textContent=s.none;renderCalendar();const recent=[...state.reviews].slice(0,8);$('#dashboardHistory').innerHTML=recent.map(r=>`<tr class="${rowClass(r.result)}"><td>${fmtDate(r.date)}</td><td>${dotStatus(r.risk)}</td><td>${dotStatus(r.strategy)}</td><td>${resultBadge(r.result)}</td><td>${overallHtml(r)}</td></tr>`).join('');$('#dashboardEmpty').style.display=recent.length?'none':'block'
}
function renderCalendar(){const y=state.calendarMonth.getFullYear(),m=state.calendarMonth.getMonth();$('#calendarTitle').textContent=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(state.calendarMonth);const first=new Date(y,m,1),offset=(first.getDay()+6)%7,start=addDays(first,-offset);let html=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<div class="cal-weekday">${x}</div>`).join('');for(let i=0;i<42;i++){const d=addDays(start,i),k=localDateKey(d),r=getReview(k),inMonth=d.getMonth()===m;let dots='';if(r){if(r.result==='no_trade')dots=`<i class="dot grey"></i><i class="dot grey"></i>`;else dots=`<i class="dot ${r.risk==='followed'?'green':r.risk==='broke'?'red':'grey'}"></i><i class="dot ${r.strategy==='followed'?'green':r.strategy==='broke'?'red':'grey'}"></i>`}html+=`<button class="cal-cell ${!inMonth?'muted ':''}${k===localDateKey()?'today ':''}${r?'clickable ':''}${r?.result?`result-${r.result}`:''}" data-cal-date="${k}"><span class="cal-daynum">${d.getDate()}</span><div><div class="cal-dots">${dots}</div>${r?`<div class="cal-result">${resultLabel(r.result)}</div>`:''}</div></button>`}$('#calendarGrid').innerHTML=html}
function filteredHistory(){return state.reviews.filter(r=>(state.filters.result==='all'||(state.filters.result==='unrecorded'?!r.result:r.result===state.filters.result))&&(state.filters.discipline==='all'||overall(r).key===state.filters.discipline))}
function renderHistory(){const list=filteredHistory();$('#historyBody').innerHTML=list.map(r=>`<tr class="${rowClass(r.result)}"><td>${fmtDate(r.date)}</td><td>${dotStatus(r.risk)}</td><td>${dotStatus(r.strategy)}</td><td>${reviewSetupText(r.date)}</td><td>${resultBadge(r.result)}</td><td>${overallHtml(r)}</td><td><div class="history-actions"><button class="icon-btn" data-action="view" data-date="${r.date}">View</button><button class="icon-btn" data-action="edit" data-date="${r.date}">Edit</button><button class="icon-btn delete" data-action="delete" data-date="${r.date}">Delete</button></div></td></tr>`).join('');$('#historyEmpty').style.display=list.length?'none':'block';$('#historyEmpty').textContent=state.reviews.length?'No records match this filter.':'No reviews found.'}
function reviewComplete(d){if(d.noTrade)return true;if(!validDiscipline(d.strategy)||!Array.isArray(d.trades)||!d.trades.length)return false;return d.trades.every(x=>accountById(x.account_id)?.account_size&&[1,2].includes(Number(x.risk_pct))&&Number.isFinite(Number(x.trade_return_pct))&&validSetup(x.setup))}
function draftDailyResult(d=state.draft){if(d.noTrade)return 'no_trade';if(!d.trades?.length)return null;const total=d.trades.reduce((n,x)=>n+(Number.isFinite(Number(x.trade_return_pct))?Number(x.trade_return_pct):0),0);return total>1e-9?'win':total<-1e-9?'loss':'break_even'}
function tradeAccountOptions(row,date){const historical=!!getReview(date);return state.accounts.filter(a=>a.active!==false||(historical&&a.id===row.account_id)).map(a=>`<option value="${a.id}" ${a.id===row.account_id?'selected':''}>${esc(a.name)}${a.active===false?' · Archived':''}</option>`).join('')}
function renderTradesEditor(){
 const wrap=$('#tradesEditor');if(!wrap)return;const date=reviewDateKey();
 if(state.draft.noTrade){wrap.innerHTML='<div class="empty-mini">No Trade selected for this date.</div>';return}
 if(!state.draft.trades.length){wrap.innerHTML='<div class="empty-mini">No trades yet. Tap + Add Trade.</div>';return}
 wrap.innerHTML=state.draft.trades.map((t,i)=>{
  const order=i+1,s=t.account_id?simulateBeforeTrade(t.account_id,date,order,state.draft.trades):null,a=t.account_id?accountById(t.account_id):null
  const before=s&&a?.account_size?a.account_size*(1+s.totalReturn/100):null,ret=Number(t.trade_return_pct),after=before!=null&&Number.isFinite(ret)?a.account_size*(1+(s.totalReturn+ret)/100):null
  const money=v=>v==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v)
  const reasons=t.account_id&&[1,2].includes(Number(t.risk_pct))&&Number.isFinite(ret)?riskReasonsForTrade(t,date,order,state.draft.trades):[]
  return `<div class="trade-entry ${reasons.length?'has-risk-violation':''}" data-trade-index="${i}"><div class="trade-entry-head"><span class="trade-number">Trade ${order}</span><button type="button" class="trade-remove" data-remove-trade="${i}" aria-label="Remove Trade ${order}">×</button></div><div class="trade-fields"><label><span>Account</span><select class="filter-select" data-trade-field="account_id" data-index="${i}"><option value="">Choose account</option>${tradeAccountOptions(t,date)}</select></label><label><span>Risk %</span><select class="filter-select" data-trade-field="risk_pct" data-index="${i}"><option value="1" ${Number(t.risk_pct)===1?'selected':''}>1%</option><option value="2" ${Number(t.risk_pct)===2?'selected':''}>2%</option></select></label><label><span>Trade Return %</span><input class="filter-select" type="number" step="0.01" inputmode="decimal" data-trade-field="trade_return_pct" data-index="${i}" value="${t.trade_return_pct??''}" placeholder="+2.30"></label><label><span>Setup</span><select class="filter-select" data-trade-field="setup" data-index="${i}"><option value="">Choose setup</option>${['setup_1','setup_2','setup_3','setup_4'].map(k=>`<option value="${k}" ${t.setup===k?'selected':''}>${setupShort(k)}</option>`).join('')}</select></label></div>${t.account_id?`<div class="trade-context"><span><strong>Before:</strong> ${money(before)} · ${esc(cycleText(s.cycle))} · 2% ${esc(s.status)}</span>${after!=null?`<span><strong>After:</strong> ${money(after)} · ${esc(cycleText(cycleNumberFromReturn(s.totalReturn+ret)))}</span>`:''}${reasons.map(r=>`<span class="trade-reason">Reason: ${esc(r)}</span>`).join('')}</div>`:''}</div>`
 }).join('')
}
function renderReview(){
 const date=reviewDateKey(),saved=getReview(date),today=date===localDateKey();const dateInput=$('#reviewDateInput');if(dateInput){dateInput.min=String(state.settings.officialStartDate||'2026-10-22');dateInput.max=localDateKey();dateInput.value=date}
 state.draft.result=draftDailyResult(state.draft);const riskState=draftRiskStatus(state.draft,date);state.draft.risk=riskState.risk
 $$('.choice[data-field="strategy"]').forEach(b=>{b.classList.toggle('selected',state.draft.strategy===b.dataset.value);b.disabled=state.draft.noTrade})
 const nt=$('#noTradeBtn');if(nt)nt.classList.toggle('selected',state.draft.noTrade);const add=$('#addTradeBtn');if(add)add.disabled=state.draft.noTrade
 renderTradesEditor();paintRiskStatus(riskState,$('#riskAutoStatus'),$('#riskWarning'))
 const complete=reviewComplete(state.draft),dateLabel=today?'Today':fmtDate(date),total=state.draft.noTrade?null:state.draft.trades.reduce((n,x)=>n+(Number.isFinite(Number(x.trade_return_pct))?Number(x.trade_return_pct):0),0)
 $('#saveReviewBtn').disabled=!complete;$('#saveReviewBtn').textContent=saved?`Update ${dateLabel}`:`Save ${dateLabel}`;$('#reviewSummary strong').textContent=saved?`${dateLabel} already has a review`:`${dateLabel} review`;$('#reviewSummary span').textContent=state.draft.noTrade?'No Trade selected — no account, risk, return, or setup is required.':`${state.draft.trades.length} trade${state.draft.trades.length===1?'':'s'} · ${total==null?'—':fmtPct(total)} total return · individual trade outcomes are derived from Trade Return %.`
 const o=state.draft.noTrade?{label:'N/A · No Trade',color:'grey'}:complete?overall({...state.draft,result:draftDailyResult(state.draft)}):{label:'Not complete',color:'grey'};$('#reviewOverall').className=`overall ${o.color}`;$('#reviewOverall').innerHTML=`<i class="dot ${o.color}"></i>${o.label}`
}
function accountStage(a){return ['master','phase_2','phase_1'].includes(a?.account_stage)?a.account_stage:'phase_1'}
function accountStageLabel(stage){return stage==='master'?'MASTER':stage==='phase_2'?'PHASE 2':'PHASE 1'}
function accountStageRank(stage){return stage==='master'?0:stage==='phase_2'?1:2}
function accountStageIcon(stage){
 if(stage==='master')return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l4.5 3L12 4l4.5 6L21 7l-2 10H5L3 7zm3 12h12"/></svg>`;
 if(stage==='phase_2')return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 10-13h-7V2z"/></svg>`;
 return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4-8 4-8-4 8-4zm8 9l-8 4-8-4m16 5l-8 4-8-4"/></svg>`;
}
function accountStageBadge(a){const stage=accountStage(a);return `<span class="account-stage-badge ${stage}"><span class="account-stage-icon">${accountStageIcon(stage)}</span>${accountStageLabel(stage)}</span>`}
function accountOverviewStats(account){
 const rows=state.trades.filter(x=>x.account_id===account.id).sort((a,b)=>a.review_date.localeCompare(b.review_date)||a.trade_order-b.trade_order),dates=[...new Set(rows.map(x=>x.review_date))],reviews=dates.map(d=>getReview(d)).filter(Boolean)
 const wins=rows.filter(t=>t.outcome==='win').length,losses=rows.filter(t=>t.outcome==='loss').length,breakEvens=rows.filter(t=>t.outcome==='break_even').length,decided=wins+losses,winRate=decided?Math.round(wins/decided*100):null
 const riskViolations=rows.filter(t=>riskReasonsForTrade(t,t.review_date,t.trade_order,null).length>0).length,strategyViolations=reviews.filter(r=>r.strategy==='broke').length,perfectDays=reviews.filter(r=>overall(r).key==='perfect').length,returns=rows.map(x=>Number(x.trade_return_pct)).filter(Number.isFinite)
 return {tradingDays:dates.length,trades:rows.length,wins,losses,breakEvens,winRate,riskViolations,strategyViolations,perfectDays,best:returns.length?Math.max(...returns):null,worst:returns.length?Math.min(...returns):null}
}
function renderAccountsOverview(){
 const box=$('#accountsOverview'),empty=$('#accountsOverviewEmpty');if(!box||!empty)return;
 const activeAccounts=state.accounts.filter(a=>a.active!==false);
 if(!activeAccounts.length){box.innerHTML='';empty.textContent='No active accounts available.';empty.style.display='block';return}empty.style.display='none';
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(n||0));
 const ordered=[...activeAccounts].sort((a,b)=>accountStageRank(accountStage(a))-accountStageRank(accountStage(b))||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.name||'').localeCompare(String(b.name||'')));
 box.innerHTML=ordered.map(a=>{const stage=accountStage(a),sim=simulateAccount(a.id,'9999-12-31'),st=accountOverviewStats(a),configured=!!a.account_size,balance=configured?a.account_size*(1+sim.totalReturn/100):null,ret=sim.totalReturn,retClass=ret>0?'positive':ret<0?'negative':'',riskStatus=!configured?'Not Available':sim.twoUsed?'2% Used in Current Cycle':sim.bufferAvailable?'2% Available':'2% Not Available';return `<article class="account-overview-card stage-${stage} ${a.active===false?'archived':''}"><div class="account-overview-head"><div class="account-title-wrap"><div class="eyebrow">Trading Account</div><div class="account-overview-name">${esc(a.name)}</div></div><div class="account-card-badges">${accountStageBadge(a)}<span class="account-status-pill ${a.active===false?'archived':'active'}">${a.active===false?'Archived':'Active'}</span></div></div><div class="account-overview-primary"><div class="account-metric"><span>Current Balance</span><strong>${configured?esc(money(balance)):'Not set'}</strong></div><div class="account-metric"><span>Overall Return</span><strong class="${retClass}">${configured?fmtPct(ret):'—'}</strong></div><div class="account-metric"><span>Account Size</span><strong>${configured?esc(money(a.account_size)):'Not set'}</strong></div><div class="account-metric"><span>Win Rate</span><strong>${st.winRate==null?'—':`${st.winRate}%`}</strong></div></div><div class="account-overview-cycle"><div><span>Current Cycle</span><strong>${configured?esc(cycleText(sim.cycle)):'Not Available'}</strong></div><div><span>2% Risk Status</span><strong>${esc(riskStatus)}</strong></div></div><div class="account-overview-stats"><div class="account-overview-stat"><span>Trading Days</span><strong>${st.tradingDays}</strong></div><div class="account-overview-stat"><span>Wins</span><strong>${st.wins}</strong></div><div class="account-overview-stat"><span>Losses</span><strong>${st.losses}</strong></div><div class="account-overview-stat"><span>Break Even</span><strong>${st.breakEvens}</strong></div><div class="account-overview-stat"><span>Risk Violations</span><strong>${st.riskViolations}</strong></div><div class="account-overview-stat"><span>Strategy Violations</span><strong>${st.strategyViolations}</strong></div><div class="account-overview-stat"><span>Best Trade</span><strong class="${st.best!=null&&st.best>0?'positive':''}">${st.best==null?'—':fmtPct(st.best)}</strong></div><div class="account-overview-stat"><span>Worst Trade</span><strong class="${st.worst!=null&&st.worst<0?'negative':''}">${st.worst==null?'—':fmtPct(st.worst)}</strong></div></div></article>`}).join('');
}

function renderSettings(){
 const box=$('#accountsList');if(!box)return;if(!state.accounts.length){box.innerHTML='<div class="empty-mini">No accounts yet.</div>';return}
 box.innerHTML=state.accounts.map(a=>{const s=simulateAccount(a.id,'9999-12-31');const size=a.account_size?new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(a.account_size):'Not set',stage=accountStage(a);return `<div class="account-setting ${a.active===false?'archived':''}"><div class="account-setting-info"><div class="account-setting-title"><strong>${esc(a.name)}</strong>${accountStageBadge(a)}</div><small>Account Size: ${esc(size)} · ${a.account_size?cycleText(s.cycle):'Set size to start cycle tracking'} · ${a.active===false?'Archived':'Active'}</small><label class="account-stage-control"><span>Account Stage</span><select class="filter-select account-stage-select" data-account-stage="${a.id}"><option value="phase_1" ${stage==='phase_1'?'selected':''}>Phase 1</option><option value="phase_2" ${stage==='phase_2'?'selected':''}>Phase 2</option><option value="master" ${stage==='master'?'selected':''}>Master</option></select></label></div><div class="backup-actions">${a.active!==false?`<button class="secondary small" data-account-edit="${a.id}">Edit</button><button class="secondary small" data-account-reset="${a.id}" ${!a.account_size?'disabled':''}>Reset Cycle</button><button class="secondary small" data-account-archive="${a.id}">Archive</button>`:`<button class="secondary small" data-account-unarchive="${a.id}">Unarchive</button>`}</div></div>`}).join('')
}

function renderThemeButtons(){const theme=document.documentElement.dataset.theme;$$('[data-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===theme))}
function navigate(page){state.page=page;$$('.page').forEach(p=>p.classList.toggle('active',p.id===page));$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const c={dashboard:['Dashboard','Track discipline and outcome without confusing the two.'],review:['Daily Review','Multiple trades per day with per-trade Account, Risk, Return, and Setup.'],history:['History','Review, filter, edit, or remove previous days.'],weekly:['System Analysis','See what went well, what went wrong, and how this week compares.'],accounts:['Accounts','Read-only overview of account balances, cycles, returns, and existing trading statistics.'],goals:['Goals','Add personal targets and keep achieved goals as a dated history.'],training:['Trading System Training','Focused practice for your trading system and execution rules.'],settings:['Settings','Cloud sync, theme, and backup. Official Start Date is locked.']};$('#pageTitle').textContent=c[page][0];$('#pageSub').textContent=c[page][1];if(page==='review'){if(!reviewDateAllowed(state.reviewDate))state.reviewDate=localDateKey();loadDraftForDate(reviewDateKey());renderReview()}if(page==='weekly'){renderWeeklyAnalysis();loadWeeklyNotes()}if(page==='accounts'){renderAccountsOverview()}window.scrollTo({top:0,behavior:'smooth'})}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2300)}
function closeModal(){$('#modalBackdrop').classList.remove('show');state.pendingImport=null}
function showDay(date){
 const r=getReview(date);if(!r){$('#modal').innerHTML=`<h3>${fmtDate(date)}</h3><p>No review recorded for this day.</p><div class="modal-actions"><button class="secondary" id="modalClose">Close</button></div>`;$('#modalBackdrop').classList.add('show');$('#modalClose').onclick=closeModal;return}
 const rows=reviewTrades(date),reasons=[];for(const x of rows)reasons.push(...riskReasonsForTrade(x,date,x.trade_order,null));
 const tradeHtml=rows.length?rows.map(t=>`<div class="kv"><span>Trade ${t.trade_order}</span><strong>${esc(accountById(t.account_id)?.name||'Archived account')} · ${t.risk_pct}% · ${fmtPct(t.trade_return_pct)} · ${setupShort(t.setup)} · ${resultLabel(t.outcome)}</strong></div>`).join(''):'<div class="kv"><span>Trades</span><strong>No Trade</strong></div>'
 $('#modal').innerHTML=`<h3>${fmtDate(date)}</h3><p>Each trade is shown separately with its own Account, Risk, Return, Setup, and derived outcome.</p>${tradeHtml}${reasons.length?`<div class="risk-warning">${[...new Set(reasons)].map(x=>`<div><strong>Reason:</strong> ${esc(x)}</div>`).join('')}</div>`:''}<div class="kv"><span>Risk Management</span>${dotStatus(r.risk)}</div><div class="kv"><span>Strategy</span>${dotStatus(r.strategy)}</div><div class="kv"><span>Daily Result</span>${resultBadge(r.result)}</div><div class="kv"><span>Overall Discipline</span>${overallHtml(r)}</div><div class="modal-actions"><button class="secondary" id="modalClose">Close</button><button class="primary" id="modalEdit">Edit</button></div>`;$('#modalBackdrop').classList.add('show');$('#modalClose').onclick=closeModal;$('#modalEdit').onclick=()=>showEdit(date)
}
function showEdit(date){
 const r=getReview(date);if(!r)return;state.reviewDate=date;loadDraftForDate(date);closeModal();navigate('review');setTimeout(()=>document.querySelector('#review')?.scrollIntoView({block:'start'}),0)
}
function confirmDelete(date){$('#modal').innerHTML=`<h3>Delete this daily review?</h3><p>${fmtDate(date)} will be removed from Dashboard and calculations. Your Start Date remains locked.</p><div class="modal-actions"><button class="secondary" id="deleteCancel">Cancel</button><button class="danger" id="deleteConfirm">Delete</button></div>`;$('#modalBackdrop').classList.add('show');$('#deleteCancel').onclick=closeModal;$('#deleteConfirm').onclick=async()=>{try{$('#deleteConfirm').disabled=true;await deleteReview(date);closeModal();renderAll();toast('Review deleted')}catch(e){toast(e.message||'Could not delete review');$('#deleteConfirm').disabled=false}}}
function exportBackup(){const payload={schema:BACKUP_SCHEMA,schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),reviews:state.reviews,accounts:state.accounts,trades:state.trades,accountRisks:state.accountRisks,accountResets:state.accountResets,preferences:{theme:state.settings.theme,officialStartDate:state.settings.officialStartDate,schemaVersion:SCHEMA_VERSION}};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`tradeflow-backup-${localDateKey()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup exported')}
function validateBackup(data){if(!data||typeof data!=='object'||!Array.isArray(data.reviews))return null;const reviews=normalizeReviews(data.reviews);if(data.reviews.length&&reviews.length===0)return null;const theme=['dark','light'].includes(data.preferences?.theme)?data.preferences.theme:null;const accounts=Array.isArray(data.accounts)?data.accounts:[];const accountRisks=Array.isArray(data.accountRisks)?data.accountRisks:[];const trades=Array.isArray(data.trades)?data.trades:[];const accountResets=Array.isArray(data.accountResets)?data.accountResets:[];return {reviews,theme,accounts,trades,accountRisks,accountResets}}
function askImport(candidate){state.pendingImport=candidate;$('#modal').innerHTML=`<h3>Import backup?</h3><p>This will merge <strong>${candidate.reviews.length}</strong> review${candidate.reviews.length===1?'':'s'} into Supabase by date. Matching dates will be updated; other cloud reviews remain.</p><p>The locked Start Date stays <strong>Oct 22, 2026</strong>.</p><div class="modal-actions"><button class="secondary" id="importCancel">Cancel</button><button class="primary" id="importConfirm">Import Backup</button></div>`;$('#modalBackdrop').classList.add('show');$('#importCancel').onclick=closeModal;$('#importConfirm').onclick=async()=>{const c=state.pendingImport;try{$('#importConfirm').disabled=true;showLoading('Importing backup…');await api('import_backup',{reviews:c.reviews,theme:c.theme,accounts:c.accounts,trades:c.trades,accountRisks:c.accountRisks,accountResets:c.accountResets});closeModal();await bootstrap();navigate('dashboard');toast('Backup imported')}catch(e){toast(e.message||'Could not import backup')}finally{hideLoading()}}}
function handleImport(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const c=validateBackup(JSON.parse(reader.result));if(!c){toast('Invalid backup file');return}askImport(c)}catch{toast('Invalid backup file')}};reader.onerror=()=>toast('Could not read backup file');reader.readAsText(file)}
function legacyLocalData(){try{const raw=JSON.parse(localStorage.getItem(LEGACY_REVIEWS_KEY)||'[]');const reviews=normalizeReviews(raw);const theme=localStorage.getItem(LEGACY_THEME_KEY);const prefs=JSON.parse(localStorage.getItem(LEGACY_PREFS_KEY)||'{}');return {reviews,theme:['dark','light'].includes(theme)?theme:null,officialStartDate:prefs.officialStartDate||prefs.startDate||null}}catch{return {reviews:[],theme:null,officialStartDate:null}}}
function confirmMigration(){const legacy=legacyLocalData();if(!legacy.reviews.length){toast('No legacy local data found');return}$('#modal').innerHTML=`<h3>Migrate local data?</h3><p>Found <strong>${legacy.reviews.length}</strong> older local review${legacy.reviews.length===1?'':'s'}. Supabase will merge by date, so 22 Oct 2026 will not duplicate.</p><div class="modal-actions"><button class="secondary" id="migCancel">Cancel</button><button class="primary" id="migConfirm">Migrate</button></div>`;$('#modalBackdrop').classList.add('show');$('#migCancel').onclick=closeModal;$('#migConfirm').onclick=async()=>{try{$('#migConfirm').disabled=true;showLoading('Migrating local data…');await api('migrate_local',{reviews:legacy.reviews,theme:legacy.theme});closeModal();await bootstrap();toast('Local data migrated')}catch(e){toast(e.message||'Could not migrate data')}finally{hideLoading()}}}

function openAddGoal(){
 if(state.goalsError){toast('Run the Goals SQL update first');return}
 $('#modal').innerHTML=`<h3>Add Goal</h3><p>Write the target you want to achieve.</p><input id="goalTitleInput" class="goal-input" maxlength="300" placeholder="e.g. Buy 100K FTMO Account" autocomplete="off"><div class="modal-actions"><button class="secondary" id="goalCancel">Cancel</button><button class="primary" id="goalSave">Add Goal</button></div>`;$('#modalBackdrop').classList.add('show');$('#goalCancel').onclick=closeModal;$('#goalSave').onclick=saveNewGoal;setTimeout(()=>$('#goalTitleInput')?.focus(),0)
}
async function refreshGoals(){state.goals=normalizeGoals(await api('list_goals'));state.goalsError='';renderGoals()}
async function saveNewGoal(){const title=$('#goalTitleInput')?.value.trim();if(!title){toast('Enter a goal');return}try{$('#goalSave').disabled=true;await api('add_goal',{title});closeModal();await refreshGoals();toast('Goal added')}catch(e){toast(e.message||'Could not add goal');if($('#goalSave'))$('#goalSave').disabled=false}}
async function completeGoal(id){try{setSync('Saving goal…','busy');await api('complete_goal',{id});await refreshGoals();setSync('Synced','ok');toast('Goal completed')}catch(e){setSync('Sync error','error');toast(e.message||'Could not complete goal')}}
async function deleteGoal(id,status){const msg=status==='completed'?'Delete this completed goal permanently?':'Delete this goal permanently?';if(!confirm(msg))return;try{setSync('Deleting goal…','busy');await api('delete_goal',{id});await refreshGoals();setSync('Synced','ok');toast('Goal deleted')}catch(e){setSync('Sync error','error');toast(e.message||'Could not delete goal')}}

// Events
$('#unlockForm').addEventListener('submit',e=>{e.preventDefault();unlockWithCode($('#accessCode').value.trim())})
$('#toggleCode').onclick=()=>{const input=$('#accessCode');input.type=input.type==='password'?'text':'password';$('#toggleCode').textContent=input.type==='password'?'Show':'Hide'}
$('#accessCode').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4)})
$('#lockBtn').onclick=()=>{lockApp();toast('Session locked')}
$$('[data-page]').forEach(b=>b.addEventListener('click',()=>{const page=b.dataset.page;if(page==='review'){state.reviewDate=localDateKey();loadDraftForDate(state.reviewDate)}navigate(page)}))
$('#addGoalBtn').onclick=openAddGoal
$('#goals').addEventListener('click',e=>{const complete=e.target.closest('[data-goal-complete]'),del=e.target.closest('[data-goal-delete]');if(complete){completeGoal(complete.dataset.goalComplete);return}if(del)deleteGoal(del.dataset.goalDelete,del.dataset.goalStatus)})
$('#weeklyPrevBtn').onclick=()=>{state.systemPeriodMode='previous_week';renderWeeklyAnalysis();loadWeeklyNotes()}
$('#weeklyNextBtn').onclick=()=>{state.systemPeriodMode='this_week';renderWeeklyAnalysis();loadWeeklyNotes()}
$('#systemPeriodMode').onchange=e=>{state.systemPeriodMode=e.target.value;if(state.systemPeriodMode==='previous_week')state.weeklyStart=clampWeekStart(localDateKey(addDays(parseKey(currentWeekStart()),-7)));else if(state.systemPeriodMode==='this_week')state.weeklyStart=currentWeekStart();renderWeeklyAnalysis();if(state.systemPeriodMode!=='custom')loadWeeklyNotes()}
$('#systemCustomApply').onclick=()=>{const official=state.settings.officialStartDate||'2026-10-22',today=localDateKey(),s=$('#systemCustomFrom').value,e=$('#systemCustomTo').value;if(!s||!e)return toast('Choose From and To dates');if(s<official||e<official)return toast(`Date cannot be before ${fmtStartDate(official)}`);if(s>today||e>today)return toast('Future dates are not allowed');if(e<s)return toast('To date must be on or after From date');state.systemCustomStart=s;state.systemCustomEnd=e;state.systemPeriodMode='custom';renderWeeklyAnalysis()}
if($('#weeklySaveNotesBtn')) $('#weeklySaveNotesBtn').onclick=()=>{if(state.systemPeriodMode==='custom')return toast('Weekly notes are available for This Week or Previous Week');saveWeeklyNotes()}
$('#goReviewBtn').onclick=()=>{state.reviewDate=localDateKey();loadDraftForDate(state.reviewDate);navigate('review')}
$$('.choice[data-field="strategy"]').forEach(b=>b.addEventListener('click',()=>{state.draft.strategy=b.dataset.value;renderReview()}))
$('#clearReviewBtn').onclick=()=>{state.draft=blankDraft();renderReview()}
$('#addTradeBtn').onclick=()=>{state.draft.noTrade=false;state.draft.trades.push({account_id:'',risk_pct:1,trade_return_pct:null,setup:null});renderReview()}
$('#noTradeBtn').onclick=()=>{state.draft.noTrade=!state.draft.noTrade;if(state.draft.noTrade){state.draft.trades=[];state.draft.strategy=null}renderReview()}
$('#saveReviewBtn').onclick=async()=>{const date=reviewDateKey();if(!reviewDateAllowed(date)){toast('Choose a date from the Official Start Date through today');return}if(!reviewComplete(state.draft)){toast(state.draft.noTrade?'':'Complete every trade: Account, Risk %, Trade Return %, Setup, and choose Strategy');return}const existed=!!getReview(date);$('#saveReviewBtn').disabled=true;showLoading(existed?'Updating review…':'Saving review…');try{await saveReview({date,...state.draft});loadDraftForDate(date);renderAll();toast(existed?'Review updated':'Review saved');navigate('review')}catch(e){toast(e.message||'Could not save review')}finally{hideLoading();renderReview()}}
$('#historyBody').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='view')showDay(b.dataset.date);if(b.dataset.action==='edit')showEdit(b.dataset.date);if(b.dataset.action==='delete')confirmDelete(b.dataset.date)})
$('#calendarGrid').addEventListener('click',e=>{const cell=e.target.closest('[data-cal-date]');if(cell)showDay(cell.dataset.calDate)})
$('#modalBackdrop').addEventListener('click',e=>{if(e.target===$('#modalBackdrop'))closeModal()})
$$('[data-theme-choice]').forEach(b=>b.onclick=()=>applyTheme(b.dataset.themeChoice,true))
$$('[data-range]').forEach(b=>b.onclick=()=>{state.range=b.dataset.range;renderDashboard()})
$('#prevMonth').onclick=()=>{state.calendarMonth=new Date(state.calendarMonth.getFullYear(),state.calendarMonth.getMonth()-1,1);renderCalendar()}
$('#nextMonth').onclick=()=>{state.calendarMonth=new Date(state.calendarMonth.getFullYear(),state.calendarMonth.getMonth()+1,1);renderCalendar()}
$('#resultFilter').onchange=e=>{state.filters.result=e.target.value;renderHistory()}
$('#disciplineFilter').onchange=e=>{state.filters.discipline=e.target.value;renderHistory()}
$('#tradesEditor').addEventListener('click',e=>{const b=e.target.closest('[data-remove-trade]');if(!b)return;state.draft.trades.splice(Number(b.dataset.removeTrade),1);renderReview()})
$('#tradesEditor').addEventListener('input',e=>{const f=e.target.closest('[data-trade-field]');if(!f)return;const i=Number(f.dataset.index),t=state.draft.trades[i];if(!t)return;const field=f.dataset.tradeField;t[field]=field==='risk_pct'?Number(f.value):field==='trade_return_pct'?(f.value===''?null:Number(f.value)):f.value;renderReview()})
$('#tradesEditor').addEventListener('change',e=>{const f=e.target.closest('[data-trade-field]');if(!f)return;const i=Number(f.dataset.index),t=state.draft.trades[i];if(!t)return;const field=f.dataset.tradeField;t[field]=field==='risk_pct'?Number(f.value):field==='trade_return_pct'?(f.value===''?null:Number(f.value)):f.value;renderReview()})
const reviewDateInput=$('#reviewDateInput');if(reviewDateInput)reviewDateInput.addEventListener('change',e=>{const date=e.target.value;if(!reviewDateAllowed(date)){toast('Choose a date from the Official Start Date through today');e.target.value=reviewDateKey();return}loadDraftForDate(date);renderReview()})
$('#addAccountBtn').onclick=async()=>{const name=$('#newAccountName').value.trim(),size=Number($('#newAccountSize').value);if(!name){toast('Enter an account name');return}if(!Number.isFinite(size)||size<=0){toast('Enter a valid Account Size');return}try{await api('add_account',{name,accountSize:size});$('#newAccountName').value='';$('#newAccountSize').value='';await bootstrap();toast('Account added · Cycle 3 Caution')}catch(e){toast(e.message||'Could not add account')}}
$('#accountsList').addEventListener('change',async e=>{const sel=e.target.closest('[data-account-stage]');if(!sel)return;const id=sel.dataset.accountStage,stage=sel.value;try{sel.disabled=true;await api('set_account_stage',{id,stage});await bootstrap();toast(`Account stage updated · ${accountStageLabel(stage)}`)}catch(err){sel.disabled=false;toast(err.message||'Could not update account stage')}})
$('#accountsList').addEventListener('click',async e=>{const edit=e.target.closest('[data-account-edit]'),reset=e.target.closest('[data-account-reset]'),arc=e.target.closest('[data-account-archive]'),unarc=e.target.closest('[data-account-unarchive]');if(edit){const a=accountById(edit.dataset.accountEdit),name=prompt('Account name',a?.name||'');if(!name?.trim())return;const size=Number(prompt('Account Size',a?.account_size||''));if(!Number.isFinite(size)||size<=0){toast('Enter a valid Account Size');return}try{await api('update_account',{id:a.id,name:name.trim(),accountSize:size});await bootstrap();toast('Account updated')}catch(err){toast(err.message||'Could not update account')}}if(reset){const a=accountById(reset.dataset.accountReset);if(!confirm(`Reset ${a?.name||'this account'} to Cycle 3 · Caution? History will remain.`))return;try{await api('reset_account',{id:a.id});await bootstrap();toast('Cycle reset · Cycle 3 Caution')}catch(err){toast(err.message||'Could not reset cycle')}}if(arc){const a=accountById(arc.dataset.accountArchive);if(!confirm(`Archive ${a?.name||'this account'}? Historical reviews will remain.`))return;try{await api('archive_account',{id:a.id});await bootstrap();toast('Account archived')}catch(err){toast(err.message||'Could not archive account')}}if(unarc){const a=accountById(unarc.dataset.accountUnarchive);if(!confirm(`Restore ${a?.name||'this account'} to Active Accounts?`))return;try{await api('unarchive_account',{id:a.id});await bootstrap();toast('Account unarchived')}catch(err){toast(err.message||'Could not unarchive account')}}})

$('#exportBackupBtn').onclick=exportBackup
$('#importBackupBtn').onclick=()=>$('#importFile').click()
$('#importFile').onchange=e=>{handleImport(e.target.files?.[0]);e.target.value=''}
$('#migrateLocalBtn').onclick=confirmMigration

// Initial visual state
const cachedTheme=(()=>{try{return localStorage.getItem(THEME_CACHE_KEY)||localStorage.getItem(LEGACY_THEME_KEY)||'dark'}catch{return'dark'}})()
applyThemeLocal(['dark','light'].includes(cachedTheme)?cachedTheme:'dark')
$('#todayLabel').textContent=new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date())
$('.app').classList.add('is-locked'); $('.mobile-nav').classList.add('is-locked')
if(!configReady()) $('#authError').textContent='TradeFlow configuration is incomplete.'
else if(sessionToken()) { unlockUi(); bootstrap() }

window.TradeFlowTest={state,reviewTrades,riskReasonsForTrade,overall,performance,currentDisciplineStreak,bestDisciplineStreak,disciplinePct,renderAll,normalizeReviews,analyzeWeek,analyzePeriod,systemPeriodConfig,buildNextPeriodFocus,buildProgressFromPrevious,progressStatusLower,progressStatusHigher,progressPreviousPeriod}
})()
