export const CURRENCIES = ['USD', 'TMT', 'TRY', 'EUR', 'RUB'];
export const CITIES = ['Ашхабад', 'Дашогуз', 'Кёнеургенч', 'Туркменабат', 'Мары', 'Байрамали', 'Балканабат', 'Туркменбаши', 'Теджен', 'Гёкдепе', 'Акдепе', 'Болдумсаз', 'Шават'];
export const TYPES = {money:'Деньги', parcel:'Почта / посылка', both:'Деньги и посылка'};
export function uid(){
  if(typeof crypto.randomUUID==='function') return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const h=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
export function today(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Ashgabat',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(value+'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0,10) === value;
}
export function dateLabel(value) { return validDate(value) ? value.split('-').reverse().join('.') : '—'; }
export function parseMoney(value) {
  let s = String(value ?? '').trim().replace(/[\s\u00a0\u202f]/g,'');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    const dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thousands = dec === ',' ? '.' : ',';
    s = s.split(thousands).join('').replace(dec,'.');
  } else if (s.includes(',')) s = s.replace(',','.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) throw new Error('Сумма: используйте положительное число, не более двух знаков после запятой.');
  const [whole, cents=''] = s.split('.');
  const n = Number(whole)*100 + Number(cents.padEnd(2,'0'));
  if (!Number.isSafeInteger(n) || n > 999999999999) throw new Error('Слишком большая сумма.');
  return n;
}
export function moneyValue(minor) { return (minor / 100).toFixed(2); }
export function money(minor, currency='USD') {
  return new Intl.NumberFormat('ru-RU',{minimumFractionDigits: minor % 100 ? 2 : 0,maximumFractionDigits:2}).format(minor/100)+' '+currency;
}
export function normalizePhone(s) {
  let p = String(s || '').replace(/[^\d+]/g,'');
  if (/^00\d/.test(p)) p = '+'+p.slice(2);
  if (/^6\d{7}$/.test(p)) p = '+993'+p;
  if (/^993\d{8}$/.test(p)) p = '+'+p;
  return p;
}
export function validatePhone(s) { return /^\+?\d{7,15}$/.test(normalizePhone(s)); }
export function totals(r) {
  const active = (r.history || []).filter(h=>!h.voidedAt);
  const paid = active.reduce((a,h)=>a+h.amountMinor,0);
  const parcels = active.reduce((a,h)=>a+h.parcels,0);
  return {paid,parcels,remaining: r.amountMinor-paid, parcelsRemaining:r.parcelTotal-parcels};
}
export function status(r) {
  const t = totals(r);
  if (t.remaining === 0 && t.parcelsRemaining === 0) return 'done';
  return t.paid > 0 || t.parcels > 0 ? 'partial' : 'waiting';
}
export const STATUS = {waiting:'Ожидает выдачи',partial:'Выдано частично',done:'Выдано'};
export function validateRecord(r) {
  if (!Object.hasOwn(TYPES,r.type)) throw new Error('Выберите тип передачи.');
  if (!r.recipient?.trim()) throw new Error('Укажите имя получателя.');
  if (!validatePhone(r.phone)) throw new Error('Укажите телефон получателя: от 7 до 15 цифр.');
  if (!r.city?.trim()) throw new Error('Укажите город выдачи.');
  if (!validDate(r.day) || r.day > today()) throw new Error('День списка: укажите существующую дату, не позднее сегодняшней.');
  if (!validDate(r.receivedDate) || r.receivedDate > today()) throw new Error('Проверьте дату приёма.');
  if (r.messageDate && (!validDate(r.messageDate) || r.messageDate > today())) throw new Error('Проверьте дату сообщения.');
  if (!CURRENCIES.includes(r.currency)) throw new Error('Выберите валюту.');
  if (!Number.isSafeInteger(r.amountMinor) || r.amountMinor<0 || r.amountMinor>999999999999) throw new Error('Проверьте сумму.');
  if (!Number.isInteger(r.parcelTotal) || r.parcelTotal<0 || r.parcelTotal>10000) throw new Error('Количество мест: целое число от 0 до 10 000.');
  if (r.type!=='parcel' && r.amountMinor<=0) throw new Error('Укажите сумму денег.');
  if (r.type!=='money' && r.parcelTotal<=0) throw new Error('Укажите количество мест посылки.');
  if (r.type==='money' && r.parcelTotal!==0) throw new Error('Для денежной передачи количество посылок должно быть 0.');
  if (r.type==='parcel' && r.amountMinor!==0) throw new Error('Для посылки без денег сумма должна быть 0.');
  const t = totals(r);
  if (t.remaining<0 || t.parcelsRemaining<0) throw new Error('Всего не может быть меньше уже выданного. Сначала исправьте выдачу.');
  for (const h of r.history || []) {
    if (!h.id || !validDate(h.date) || h.date>today() || h.date<r.receivedDate) throw new Error('Дата выдачи должна быть между датой приёма и сегодняшним днём.');
    if (!Number.isSafeInteger(h.amountMinor) || h.amountMinor<0 || !Number.isInteger(h.parcels) || h.parcels<0 || (h.amountMinor===0 && h.parcels===0)) throw new Error('Проверьте данные выдачи.');
    if (!h.deliveredTo?.trim()) throw new Error('Укажите, кто получил передачу.');
  }
  return r;
}
export function within(date,from,to) { return (!from || date>=from) && (!to || date<=to); }
export function selectRecords(records, f={}) {
  const q = (f.q || '').toLocaleLowerCase().trim();
  const digits = q.replace(/\D/g,'');
  return records.filter(r=>{
    if (!f.includeArchived && r.archived) return false;
    if (f.onlyArchived && !r.archived) return false;
    if (f.city && r.city!==f.city) return false;
    if (f.type && r.type!==f.type) return false;
    if (f.currency && r.currency!==f.currency) return false;
    if (f.status && (f.status==='open' ? status(r)==='done' : status(r)!==f.status)) return false;
    if (q && ![r.recipient,r.phone,r.city,r.sender,r.note,r.serial+'',dateLabel(r.day)].join(' ').toLocaleLowerCase().includes(q) && !(digits.length>=4 && r.phone.replace(/\D/g,'').includes(digits))) return false;
    if (f.basis==='issued') return (r.history || []).some(h=>!h.voidedAt && within(h.date,f.from,f.to));
    return within(f.basis==='received' ? r.receivedDate : r.day,f.from,f.to);
  }).sort((a,b)=>b.day.localeCompare(a.day) || a.serial-b.serial);
}
export function aggregate(records,from='',to='') {
  const groups = {};
  let count=0,done=0,parcelReceived=0,parcelIssued=0;
  for (const r of records) {
    const received = within(r.receivedDate,from,to);
    const hist = (r.history || []).filter(h=>!h.voidedAt && within(h.date,from,to));
    if (received) {count++; if(status(r)==='done') done++; parcelReceived+=r.parcelTotal;}
    parcelIssued+=hist.reduce((s,h)=>s+h.parcels,0);
    const t=totals(r);
    if(r.amountMinor) {
      const g=groups[r.currency] ||= {received:0,issued:0,opening:0,closing:0,outstanding:0};
      if (received) g.received+=r.amountMinor;
      g.issued+=hist.reduce((s,h)=>s+h.amountMinor,0);
      if (from) {
        if(r.receivedDate<from) g.opening+=r.amountMinor;
        g.opening-=(r.history||[]).filter(h=>!h.voidedAt && h.date<from).reduce((s,h)=>s+h.amountMinor,0);
      }
      if(!to || r.receivedDate<=to) g.closing+=r.amountMinor;
      g.closing-=(r.history||[]).filter(h=>!h.voidedAt && (!to||h.date<=to)).reduce((s,h)=>s+h.amountMinor,0);
      g.outstanding+=t.remaining;
    }
  }
  return {groups,count,done,parcelReceived,parcelIssued};
}
const cities = [
  ['Ашхабад',['ашхабад','ашгабат','ashgabat','aşgabat']],['Дашогуз',['дашогуз','дашховуз','dashoguz','daşoguz','dasoguz']],
  ['Кёнеургенч',['кёнеургенч','куняургенч','конеургенч','köneürgenç','koneurgench','koneurgenc']],['Туркменабат',['туркменабат','turkmenabat','türkmenabat']],
  ['Мары',['мары','mary']],['Балканабат',['балканабат','balkanabat']],['Туркменбаши',['туркменбаши','türkmenbaşy','turkmenbashi']],
  ['Байрамали',['байрамали','baýramaly','bayramaly']],['Акдепе',['акдепе','akdepe']],['Болдумсаз',['болдумсаз','boldumsaz']],['Шават',['шават','şabat','shavat']]
];
export function parseMessage(text) {
  const raw=String(text || '').trim();
  const result={originalText:raw,type:'money',recipient:'',phone:'',city:'',sender:'',amount:'',currency:'',parcelTotal:'',parcelDesc:'',messageDate:'',warnings:[]};
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const compact=raw.replace(/\s+/gu,' ').match(/^(?:[^\n:]{1,100}:\s*)?#(\d+)\s+(.+?)\s+(\+?\d{7,15})\s+(.+?)\s+(\d+(?:[.,]\d{1,2})?)\s*(USD|\$|TMT|TRY|EUR|RUB)\s*$/iu);
  if(compact){
    result.recipient=compact[2].trim();result.phone=normalizePhone(compact[3]);result.city=compact[4].trim();result.amount=compact[5];result.currency=compact[6]==='$'?'USD':compact[6].toUpperCase();
    result.serial=Number(compact[1]);
    if(!Number.isSafeInteger(result.serial)||result.serial<1) result.warnings.push('Проверьте п/н сообщения.');
    if(!/^[\p{L}][\p{L} .’'—-]*$/u.test(result.recipient)) result.warnings.push('Проверьте имя получателя.');
    return result;
  }

  const serialMatch=raw.match(/(?:^|\s)#(\d+)\b/u);
  if(serialMatch) result.serial=Number(serialMatch[1]);
  const get = labels=> {
    const re = new RegExp('^(?:'+labels+')\\s*[:=–—-]\\s*(.+)$','iu');
    return lines.map(l=>l.match(re)).find(Boolean)?.[1]?.trim() || '';
  };
  result.recipient=get('получатель|кому|фио|имя|адресат|alyjy|aljy|alıcı|alici|recipient|name');
  result.sender=get('отправитель|от кого|gönderici|gonderici|iberiji|sender');
  result.city=get('город|город выдачи|şäher|saher|şehr|şehir|sehir|city');
  const phoneLines=lines.filter(l=>!/^.*(?:отправител|gönderici|sender)/iu.test(l));
  const candidates=phoneLines.flatMap(l=>[...l.matchAll(/(?:\+|00)?\d[\d ()-]{5,19}\d/g)].map(m=>m[0])).filter(p=>validatePhone(p));
  result.phone=normalizePhone(get('телефон|тел|номер телефона|telefon|phone') || candidates[0] || '');
  if(candidates.length>1 && new Set(candidates.map(normalizePhone)).size>1) result.warnings.push('В сообщении несколько телефонов: проверьте телефон получателя.');
  const low=raw.toLocaleLowerCase();
  if(!result.city) result.city=cities.find(([,aliases])=>aliases.some(a=>new RegExp('(?:^|[^\\p{L}])'+a+'(?:$|[^\\p{L}])','iu').test(low)))?.[0] || '';
  const currencyNames='USD|TMT|TRY|EUR|RUB|\\$|€|₺|₽|доллар(?:ов|а)?|долл\\.?|манат(?:ов|а)?|лир(?:а|ы)?|руб(?:лей|ля)?|dollar|manat|lira';
  const currencyOf=s=> /USD|\$|долл|dollar/iu.test(s)?'USD':/TMT|манат|manat/iu.test(s)?'TMT':/TRY|₺|лир|lira/iu.test(s)?'TRY':/EUR|€|евро/iu.test(s)?'EUR':/RUB|₽|руб/iu.test(s)?'RUB':'';
  const amountRe=new RegExp('(\\d[\\d \\u00a0.,]*)\\s*('+currencyNames+')|('+currencyNames+')\\s*(\\d[\\d \\u00a0.,]*)(?![\\d.,])','giu');
  const amounts=[...raw.matchAll(amountRe)];
  if(amounts.length===1) {
    const amount=(amounts[0][1] || amounts[0][4]).trim();
    try {parseMoney(amount);result.amount=amount;result.currency=currencyOf(amounts[0][2] || amounts[0][3]);}
    catch {result.warnings.push('Формат суммы неоднозначен: укажите сумму и валюту вручную.');}
  }
  else if(amounts.length>1) result.warnings.push('Найдено несколько сумм: укажите нужную сумму и валюту вручную.');
  else {
    const labeled=get('сумма|сумма к выдаче|amount|tutar|möçber|mocber');
    if(labeled && /^\d[\d\s.,]*$/.test(labeled)) result.amount=labeled;
    const c=get('валюта|currency|para birimi');
    if(c) result.currency=currencyOf(c);
  }
  const parcel=/посыл|почт|бандерол|kargo|paket|poçta|pochta/iu.test(raw);
  if(parcel) {result.type=result.amount?'both':'parcel'; result.parcelDesc=get('посылка|описание|содержимое|kargo|paket|poçta|почта') || ''; result.parcelTotal=raw.match(/(\d+)\s*(?:мест(?:а|о)?|шт\.?|adet|sany)/iu)?.[1] || '';}
  const dt=get('дата сообщения|дата|tarih|date').match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if(dt) {const d=dt[3]+'-'+dt[2].padStart(2,'0')+'-'+dt[1].padStart(2,'0'); if(validDate(d)) result.messageDate=d;}
  if(!result.recipient) result.warnings.push('Имя получателя не определено.');
  if(!result.phone) result.warnings.push('Телефон получателя не определён.');
  if(!result.city) result.warnings.push('Город выдачи не определён.');
  if(result.type!=='parcel' && (!result.amount || !result.currency)) result.warnings.push('Проверьте сумму и валюту.');
  if(parcel && !result.parcelTotal) result.warnings.push('Укажите количество мест посылки.');
  return result;
}
export function escapeHtml(value) {return String(value ?? '').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
export function csvCell(v) {let s=String(v ?? ''); if(/^[=+@-]/.test(s)) s="'"+s; return '"'+s.replaceAll('"','""')+'"';}
export function exportCsv(records) {
  const rows=[['П/н','День списка','Дата приёма','Получатель','Телефон','Город','Тип','Всего денег','Валюта','Выдано денег','Остаток денег','Всего мест','Выдано мест','Остаток мест','Статус','Отправитель','Даты выдачи','Примечание','Внутренний ID']];
  for(const r of records) {const t=totals(r); rows.push([r.serial,dateLabel(r.day),dateLabel(r.receivedDate),r.recipient,r.phone,r.city,TYPES[r.type],moneyValue(r.amountMinor),r.currency,moneyValue(t.paid),moneyValue(t.remaining),r.parcelTotal,t.parcels,t.parcelsRemaining,STATUS[status(r)],r.sender,(r.history||[]).filter(h=>!h.voidedAt).map(h=>dateLabel(h.date)).join(', '),r.note,r.id]);}
  return '\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
}
export function validateBackup(data) {
  if(data?.app!=='amanat' || data.version!==1 || !Array.isArray(data.records) || data.records.length>50000) throw new Error('Это не резервная копия Аманат версии 1.');
  const ids=new Set(), nums=new Set();
  for(const r of data.records) {
    validateRecord(r);
    if(typeof r.id!=='string'||!r.id||ids.has(r.id)||!Number.isSafeInteger(r.serial)||r.serial<1) throw new Error('Повреждены номера записей в копии.');
    const num=r.day+':'+r.serial;
    const hids=new Set(); for(const h of r.history||[]) {if(hids.has(h.id)) throw new Error('В копии повторяется выдача.'); hids.add(h.id);}
    ids.add(r.id); nums.add(num);
  }
  if(!data.sequences || typeof data.sequences!=='object' || Array.isArray(data.sequences)) throw new Error('В копии нет счётчиков нумерации.');
  for(const [day,n] of Object.entries(data.sequences)) if(!validDate(day)||!Number.isSafeInteger(n)||n<0) throw new Error('Повреждены счётчики нумерации.');
  return data;
}

export function sequenceWarnings(records,day,serial) {
  const same=records.filter(r=>r.day===day);
  if(same.some(r=>r.serial===serial)) return ['П/н #'+serial+' за этот день уже существует. Подтвердите отдельную передачу.'];
  const expected=Math.max(0,...same.map(r=>r.serial))+1;
  return serial===expected?[]:['Нарушен порядок п/н: ожидался #'+expected+', получен #'+serial+'. Номер сохранится как в IMO.'];
}
export function importCandidate(text,timestamp=Date.now()) {
  const p=parseMessage(text), day=today(new Date(timestamp));
  const record={...p,day,receivedDate:day,messageDate:p.messageDate||day,amountMinor:0,currency:p.currency||'',parcelTotal:p.type==='money'?0:Number(p.parcelTotal),history:[],archived:false,note:'',senderPhone:''};
  const warnings=[...p.warnings];
  try {record.amountMinor=p.type==='parcel'?0:parseMoney(p.amount);validateRecord(record);} catch(err){warnings.push(err.message);}
  if(!Number.isSafeInteger(p.serial)||p.serial<1) warnings.push('П/н сообщения не определён.');
  return {record,parsed:{...p,day,receivedDate:day,messageDate:record.messageDate},warnings:[...new Set(warnings)]};
}
