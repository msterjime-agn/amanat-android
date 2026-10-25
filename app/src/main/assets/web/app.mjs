import {today,dateLabel,money,moneyValue,parseMoney,normalizePhone,totals,status,STATUS,TYPES,CURRENCIES,CITIES,selectRecords,aggregate,parseMessage,escapeHtml,exportCsv,validateRecord,validDate,uid,sequenceWarnings,importCandidate,inboxCandidate,completeToday,applyScreenDay} from './core.mjs';
import {allRecords,meta,setMeta,saveRecord,makeBackup,restoreBackup} from './db.mjs';
import {printBody,printDocument} from './printing.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const e=escapeHtml;
const icons={box:'<path d="m3 7 9-5 9 5v10l-9 5-9-5V7Z"/><path d="m3 7 9 5 9-5M12 12v10M7.5 4.5l9 5v5"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',print:'<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1"/>',list:'<path d="M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1"/>',chart:'<path d="M4 20h17M7 16v-5M12 16V4M17 16V8"/>',message:'<path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z"/><path d="M7 9h10M7 13h7"/>',settings:'<path d="m9 3-1 3-3 1v4l-2 1 2 1v4l3 1 1 3h6l1-3 3-1v-4l2-1-2-1V7l-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',arrow:'<path d="m15 5-7 7 7 7"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',check:'<path d="m4 12 5 5L20 6"/>',phone:'<path d="m7 3 3 5-3 3a15 15 0 0 0 6 6l3-3 5 3-2 4C11 22 2 13 3 5l4-2Z"/>',plus:'<path d="M12 4v16M4 12h16"/>'};
function icon(name){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(icons[name]||icons.box)+'</svg>';}
let records=[],settings={operator:'',business:'Аманат'},filterStatus='',query='',inbox=[],importInboxId=null,draftParsed=null;
const native=()=>Boolean(window.Android);
function nativeState(){try{return native()?JSON.parse(Android.getState()):{};}catch{return {};}}
function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),4500);}
function errorText(err){return err?.message || 'Не удалось выполнить действие. Попробуйте ещё раз.';}
function modal(title,html){$('#modal-content').innerHTML='<button class="modal-close" aria-label="Закрыть">×</button><h2>'+e(title)+'</h2>'+html;$('#modal .modal-close').onclick=()=>$('#modal').close();if(!$('#modal').open)$('#modal').showModal();}
function fail(err){modal('Не удалось выполнить действие','<p>'+e(errorText(err))+'</p><button class="btn full" id="error-ok">Понятно</button>');$('#error-ok').onclick=()=>$('#modal').close();}
async function refresh(){records=await allRecords();settings={operator:'',business:'Аманат',...(await meta('settings')||{})};}
function header(title,sub=''){return '<div class="pagehead"><div><div class="eyebrow">Учёт передач</div><h1>'+e(title)+'</h1>'+(sub?'<div class="hint">'+e(sub)+'</div>':'')+'</div><span class="datepill">'+dateLabel(today())+'</span></div>';}
function go(route){if(location.hash===route)render();else location.hash=route;}
function navigation(route){
  $('.bottom-nav').innerHTML=[['records','box','Передачи'],['inbox','message','IMO'],['stats','chart','Статистика'],['print','print','Списки'],['settings','settings','Ещё']].map(([id,ic,label])=>'<a href="#'+id+'" '+(route===id?'aria-current="page" ':'')+'class="'+(route===id?'active':'')+'">'+icon(ic)+'<span>'+label+'</span></a>').join('');
  $('#add').style.display=['new','edit','detail','inbox'].includes(route)?'none':'flex';
}
function empty(title,desc,action='new',label='Добавить передачу'){return '<div class="empty"><div class="emptyicon">'+icon('box')+'</div><h3>'+e(title)+'</h3><p>'+e(desc)+'</p>'+(action?'<button class="btn primary" data-go="'+action+'">'+e(label)+'</button>':'')+'</div>';}
function bindGo(){ $$('[data-go]').forEach(x=>x.onclick=()=>go('#'+x.dataset.go)); }
function recordCard(r){
  const t=totals(r),done=status(r)==='done';
  return '<article class="transfer-row '+(done?'paid-row':'')+'"><button class="row-open" data-id="'+e(r.id)+'"><span class="row-number">#'+r.serial+'<small>'+dateLabel(r.day)+'</small></span><span class="row-person"><b>'+e(r.recipient)+'</b><small>'+e(r.city)+' · '+e(r.phone)+'</small></span><span class="row-sum">'+e(r.amountMinor?money(done?r.amountMinor:t.remaining,r.currency):t.parcelsRemaining+' мест')+'<small>'+(done?'Выдано '+dateLabel((r.history||[]).filter(h=>!h.voidedAt).at(-1)?.date):STATUS[status(r)])+'</small></span></button>'+(done?'<span class="paid-mark">✓ Оплачено</span>':'<button class="btn primary pay-button" data-paid="'+e(r.id)+'">'+(r.type==='money'?'Оплачено':'Выдано')+'</button>')+(r.note?.includes('п/н')?'<div class="row-warning">'+e(r.note)+'</div>':'')+'</article>';
}
function bindCards(){
 $$('[data-id]').forEach(x=>x.onclick=()=>go('#detail/'+x.dataset.id));
 $$('[data-paid]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();quickPaid(b.dataset.paid);});
}
function quickPaid(id){
 const r=records.find(x=>x.id===id);if(!r||status(r)==='done')return;
 const t=totals(r);
 modal(r.type==='money'?'Подтвердить оплату':'Подтвердить выдачу','<p><b>#'+r.serial+' · '+e(r.recipient)+'</b></p><p>'+e([t.remaining?money(t.remaining,r.currency):'',t.parcelsRemaining?t.parcelsRemaining+' мест':''].filter(Boolean).join(' · '))+'</p><p>Дата выдачи: <b>'+dateLabel(today())+'</b></p><div class="actionrow"><button class="btn primary" id="confirm-paid">Подтвердить</button><button class="btn" id="partial-paid">Частичная выдача</button></div>');
 $('#partial-paid').onclick=()=>issueDialog(r);
 $('#confirm-paid').onclick=async()=>{
  const b=$('#confirm-paid');b.disabled=true;
  try {await saveRecord(completeToday(r,settings.operator),r.updatedAt);$('#modal').close();await refresh();render();toast('Выдано '+dateLabel(today()));}
  catch(err){fail(err);}finally{b.disabled=false;}
 };
}
function pageRecords(){
  const active=records.filter(x=>!x.archived), open=active.filter(r=>status(r)!=='done');
  const all=selectRecords(records,{status:filterStatus,q:query});
  const todayRec=active.filter(r=>r.day===today());
  const doneToday=records.filter(r=>(r.history||[]).some(h=>!h.voidedAt&&h.date===today())).length;
  $('#app').innerHTML=header('Передачи','Все получатели и выдачи — в одном месте')+(inbox.length?'<div class="notice warn"><button class="btn" data-go="inbox">Подтвердить сообщения: '+inbox.length+'</button></div>':'')+'<div class="summary"><div class="statcard primary"><span>Ожидают выдачи</span><strong>'+open.length+'</strong><small>включая частично выданные</small></div><div class="statcard"><span>Выдано сегодня</span><strong>'+doneToday+'</strong><small>передач с выдачами за день</small></div><div class="statcard"><span>Зарегистрировано сегодня</span><strong>'+todayRec.length+'</strong><small>новые дневные номера</small></div><div class="statcard"><span>Следующий п/н сегодня</span><strong id="next-no">…</strong><small>завтра нумерация начнётся с 1</small></div></div><div class="actionrow"><button class="btn" data-go="inbox">'+icon('message')+'Добавить из IMO</button><button class="btn" data-go="print">'+icon('print')+'Печатать список</button></div><div class="search">'+icon('search')+'<input id="search" aria-label="Поиск передач" placeholder="Имя, телефон, город или номер…" value="'+e(query)+'" type="search"></div><div class="tabs">'+[['','Все',active.length],['open','Ожидают',open.length],['partial','Частично',active.filter(r=>status(r)==='partial').length],['done','Выдано',active.filter(r=>status(r)==='done').length]].map(([key,label,n])=>'<button class="tab '+(filterStatus===key?'active':'')+'" data-status="'+key+'">'+label+'<em>'+n+'</em></button>').join('')+'</div><div id="records-body">'+recordsBody(all)+'</div>';
  meta('seq:'+today()).then(n=>{if($('#next-no'))$('#next-no').textContent=(n||0)+1;});
  $('#search').oninput=ev=>{query=ev.target.value;$('#records-body').innerHTML=recordsBody(selectRecords(records,{status:filterStatus,q:query}));bindCards();bindGo();};
  $$('[data-status]').forEach(b=>b.onclick=()=>{filterStatus=b.dataset.status;pageRecords();});bindCards();bindGo();
}
function recordsBody(list){return list.length?'<div class="listheading"><span>Найдено: '+list.length+'</span><span>По п/н ↑</span></div><div class="cards-grid">'+list.map(recordCard).join('')+'</div>':empty(records.length?'Ничего не найдено':'Первая передача — с номера 1',records.length?'Измените поиск или статус.':'Добавьте передачу вручную или вставьте сообщение из IMO.',records.length?'':'new');}
function field(label,name,value='',attrs='',type='text'){return '<label>'+label+'<input type="'+type+'" name="'+name+'" value="'+e(value)+'" '+attrs+'></label>';}
function options(values,selected,emptyLabel=''){return (emptyLabel?'<option value="">'+emptyLabel+'</option>':'')+values.map(v=>'<option value="'+e(v)+'" '+(selected===v?'selected':'')+'>'+e(v)+'</option>').join('');}
function selectField(label,name,values,value,attrs=''){return '<label>'+label+'<select name="'+name+'" '+attrs+'>'+options(values,value)+'</select></label>';}
function pageForm(record=null,parsed=null){
  const r=record || {day:today(),receivedDate:today(),messageDate:today(),type:'money',recipient:'',phone:'',city:'',sender:'',senderPhone:'',amountMinor:0,currency:'USD',parcelTotal:0,parcelDesc:'',note:'',originalText:'',history:[]};
  const p=parsed || {};
  const v={...r,...p,amount:p.amount ?? (r.amountMinor?moneyValue(r.amountMinor):''),parcelTotal:p.parcelTotal ?? (r.parcelTotal||1)};
  $('#app').innerHTML='<div class="formwrap">'+header(record?'Изменить передачу':'Новая передача',record?'№ '+r.serial+' · '+dateLabel(r.day):'Номер из IMO сохраняется')+'<form id="record-form" novalidate><div id="form-error" class="notice error" role="alert"></div>'+(parsed?'<div class="notice warn">Проверьте распознанные поля перед сохранением.<pre class="raw">'+e(p.originalText)+'</pre>'+(p.warnings?.length?'<ul>'+p.warnings.map(w=>'<li>'+e(w)+'</li>').join('')+'</ul>':'')+'</div>':'')+'<div class="panel"><h2>Карточка передачи</h2><label>Что передаём<select name="type">'+Object.entries(TYPES).map(([key,label])=>'<option value="'+key+'" '+(v.type===key?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+field('Имя / ФИО *','recipient',v.recipient,'required autocomplete="name" maxlength="180"')+field('Телефон *','phone',v.phone,'required autocomplete="tel" maxlength="30" placeholder="+993 6…"','tel')+'<label>Город выдачи *<input name="city" value="'+e(v.city)+'" required list="city-list" maxlength="100" placeholder="Например, Дашогуз"><datalist id="city-list">'+CITIES.map(c=>'<option value="'+c+'">').join('')+'</datalist></label><div id="money-fields" class="grid2">'+field('Сумма к выдаче *','amount',v.amount,'inputmode="decimal" placeholder="0,00" maxlength="18"')+'<label>Валюта *<select name="currency" '+(record?.history.length?'disabled':'')+'>'+options(CURRENCIES,v.currency,parsed&&!v.currency?'Выберите валюту':'')+'</select></label></div><div id="parcel-fields">'+field('Количество мест *','parcelTotal',v.parcelTotal,'min="1" max="10000" step="1"','number')+'<label>Описание посылки<textarea name="parcelDesc" maxlength="2000" placeholder="Что передают, отметки на упаковке…">'+e(v.parcelDesc)+'</textarea></label></div>'+field('П/н из IMO','serial',v.serial||'',(record?'disabled ':'')+'min="1" step="1" placeholder="Автоматически, если пусто"','number')+'<div class="grid2">'+field('День списка / п/н *','day',v.day,(record?'disabled ':'')+'required max="'+today()+'"','date')+field('Дата приёма *','receivedDate',v.receivedDate,'required max="'+today()+'"','date')+'</div><div class="hint">Дневной номер закрепляется за днём списка и сохраняется при редактировании.</div></div><details><summary>Отправитель и сообщение IMO</summary><div>'+field('Имя отправителя','sender',v.sender,'maxlength="180"')+field('Телефон отправителя','senderPhone',v.senderPhone||'','maxlength="30"','tel')+field('Дата сообщения','messageDate',v.messageDate,'max="'+today()+'"','date')+'<label>Исходное сообщение<textarea name="originalText" maxlength="20000" rows="5">'+e(v.originalText)+'</textarea></label></div></details><label>Примечание<textarea name="note" maxlength="3000" placeholder="Адрес, договорённости, дополнительные сведения…">'+e(v.note)+'</textarea></label><div class="actionrow"><button type="submit" class="btn primary" id="save-record">'+icon('check')+'Сохранить передачу</button><button type="button" class="btn" id="cancel-record">Отмена</button></div></form></div>';
  const form=$('#record-form');
  form.elements.day.onchange=()=>{if(!record&&!form.elements.receivedDate.value){form.elements.receivedDate.value=form.elements.day.value;form.elements.messageDate.value=form.elements.day.value;}};
  const changeType=()=>{const type=form.elements.type.value;$('#money-fields').hidden=type==='parcel';$('#money-fields').style.display=type==='parcel'?'none':'grid';$('#parcel-fields').hidden=type==='money';};form.elements.type.onchange=changeType;changeType();
  $('#cancel-record').onclick=()=>go(record?'#detail/'+record.id:'#records');
  form.onsubmit=async ev=>{
    ev.preventDefault();$('#form-error').textContent='';const save=$('#save-record');save.disabled=true;
    try{
      const f=new FormData(form),type=f.get('type');
      const rec={...r,serial:record?r.serial:(Number(f.get('serial'))||undefined),sourceInboxId:importInboxId||r.sourceInboxId,type,recipient:f.get('recipient').trim(),phone:normalizePhone(f.get('phone')),city:f.get('city').trim(),sender:f.get('sender').trim(),senderPhone:normalizePhone(f.get('senderPhone')),day:record?r.day:f.get('day'),receivedDate:f.get('receivedDate'),messageDate:f.get('messageDate'),amountMinor:type==='parcel'?0:parseMoney(f.get('amount')),currency:record?.history.length?r.currency:f.get('currency'),parcelTotal:type==='money'?0:Number(f.get('parcelTotal')),parcelDesc:f.get('parcelDesc').trim(),note:f.get('note').trim(),originalText:f.get('originalText').trim()};
      if(type==='parcel'&&!rec.currency)rec.currency='USD';
      validateRecord(rec);
      if(!record&&f.get('serial')&&(!Number.isSafeInteger(rec.serial)||rec.serial<1))throw new Error('П/н должен быть положительным целым числом.');
      const seqWarnings=!record&&rec.serial?sequenceWarnings(records,rec.day,rec.serial):[];
      if(seqWarnings.length&&!window.confirm(seqWarnings.join('\n')+'\nСохранить с этим номером?'))return;
      const duplicate=!record&&rec.originalText&&records.find(x=>x.day===rec.day&&x.originalText?.trim()===rec.originalText);
      if(duplicate){
        const confirmed=await new Promise(resolve=>{modal('Похожая передача уже есть','<p>Этот текст уже сохранён: № '+duplicate.serial+' от '+dateLabel(duplicate.day)+', '+e(duplicate.recipient)+'.</p><p class="hint">Если это новая отдельная передача, можно сохранить её со следующим дневным номером.</p><div class="actionrow"><button class="btn" id="duplicate-open">Открыть сохранённую</button><button class="btn primary" id="duplicate-new">Это отдельная передача</button></div>');$('#modal').addEventListener('close',()=>resolve(false),{once:true});$('#duplicate-open').onclick=()=>{resolve(false);$('#modal').close();go('#detail/'+duplicate.id);};$('#duplicate-new').onclick=()=>{resolve(true);$('#modal').close();};});
        if(!confirmed)return;
      }
      const saved=await saveRecord(rec,record?.updatedAt);
      if(importInboxId && native()){Android.markInbox(importInboxId);importInboxId=null;}
      await refresh();toast('Сохранено: № '+saved.serial+' от '+dateLabel(saved.day));go('#detail/'+saved.id);
    }catch(err){$('#form-error').textContent=errorText(err);$('#form-error').scrollIntoView({block:'center',behavior:'smooth'});}finally{save.disabled=false;}
  };
}
function detailRow(label,value){return '<div class="row"><span class="muted">'+e(label)+'</span><b>'+value+'</b></div>';}
function pageDetail(id){
  const r=records.find(x=>x.id===id);if(!r){go('#records');return;}
  const t=totals(r),s=status(r);
  $('#app').innerHTML='<div class="formwrap"><div class="detail-top"><button class="iconbtn" data-go="records" aria-label="Назад">'+icon('arrow')+'</button><div><div class="record-no"><b>№ '+r.serial+'</b> · '+dateLabel(r.day)+'</div><div class="hint">'+TYPES[r.type]+'</div></div></div><span class="badge '+s+'">'+STATUS[s]+(r.archived?' · Архив':'')+'</span><h1 class="detail-title">'+e(r.recipient)+'</h1><p class="muted">'+e(r.city)+' · <a href="tel:'+e(r.phone)+'">'+e(r.phone)+'</a></p><div class="panel">'+(r.amountMinor?'<div class="eyebrow">'+(s==='done'?'Выдано денег':'Осталось выдать')+'</div><div class="bigamount">'+money(s==='done'?r.amountMinor:t.remaining,r.currency)+'</div>'+detailRow('Принято денег',money(r.amountMinor,r.currency))+detailRow('Уже выдано',money(t.paid,r.currency)):'')+(r.parcelTotal?detailRow('Посылка',t.parcels+' из '+r.parcelTotal+' мест выдано'):'')+detailRow('Дата приёма',dateLabel(r.receivedDate))+(r.messageDate?detailRow('Дата сообщения',dateLabel(r.messageDate)):'')+(r.sender?detailRow('Отправитель',e(r.sender)):'')+'</div>'+(r.parcelDesc?'<p><b>Посылка:</b> '+e(r.parcelDesc)+'</p>':'')+(r.note?'<div class="notice">'+e(r.note)+'</div>':'')+'<div class="actionrow">'+(s!=='done'?'<button class="btn primary" id="issue">'+icon('check')+'Выдать</button>':'')+'<button class="btn" id="edit-record">Изменить</button><button class="btn" id="print-record">'+icon('print')+'Печатать</button></div><div class="sectionline"><h2>История выдачи</h2><small>'+r.history.filter(h=>!h.voidedAt).length+' операций</small></div>'+(r.history.length?r.history.slice().reverse().map(h=>'<div class="history '+(h.voidedAt?'void':'')+'"><time>'+dateLabel(h.date)+'</time><div class="historyline"><b>'+[h.amountMinor?money(h.amountMinor,r.currency):'',h.parcels?h.parcels+' мест':''].filter(Boolean).join(' · ')+'</b>'+(!h.voidedAt?'<button class="btn" data-void="'+e(h.id)+'">Исправить</button>':'')+'</div><div>Получил(а): '+e(h.deliveredTo)+'</div>'+(h.operator?'<div class="hint">Выдал(а): '+e(h.operator)+'</div>':'')+(h.note?'<div class="hint">'+e(h.note)+'</div>':'')+(h.voidedAt?'<div class="hint">Отменено: '+e(h.voidReason)+'</div>':'')+'</div>').join(''):'<div class="empty">Выдач пока нет. Нажмите «Выдать», когда передача будет вручена.</div>')+(r.originalText?'<details><summary>Исходное сообщение IMO</summary><div><pre class="raw">'+e(r.originalText)+'</pre></div></details>':'')+(s==='done'?'<div class="divider"></div><button class="btn ghost" id="archive">'+(r.archived?'Вернуть из архива':'Перенести в архив')+'</button>':'')+'<p class="subtle">ID: '+e(r.id)+'</p></div>';
  bindGo();if($('#issue'))$('#issue').onclick=()=>issueDialog(r);$('#edit-record').onclick=()=>go('#edit/'+r.id);$('#print-record').onclick=()=>printRecords([r],{title:'Карточка выдачи',signature:true,showPhone:true,basis:'day'});
  $$('[data-void]').forEach(b=>b.onclick=()=>voidDialog(r,b.dataset.void));
  if($('#archive'))$('#archive').onclick=async()=>{try{await saveRecord({...r,archived:!r.archived},r.updatedAt);await refresh();pageDetail(r.id);toast(r.archived?'Возвращено из архива':'Перенесено в архив');}catch(err){fail(err);}};
}
function issueDialog(r){
  const t=totals(r);
  modal('Выдать передачу','<p class="hint">№ '+r.serial+' · '+e(r.recipient)+'</p><form id="issue-form" novalidate><div id="issue-error" class="notice error" hidden></div>'+field('Дата выдачи','date',today(),'required min="'+r.receivedDate+'" max="'+today()+'"','date')+(t.remaining?field('Выдать денег, '+r.currency,'amount',moneyValue(t.remaining),'inputmode="decimal" required'):'')+(t.parcelsRemaining?field('Выдать мест (остаток: '+t.parcelsRemaining+')','parcels',t.parcelsRemaining,'min="0" max="'+t.parcelsRemaining+'" step="1"','number'):'')+field('Кто получил(а) *','deliveredTo',r.recipient,'required maxlength="180"')+field('Кто выдал(а)','operator',settings.operator,'maxlength="180"')+field('Примечание','note','','maxlength="1000"')+'<div class="notice">Сохранение подтвердит фактическую выдачу. Для частичной выдачи уменьшите сумму или количество мест.</div><button class="btn primary full" type="submit">Подтвердить выдачу</button></form>');
  $('#issue-form').onsubmit=async ev=>{
    ev.preventDefault();const b=ev.target.querySelector('[type=submit]');b.disabled=true;
    try{const f=new FormData(ev.target);const h={id:uid(),date:f.get('date'),amountMinor:t.remaining?parseMoney(f.get('amount')):0,parcels:t.parcelsRemaining?Number(f.get('parcels')):0,deliveredTo:f.get('deliveredTo').trim(),operator:f.get('operator').trim(),note:f.get('note').trim(),createdAt:new Date().toISOString()};
      const rec={...r,history:[...r.history,h]};validateRecord(rec);await saveRecord(rec,r.updatedAt);$('#modal').close();await refresh();pageDetail(r.id);toast('Выдача записана');
    }catch(err){$('#issue-error').hidden=false;$('#issue-error').textContent=errorText(err);}finally{b.disabled=false;}
  };
}
function voidDialog(r,id){
  modal('Исправить выдачу','<p>Ошибочная выдача останется в истории с отметкой об отмене. Остаток пересчитается.</p><form id="void-form">'+field('Причина исправления *','reason','','required maxlength="500"')+'<button class="btn danger full">Отменить эту выдачу</button></form>');
  $('#void-form').onsubmit=async ev=>{ev.preventDefault();try{const reason=new FormData(ev.target).get('reason').trim();if(!reason)throw new Error('Укажите причину.');const rec={...r,archived:false,history:r.history.map(h=>h.id===id?{...h,voidedAt:new Date().toISOString(),voidReason:reason}:h)};await saveRecord(rec,r.updatedAt);$('#modal').close();await refresh();pageDetail(r.id);toast('Выдача отменена; остаток пересчитан');}catch(err){fail(err);}};
}
function chatPanel(s){
  const active=s.chatAccess&&s.chatCapture&&s.chatBound;
  return '<section class="panel"><h2>Чтение открытого чата IMO</h2><span class="badge '+(active?'done':'')+'">'+(active?'Включено':'Не подключено / остановлено')+'</span><p class="hint">Читает видимые передачи из привязанной группы Amanat, даже когда окно Аманата закрыто. Для формирования карточек вернитесь в Аманат. Даты без года требуют подтверждения.</p><ol class="hint"><li>Разрешите службу «Аманат: чтение группы IMO».</li><li>Откройте группу Amanat в IMO на пару секунд.</li><li>Вернитесь сюда и подтвердите привязку группы.</li><li>Снова откройте группу, прокрутите нужные сообщения и вернитесь в Аманат.</li></ol>'+(s.chatMembers?'<p>Привязана: Amanat<br><small>'+e(s.chatMembers)+'</small></p>':'')+(s.chatLastRead?'<p class="hint">Последнее чтение: '+new Date(s.chatLastRead).toLocaleString('ru-RU',{timeZone:'Asia/Ashgabat'})+' · видимых сообщений: '+s.chatLastVisible+'</p>':'')+'<div class="actionrow"><button class="btn" id="chat-access">Разрешить чтение</button><button class="btn primary" id="chat-bind">'+(s.chatBound?'Привязать / возобновить':'Привязать Amanat')+'</button><button class="btn" id="chat-pause">Остановить</button></div><p class="hint">При заблокированном экране или закрытом IMO чат не читается. Изменение строки участников останавливает сбор до новой привязки. Другие чаты не собираются.</p></section>';
}
function bindChatButtons(){
  if($('#chat-access'))$('#chat-access').onclick=()=>Android.openChatSettings();
  if($('#chat-bind'))$('#chat-bind').onclick=()=>Android.bindChat();
  if($('#chat-pause'))$('#chat-pause').onclick=()=>{Android.pauseChat();render();};
}
function autoDayPanel(){
 const saved=settings.screenImportDay;
 const selected=saved?.confirmedOn===today()?saved.day:today();
 return '<section class="panel compact-panel"><h3>Автоматические карточки</h3><p class="hint">Понятные сообщения сохраняются сразу. Если дата в чате не видна или без года, один раз выберите день списка для этой загрузки. Проверьте, что сообщения относятся к одному дню.</p><div class="grid2">'+field('День сообщений','screen-day',selected,'max="'+today()+'"','date')+'<button class="btn primary" id="apply-screen-day">Применить и создать</button></div><p class="hint">'+(saved?.confirmedOn===today()?'Для неясных дат выбран '+dateLabel(saved.day)+'. Настройка действует до конца сегодняшнего дня.':'Без выбора даты такие сообщения останутся на проверке.')+'</p><button class="linkbtn" id="clear-screen-day">Сбросить выбранный день</button></section>';
}
function bindAutoDay(){
 if($('#apply-screen-day'))$('#apply-screen-day').onclick=async()=>{
  const day=$('[name="screen-day"]').value;
  if(!validDate(day)||day>today()){toast('Проверьте день списка');return;}
  if(!window.confirm('Все сообщения с неясной датой в этой загрузке относятся к '+dateLabel(day)+'?'))return;
  try{settings.screenImportDay={day,confirmedOn:today()};await setMeta('settings',settings);await processInbox();render();}catch(err){fail(err);}
 };
 if($('#clear-screen-day'))$('#clear-screen-day').onclick=async()=>{delete settings.screenImportDay;await setMeta('settings',settings);render();};
}
function candidateForInbox(m){return applyScreenDay(m,settings.screenImportDay);}
function pageInbox(){
  try{inbox=native()?JSON.parse(Android.getInbox()).map(m=>({...m,reviewWarnings:[...candidateForInbox(m).warnings,...(records.some(r=>r.day===candidateForInbox(m).record.day&&r.serial===candidateForInbox(m).record.serial)?sequenceWarnings(records,candidateForInbox(m).record.day,candidateForInbox(m).record.serial):[])]})):[];}catch{inbox=[];}
  const ns=nativeState();
  $('#app').innerHTML=header('Сообщения IMO','Понятные сообщения — сразу в карточки; сомнительные — на подтверждение')+'<div class="panel"><h2>Вставить сообщение</h2><p class="hint">Скопируйте текст из IMO или отправьте его в Аманат через «Поделиться», если IMO предлагает эту команду.</p><textarea id="message-text" rows="7" maxlength="20000" placeholder="Получатель: …\nТелефон: +993…\nГород: …\nСумма: 100 USD"></textarea><div class="actionrow"><button class="btn primary" id="parse-message">'+icon('plus')+'Разобрать сообщение</button></div><div class="hint">Программа предложит поля. Сумму, валюту и получателя проверьте перед сохранением.</div></div>'+(native()?autoDayPanel()+chatPanel(ns):'')+(native()?'<div class="panel"><div class="toggleline"><div><h3>Входящие из уведомлений</h3><p>'+(ns.notificationAccess&&ns.captureEnabled?'Сбор включён. Новые текстовые уведомления группы Amanat попадут сюда.':'Подключите доступ, чтобы собирать новые текстовые уведомления IMO.')+'</p></div><span class="badge '+(ns.notificationAccess&&ns.captureEnabled?'done':'')+'">'+(ns.notificationAccess&&ns.captureEnabled?'Включено':'Выключено')+'</span></div><div class="actionrow"><button class="btn" id="imo-settings">Настроить IMO</button><button class="btn ghost" id="refresh-inbox">Обновить</button></div><p class="hint">Сохраняется только текст, который IMO показывает в уведомлении. Содержимое старой переписки, фото и голосовых добавляйте вручную.</p></div>':'<div class="notice">Сбор уведомлений доступен в Android-приложении. В браузере можно вставить текст вручную.</div>')+'<div class="sectionline"><h2>Нужно подтверждение</h2><small>'+inbox.length+' сообщений</small></div>'+(inbox.length?inbox.map((m,i)=>'<article class="inbox-msg"><small>'+e(m.title)+' · '+new Date(m.timestamp).toLocaleString('ru-RU',{timeZone:'Asia/Ashgabat'})+'</small><pre>'+e(m.text)+'</pre><p class="hint">'+e((m.reviewWarnings||[]).join(' '))+'</p><div class="actionrow"><button class="btn primary" data-import="'+i+'">Создать карточку</button><button class="btn ghost" data-dismiss="'+i+'">Не передача</button></div></article>').join(''):empty('Новых сообщений нет','Вставьте сообщение выше или подключите сбор новых уведомлений.','',''));
  $('#parse-message').onclick=()=>startImport($('#message-text').value);
  bindChatButtons();bindAutoDay();
  if($('#imo-settings'))$('#imo-settings').onclick=()=>go('#settings');
  if($('#refresh-inbox'))$('#refresh-inbox').onclick=()=>pageInbox();
  $$('[data-import]').forEach(b=>b.onclick=()=>{const m=inbox[Number(b.dataset.import)];importInboxId=m.id;draftParsed=candidateForInbox(m).parsed;go('#new/import');});
  $$('[data-dismiss]').forEach(b=>b.onclick=()=>{Android.markInbox(inbox[Number(b.dataset.dismiss)].id);pageInbox();});
}
function startImport(text){
  if(!text?.trim()){toast('Сначала вставьте текст сообщения');return;}
  if(text.length>20000){toast('Слишком длинное сообщение. Разделите его на отдельные передачи.');return;}
  draftParsed=importCandidate(text).parsed;go('#new/import');
}
function periodForm(id,from='',to=''){return '<form id="'+id+'" class="panel"><div class="period">'+field('С даты','from',from,'','date')+field('По дату','to',to,'','date')+'</div><div class="actionrow"><button class="btn primary">Показать</button><button type="button" class="btn" data-period="today">Сегодня</button><button type="button" class="btn" data-period="month">Этот месяц</button><button type="button" class="btn ghost" data-period="all">Всё время</button></div></form>';}
function bindPeriods(form,submit){
  const f=$(form);f.onsubmit=ev=>{ev.preventDefault();if(f.elements.from.value&&f.elements.to.value&&f.elements.from.value>f.elements.to.value){toast('Начало периода должно быть раньше его конца');return;}submit(f.elements.from.value,f.elements.to.value);};
  $$('[data-period]').forEach(b=>b.onclick=()=>{const t=today();let from='',to='';if(b.dataset.period==='today')from=to=t;if(b.dataset.period==='month'){from=t.slice(0,8)+'01';to=t;}submit(from,to);});
}
function pageStats(from='',to=''){
  const a=aggregate(records,from,to);
  const cityCount={};for(const r of records.filter(r=>(!from||r.receivedDate>=from)&&(!to||r.receivedDate<=to)))cityCount[r.city]=(cityCount[r.city]||0)+1;
  $('#app').innerHTML=header('Статистика','Приём и выдача считаются по фактическим датам')+periodForm('stats-period',from,to)+'<div class="summary"><div class="statcard primary"><span>Принято передач за период</span><strong>'+a.count+'</strong><small>по дате приёма</small></div><div class="statcard"><span>Из них полностью выданы</span><strong>'+a.done+'</strong><small>текущее состояние этих передач</small></div><div class="statcard"><span>Принято мест</span><strong>'+a.parcelReceived+'</strong><small>по дате приёма посылок</small></div><div class="statcard"><span>Выдано мест</span><strong>'+a.parcelIssued+'</strong><small>по дате фактической выдачи</small></div></div><div class="sectionline"><h2>Деньги по валютам</h2><small>Без пересчёта курсов</small></div><div class="stats-grid">'+(Object.keys(a.groups).length?Object.entries(a.groups).map(([c,g])=>'<section class="currency-stat"><header><span>'+c+'</span><span>Баланс выдачи</span></header><div class="body">'+detailRow('Остаток на начало периода',money(g.opening,c))+detailRow('Принято за период',money(g.received,c))+detailRow('Выдано за период',money(g.issued,c))+detailRow('Остаток на конец периода',money(g.closing,c))+detailRow('Осталось выдать сейчас',money(g.outstanding,c))+'</div></section>').join(''):empty('Денежных передач пока нет','После добавления суммы здесь появится статистика.','',''))+'</div><div class="panel"><h2>Приём по городам</h2>'+(Object.keys(cityCount).length?Object.entries(cityCount).sort((a,b)=>b[1]-a[1]).map(([city,n])=>'<div class="row"><span>'+e(city)+'</span><b>'+n+'</b></div>').join(''):'<p class="hint">За этот период записей нет.</p>')+'</div><p class="hint">Архивные передачи включены в статистику. Остаток на начало + принято − выдано = остаток на конец периода.</p>';
  bindPeriods('#stats-period',pageStats);
}
let printOptions={status:'open',city:'',type:'',currency:'',from:'',to:'',basis:'day',signature:true,showPhone:true,showSender:false,includeArchived:false};
function pagePrint(){
  const cities=[...new Set(records.map(r=>r.city))].sort((a,b)=>a.localeCompare(b,'ru'));
  const o=printOptions;
  $('#app').innerHTML=header('Печать списков','Печатный лист A4 или сохранение в PDF')+'<form id="print-form" class="panel"><div class="grid2"><label>Какие передачи<select name="status">'+[['','Все'],['open','Ожидают выдачи'],['waiting','Без выдач'],['partial','Частично выданные'],['done','Выданные']].map(([v,l])=>'<option value="'+v+'" '+(o.status===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label><label>Город<select name="city">'+options(cities,o.city,'Все города')+'</select></label><label>Тип передачи<select name="type"><option value="">Все типы</option>'+Object.entries(TYPES).map(([v,l])=>'<option value="'+v+'" '+(o.type===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label><label>Валюта<select name="currency">'+options(CURRENCIES,o.currency,'Все валюты')+'</select></label></div><label>Отбор по дате<select name="basis">'+[['day','День списка / п/н'],['received','Дата приёма'],['issued','Дата выдачи']].map(([v,l])=>'<option value="'+v+'" '+(o.basis===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label><div class="grid2">'+field('С даты','from',o.from,'','date')+field('По дату','to',o.to,'','date')+'</div>'+[['showPhone','Печатать телефоны'],['signature','Место для подписи получателя'],['showSender','Печатать отправителя'],['includeArchived','Включить архив']].map(([key,label])=>'<label class="check"><input type="checkbox" name="'+key+'" '+(o[key]?'checked':'')+'>'+label+'</label>').join('')+'<button class="btn primary" type="submit">Сформировать список</button></form><div id="print-results"></div>';
  const form=$('#print-form');const show=()=>{const f=new FormData(form);const from=f.get('from'),to=f.get('to');if(from&&to&&from>to){toast('Проверьте начало и конец периода');return;}
    printOptions={status:f.get('status'),city:f.get('city'),type:f.get('type'),currency:f.get('currency'),basis:f.get('basis'),from,to,showPhone:f.has('showPhone'),signature:f.has('signature'),showSender:f.has('showSender'),includeArchived:f.has('includeArchived')};
    const list=selectRecords(records,printOptions),opts={...printOptions,title:'Список передач',business:settings.business,generatedDay:today()};
    $('#print-results').innerHTML='<div class="sectionline"><h2>Готово записей: '+list.length+'</h2></div>'+(list.length?'<div class="actionrow"><button class="btn primary" id="do-print">'+icon('print')+'Печать / PDF</button><button class="btn" id="do-csv">'+icon('download')+'Таблица CSV</button></div><p class="hint">В окне печати выберите принтер или «Сохранить как PDF». Подключение принтера зависит от установленной службы печати.</p><div class="panel print-preview">'+printBody(list,opts)+'</div>':empty('В списке пока пусто','Измените даты, статус или город.','',''));
    if($('#do-print'))$('#do-print').onclick=()=>printRecords(list,opts);
    if($('#do-csv'))$('#do-csv').onclick=()=>saveFile('Amanat-list-'+today()+'.csv','text/csv',exportCsv(list));
  };form.onsubmit=ev=>{ev.preventDefault();show();};show();
}
function printRecords(list,opts){
  if(!list.length){toast('Нет записей для печати');return;}
  const html=printDocument(list,{...opts,business:settings.business,generatedDay:today()});
  if(native()){Android.printHtml(html);return;}
  const w=window.open('','_blank');if(!w){toast('Разрешите открытие окна печати в браузере');return;}w.document.write(html);w.document.close();w.onload=()=>w.print();
}
function saveFile(name,mime,text){
  if(native()){Android.saveFile(name,mime,text);return;}
  const url=URL.createObjectURL(new Blob([text],{type:mime+';charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Файл подготовлен');
}
function pageSettings(){
  const s=nativeState(),archived=records.filter(r=>r.archived);
  $('#app').innerHTML=header('Настройки','Резервные копии, печать и подключение IMO')+(native()?chatPanel(s):'')+'<form id="settings-form" class="panel"><h2>Ваш учёт</h2>'+field('Название в печатных списках','business',settings.business,'maxlength="100"')+field('Кто выдаёт передачи','operator',settings.operator,'maxlength="180" placeholder="Имя сотрудника"')+'<button class="btn primary">Сохранить</button></form>'+(native()?'<section class="panel"><h2>Группа IMO: Amanat</h2><p class="hint">Android предоставляет приложению доступ к уведомлениям. Аманат сохраняет уведомления только от поддерживаемых приложений IMO; текст остаётся на этом телефоне.</p><div class="row"><span class="muted">Системный доступ</span><b>'+(s.notificationAccess?'Разрешён':'Не разрешён')+'</b></div><div class="row"><span class="muted">Сбор в Аманат</span><b>'+(s.captureEnabled?'Включён':'Выключен')+'</b></div><div class="actionrow"><button class="btn primary" id="connect-imo">'+(s.notificationAccess?'Открыть настройки доступа':'Подключить IMO')+'</button><button class="btn" id="toggle-capture">'+(s.captureEnabled?'Остановить сбор':'Включить сбор')+'</button></div><p class="hint">Понятные сообщения создают карточки автоматически при открытом приложении или следующем запуске. Сомнительные сообщения требуют подтверждения в разделе IMO. Резервная копия ниже сохраняет карточки; необработанные уведомления остаются на телефоне.</p></section>':'')+'<section class="panel"><h2>Резервная копия</h2><p class="hint">Копия содержит все карточки, историю выдач, архив и дневные счётчики. Сохраните файл, чтобы восстановить учёт на другом телефоне.</p><div class="actionrow"><button class="btn primary" id="backup">'+icon('download')+'Сохранить копию</button><button class="btn" id="restore">Восстановить</button></div><p class="hint">Восстановление доступно в пустую базу и сохраняет исходные номера. После выбора файла программа проверит его и покажет количество записей.</p><div class="row"><span class="muted">Карточек на телефоне</span><b>'+records.length+'</b></div></section><section class="panel"><h2>Таблица для компьютера</h2><p class="hint">CSV открывается в Excel. Для полного переноса учёта используйте резервную копию JSON.</p><button class="btn" id="export-all">'+icon('download')+'Выгрузить все карточки</button></section><section class="panel"><h2>Архив <span class="muted">'+archived.length+'</span></h2><p class="hint">Архив скрывает полностью выданные передачи из основного списка. Они остаются в статистике и резервной копии.</p>'+(archived.length?archived.map(r=>'<div class="row"><span>№ '+r.serial+' · '+dateLabel(r.day)+'<br><b>'+e(r.recipient)+'</b></span><button class="btn" data-open="'+e(r.id)+'">Открыть</button></div>').join(''):'<p class="hint">Архив пуст.</p>')+'</section><p class="subtle">Аманат 1.3.0 · Учёт Турция → Туркменистан<br>П/н начинается с 1 для каждого дня списка. Данные хранятся на этом устройстве.</p>';
  bindChatButtons();
  $('#settings-form').onsubmit=async ev=>{ev.preventDefault();try{const f=new FormData(ev.target);settings={business:f.get('business').trim()||'Аманат',operator:f.get('operator').trim()};await setMeta('settings',settings);toast('Настройки сохранены');}catch(err){fail(err);}};
  if($('#connect-imo'))$('#connect-imo').onclick=()=>{Android.setCaptureEnabled(true);Android.openNotificationSettings();};
  if($('#toggle-capture'))$('#toggle-capture').onclick=()=>{Android.setCaptureEnabled(!s.captureEnabled);pageSettings();};
  $('#backup').onclick=async()=>{try{saveFile('Amanat-backup-'+today()+'.json','application/json',JSON.stringify(await makeBackup(),null,2));}catch(err){fail(err);}};
  $('#restore').onclick=()=>{if(records.length){fail(new Error('На этом телефоне уже есть записи. Чтобы сохранить их, восстановление доступно только в пустую базу.'));return;}if(native())Android.chooseBackup();else $('#restore-file').click();};
  $('#export-all').onclick=()=>saveFile('Amanat-all-'+today()+'.csv','text/csv',exportCsv(selectRecords(records,{includeArchived:true})));
  $$('[data-open]').forEach(b=>b.onclick=()=>go('#detail/'+b.dataset.open));
}
async function receiveBackup(text){
  try{
    const data=JSON.parse(text);const {validateBackup}=await import('./core.mjs');validateBackup(data);
    modal('Восстановить учёт?','<p>В файле <b>'+data.records.length+'</b> карточек. Будут восстановлены дневные номера и история выдач.</p><p class="hint">Копия создана: '+e(data.exportedAt||'дата не указана')+'</p><button class="btn primary full" id="confirm-restore">Восстановить '+data.records.length+' карточек</button>');
    $('#confirm-restore').onclick=async()=>{try{const count=await restoreBackup(data);$('#modal').close();await refresh();go('#records');toast('Восстановлено карточек: '+count);}catch(err){fail(err);}};
  }catch(err){fail(err instanceof SyntaxError?new Error('Файл не содержит корректную резервную копию JSON.'):err);}
}
let renderedHash=null;
function render(){
  const hash=location.hash||'#records', sameRoute=renderedHash===hash, scroll=sameRoute?window.scrollY:0;
  renderedHash=hash;
  try{
    const [route='records',id]=(location.hash.slice(1)||'records').split('/');
    navigation(['detail','edit','new'].includes(route)?route:route);
    switch(route){case 'records':pageRecords();break;case 'new':if(id==='import'&&draftParsed)pageForm(null,draftParsed);else{importInboxId=null;pageForm();}break;case 'edit':{const r=records.find(x=>x.id===id);r?pageForm(r):go('#records');break;}case 'detail':pageDetail(id);break;case 'inbox':pageInbox();break;case 'stats':pageStats();break;case 'print':pagePrint();break;case 'settings':pageSettings();break;default:go('#records');}
    window.scrollTo(0,scroll);
  }catch(err){fail(err);}
}
let processing=false;
async function processInbox(){
  if(!native()||processing||$('#modal').open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||location.hash.startsWith('#new')||location.hash.startsWith('#edit'))return;
  processing=true;const previousReview=inbox.map(m=>m.id).sort().join(',');
  try{
    await refresh();const pending=JSON.parse(Android.getInbox()).sort((a,b)=>a.timestamp-b.timestamp);
    const review=[];let added=0;
    for(const m of pending){
      const c=candidateForInbox(m);
      const same=records.find(r=>r.sourceInboxId===m.id || (r.day===c.record.day&&r.originalText===c.record.originalText));
      if(same){Android.markInbox(m.id);continue;}
      const seq=sequenceWarnings(records,c.record.day,c.record.serial);
      // A gap warns but never changes the source number. Repeated numbers require review.
      if(records.some(r=>r.day===c.record.day&&r.serial===c.record.serial))c.warnings.push(...seq);
      if(c.warnings.length){review.push({...m,reviewWarnings:c.warnings});continue;}
      const saved=await saveRecord({...c.record,sourceInboxId:m.id,note:[c.record.note,...seq].filter(Boolean).join(' ')});records.push(saved);Android.markInbox(m.id);added++;
    }
    inbox=review;
    if(added)toast('Автоматически создано карточек: '+added);
    if((added||previousReview!==inbox.map(m=>m.id).sort().join(','))&&!location.hash.startsWith('#new')&&!location.hash.startsWith('#edit')&&!$('#modal').open)render();
  }catch(err){toast(errorText(err));}finally{processing=false;}
}
setInterval(processInbox,4000);
window.Amanat={onChatChanged:message=>{toast(message);render();},onSharedText:text=>{importInboxId=null;startImport(text);},onBackup:receiveBackup,onFileSaved:name=>toast('Сохранено: '+name),onError:message=>fail(new Error(message)),onResume:()=>{processInbox();if(location.hash==='#settings')render();},back:()=>{if($('#modal').open){$('#modal').close();return true;}if(location.hash&&location.hash!=='#records'){go('#records');return true;}return false;}};
$('#add').onclick=()=>go('#new');$('#quick-print').innerHTML=icon('print');$('#quick-print').onclick=()=>go('#print');
$('#restore-file').onchange=async ev=>{const file=ev.target.files[0];if(file){if(file.size>30*1024*1024)fail(new Error('Размер копии больше 30 МБ.'));else await receiveBackup(await file.text());}ev.target.value='';};
window.addEventListener('hashchange',render);
window.addEventListener('focus',()=>{processInbox();});
try{await refresh();render();if(native()){Android.ready();await processInbox();}}catch(err){$('#app').innerHTML=empty('Не удалось открыть данные','Откройте приложение повторно. Данные не были изменены.','','');fail(err);}
