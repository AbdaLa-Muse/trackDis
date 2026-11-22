/* TradeFlow Setup Review: 3 approved CRT references, local quiz, private image API. */
(()=>{'use strict';
const $=s=>document.querySelector(s), root=$('#setup-review');if(!root)return;
const config={
 '4h':{name:'4H CRT',context:'Daily',poi:'4H Order Block / FVG',tf:'4H',alignment:'1H',confirmation:'15M BOS / IFG',entry:'4H Candle 3'},
 '1h':{name:'1H CRT',context:'Daily + 4H',poi:'1H Order Block / FVG',tf:'1H',alignment:'15M',confirmation:'5M BOS / IFG',entry:'1H Candle 3'},
 '15m':{name:'15M CRT',context:'4H + 1H',poi:'15M Order Block / FVG',tf:'15M',alignment:'5M',confirmation:'1M BOS / IFG',entry:'15M Candle 3'}
};
const questions=[
 ['4H CRT: Which market context is required?',['Daily','4H + 1H','15M'],0,'4H CRT uses Daily market context.'],
 ['4H CRT: Where must price reach to form CRT?',['1H FVG','4H Order Block or FVG','15M Order Block'],1,'The 4H CRT POI is a 4H Order Block or FVG.'],
 ['4H CRT: What is the alignment timeframe?',['15M','4H','1H'],2,'The alignment timeframe for 4H CRT is 1H.'],
 ['4H CRT: Where must BOS or IFG confirm?',['15M','5M','1M'],0,'4H CRT needs 15M BOS or IFG during Candle 2.'],
 ['4H CRT: Entry is taken during which candle?',['4H Candle 2','4H Candle 3','1H Candle 3'],1,'Entry opportunities are taken during the 4H Candle 3.'],
 ['1H CRT: Which market context applies?',['Daily + 4H','4H + 1H','Daily only'],0,'1H CRT uses Daily + 4H market context.'],
 ['1H CRT: What is the point of interest?',['15M FVG','4H FVG','1H Order Block or FVG'],2,'The 1H CRT uses a 1H Order Block or FVG.'],
 ['1H CRT: Which timeframe provides directional alignment?',['5M','15M','1H'],1,'Directional alignment for 1H CRT is 15M.'],
 ['1H CRT: Which timeframe provides BOS or IFG confirmation?',['5M','15M','1M'],0,'The 1H CRT confirms with 5M BOS or IFG during Candle 2.'],
 ['1H CRT: What is the entry candle?',['1H Candle 2','15M Candle 3','1H Candle 3'],2,'Entry opportunity is on 1H Candle 3.'],
 ['15M CRT: Which market context applies?',['Daily + 4H','4H + 1H','Daily only'],1,'15M CRT uses the 4H + 1H market context.'],
 ['15M CRT: What is its POI timeframe?',['15M','1H','5M'],0,'15M CRT needs a 15M Order Block or FVG.'],
 ['15M CRT: Which timeframe provides directional alignment?',['1M','15M','5M'],2,'15M CRT directional alignment is on 5M.'],
 ['15M CRT: Where must BOS or IFG form?',['5M','1M','15M'],1,'15M CRT needs 1M BOS or IFG confirmation during Candle 2.'],
 ['15M CRT: Which is the correct entry candle?',['15M Candle 3','5M Candle 3','1H Candle 3'],0,'Entry is during 15M Candle 3.'],
 ['Shared rule: When must the BOS or IFG confirmation form?',['Candle 1','Candle 3','Candle 2'],2,'BOS or IFG confirmation must form during Candle 2.'],
 ['Shared rule: Candle 2 closes in the intended direction. What next?',['Wait for a mandatory pullback','Select a suitable Candle 3 entry without requiring pullback','Enter on Candle 2'],1,'Choose a suitable market opportunity during Candle 3 without a mandatory pullback.'],
 ['Shared rule: Candle 2 closes against the intended direction. What next?',['Wait for a small pullback during Candle 3','Enter immediately during Candle 2','Wait until Candle 4'],0,'Wait for a small pullback during Candle 3 before entering in the intended direction.'],
 ['Shared rule: Where must CRT form?',['Anywhere on the chart','Only after Candle 3','At the designated OB or FVG POI'],2,'CRT must form at the designated Order Block or FVG point of interest.'],
 ['Shared rule: Which sequence is correct?',['Context → POI → CRT → Alignment → BOS/IFG → C3','BOS/IFG → C3 → POI → Context','C3 → Alignment → POI'],0,'The execution filter is Context → POI → CRT → Alignment → BOS/IFG → C3 Entry.']
];
let selected='4h',questionIndex=0,answers={},checked={},images={'4h':[],'1h':[],'15m':[]},seq=0,uploading=false;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const endpoint=()=>`${String(window.TRADEFLOW_CONFIG?.SUPABASE_URL||'').replace(/\/$/,'')}/functions/v1/tradeflow-crt-images`;
const mimeOK=new Set(['image/png','image/jpeg','image/webp']);
async function request(action,body={},file=null){
 const token=sessionStorage.getItem('tradeflow_cloud_session_v1');if(!token)throw Error('Unlock TradeFlow first.');
 const headers={'apikey':window.TRADEFLOW_CONFIG?.SUPABASE_PUBLISHABLE_KEY||'','x-tradeflow-token':token};let payload;
 if(file){payload=new FormData();payload.set('action',action);payload.set('model',body.model);payload.set('file',file)}
 else {headers['content-type']='application/json';payload=JSON.stringify({action,...body})}
 let res;try{res=await fetch(endpoint(),{method:'POST',headers,body:payload,cache:'no-store'})}catch{throw Error('Could not connect to the CRT image service. Verify Edge Function deployment.')}
 let data;try{data=await res.json()}catch{throw Error('Invalid response from CRT image service')}
 if(!res.ok||!data?.ok)throw Error(String(data?.error||'CRT image request failed'));
 return data;
}
function message(s,error=false){let el=$('#crtImageFeedback');if(el){el.textContent=s;el.classList.toggle('error',!!error)}}
function hideModal(){const modal=$('#crtImageModal');modal.hidden=true;$('#crtImageFull').removeAttribute('src')}
function choose(v){if(v!== 'quiz'&&!config[v])return;selected=v;root.querySelectorAll('[data-crt-view]').forEach(b=>{const on=b.dataset.crtView===v;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});render();if(v!=='quiz')loadImages(v)}
function render(){const el=$('#crtContent');if(!el)return;if(selected==='quiz')return renderQuiz();const m=config[selected];
 el.innerHTML=`<div class="crt-content-header"><h3>${escape(m.name)} — Model Rules</h3><span class="crt-tag">Reference</span></div>
 <table class="crt-rules"><tbody>${[['Market Context',m.context],['POI',m.poi],['CRT Timeframe',m.tf],['Directional Alignment',m.alignment],['Confirmation',m.confirmation],['Entry',m.entry]].map(([k,v])=>`<tr><td>${escape(k)}</td><td>${escape(v)}</td></tr>`).join('')}</tbody></table>
 <div class="crt-execution"><h4>Shared Execution Rules</h4><p>Price reaches the designated OB / FVG → CRT forms at the POI → Directional alignment matches the trade direction → BOS / IFG forms during Candle 2 → Entry opportunity during Candle 3.</p><hr><h4>Execution Filter</h4><p>Context → POI → CRT → Alignment → BOS / IFG → C3 Entry</p><p class="crt-note">BOS / IFG confirmation must form during Candle 2, and alignment must match the intended trade direction.</p><hr><h4>✓ Same Direction Close</h4><p>During Candle 3, take the entry at a suitable market opportunity without requiring a pullback.</p><h4>◷ Opposite Direction Close</h4><p>Wait for a small pullback during Candle 3 before entering in the intended direction.</p></div>
 <section class="crt-image-section" aria-label="Reference Images for ${escape(m.name)}"><div class="crt-image-bar"><div><h4>Reference Images</h4><div class="crt-note">${escape(m.name)} · Your private chart reference library</div></div><div><button type="button" class="primary" id="crtUploadBtn" ${uploading?'disabled':''}>Upload Image</button><input type="file" class="crt-file-input" id="crtFile" accept="image/png,image/jpeg,image/webp" aria-label="Select CRT reference image"></div></div><div class="crt-note">PNG, JPG/JPEG or WebP, up to 8 MB. Images are available after deploying the secure CRT image backend.</div><div id="crtImageFeedback" class="crt-alert" role="status"></div><div id="crtImageGallery" class="crt-image-gallery"></div></section>`;
 $('#crtUploadBtn').onclick=()=>$('#crtFile').click();$('#crtFile').onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!mimeOK.has(f.type)||f.size>8*1024*1024||f.size<8){message('Choose PNG, JPEG or WebP image up to 8 MB.',true);return}uploading=true;$('#crtUploadBtn').disabled=true;message('Uploading image…');try{await request('upload',{model:selected},f);await loadImages(selected);message('Image uploaded.')}catch(err){message(err.message,true)}finally{uploading=false;if($('#crtUploadBtn'))$('#crtUploadBtn').disabled=false}};
 renderGallery(selected);
}
function renderGallery(v){const el=$('#crtImageGallery');if(!el||v!==selected)return;const list=images[v]||[];el.innerHTML=list.map(x=>`<article class="crt-image-item"><img src="${escape(x.url)}" alt="${escape(x.original_name)}" data-image-open="${escape(x.id)}" loading="lazy"><p class="crt-image-name">${escape(x.original_name)}</p><div class="crt-image-actions"><button class="secondary small" data-image-open="${escape(x.id)}">View</button><button class="secondary small" data-image-delete="${escape(x.id)}">Delete</button></div></article>`).join('');if(!list.length)el.innerHTML='<div class="crt-note">No images uploaded for this model yet.</div>';
 el.querySelectorAll('[data-image-open]').forEach(b=>b.onclick=async()=>{const row=list.find(x=>x.id===b.dataset.imageOpen);if(!row)return;try{const result=await request('open',{id:row.id,model:v});$('#crtImageFull').src=result.url;$('#crtImageModal').hidden=false;$('#crtImageClose').focus()}catch(err){message(err.message,true)}});
 el.querySelectorAll('[data-image-delete]').forEach(b=>b.onclick=async()=>{const row=list.find(x=>x.id===b.dataset.imageDelete);if(!row||!confirm(`Delete "${row.original_name}" from ${config[v].name}?`))return;message('Deleting image…');try{await request('delete',{id:row.id,model:v});await loadImages(v);message('Image deleted.')}catch(err){message(err.message,true)}})
}
async function loadImages(v){const id=++seq;message('Loading reference images…');try{const data=await request('list',{model:v});if(id!==seq||selected!==v)return;images[v]=data.images||[];renderGallery(v);message('')}catch(err){if(id!==seq||selected!==v)return;images[v]=[];renderGallery(v);message(err.message,true)}}
function renderQuiz(){const el=$('#crtContent'),q=questions[questionIndex],picked=answers[questionIndex],done=!!checked[questionIndex],count=questions.filter((_,i)=>checked[i]).length,score=questions.filter((r,i)=>checked[i]&&answers[i]===r[2]).length;
 el.innerHTML=`<div class="crt-content-header"><h3>CRT Training Exercise</h3><span class="crt-tag">Quiz</span></div><div class="crt-note">Question ${questionIndex+1} of ${questions.length} · Score ${score}/${count}</div><div class="crt-quiz-progress"><span style="width:${100*(questionIndex+1)/questions.length}%"></span></div><h3 style="font-size:17px;line-height:1.5">${escape(q[0])}</h3><div class="crt-options">${q[1].map((o,i)=>`<button type="button" class="crt-option ${picked===i?'selected':''} ${done&&i===q[2]?'right':''} ${done&&picked===i&&i!==q[2]?'wrong':''}" data-crt-answer="${i}" ${done?'disabled':''}><span>${'ABC'[i]}.</span><span>${escape(o)}</span></button>`).join('')}</div>${done?`<div class="crt-feedback"><strong style="color:${picked===q[2]?'var(--green)':'var(--red)'}">${picked===q[2]?'Correct Answer':'Incorrect — Review the answer'}</strong><br>${escape(q[3])}</div>`:''}<div class="crt-quiz-actions"><button class="secondary" id="crtPrevious" ${questionIndex===0?'disabled':''}>Previous</button>${done?(questionIndex===questions.length-1?'<button class="primary" id="crtAgain">Practice Again</button>':'<button class="primary" id="crtNext">Next Question</button>'):`<button class="primary" id="crtCheck" ${picked===undefined?'disabled':''}>Check Answer</button>`}</div>${count===questions.length?`<div class="crt-feedback" style="margin-top:15px;text-align:center"><strong>FINAL EXERCISE SCORE: ${Math.round(score/questions.length*100)}%</strong><br>${score} correct out of ${questions.length} questions</div>`:''}`;
 el.querySelectorAll('[data-crt-answer]').forEach(b=>b.onclick=()=>{answers[questionIndex]=Number(b.dataset.crtAnswer);renderQuiz()});$('#crtPrevious').onclick=()=>{if(questionIndex>0){questionIndex--;renderQuiz()}};if($('#crtNext'))$('#crtNext').onclick=()=>{questionIndex++;renderQuiz()};if($('#crtCheck'))$('#crtCheck').onclick=()=>{checked[questionIndex]=true;renderQuiz()};if($('#crtAgain'))$('#crtAgain').onclick=()=>{questionIndex=0;answers={};checked={};renderQuiz()};
}
root.querySelectorAll('[data-crt-view]').forEach(btn=>btn.addEventListener('click',()=>choose(btn.dataset.crtView)));
$('#crtImageClose').onclick=hideModal;$('#crtImageModal').addEventListener('click',e=>{if(e.target.id==='crtImageModal')hideModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#crtImageModal').hidden)hideModal()});
window.tradeflowCRTLoad=()=>{if(selected==='quiz')renderQuiz();else{render();loadImages(selected)}};
window.TradeFlowCRTTest={config,questions,getScore:()=>({correct:questions.filter((r,i)=>checked[i]&&answers[i]===r[2]).length,total:questions.length}),choose};
render();
})();
