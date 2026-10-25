import {escapeHtml as e,money,status,dateLabel} from './core.mjs';
export function printBody(records){
 let day='',html='';
 for(const r of records.slice().sort((a,b)=>b.day.localeCompare(a.day)||a.serial-b.serial)){
  if(day!==r.day){if(day)html+='</section>';day=r.day;html+='<section class="print-day"><h2>'+dateLabel(day)+'</h2>';}
  const state=status(r),mark=state==='done'?'✓':state==='partial'?'◐':'☐';
  html+='<div class="print-line"><span class="print-text"><span class="print-serial">#'+r.serial+'</span> '+e(r.recipient)+' '+e(r.phone)+' '+e(r.city)+' <b>'+e([r.amountMinor?money(r.amountMinor,r.currency):'',r.parcelTotal?r.parcelTotal+' мест':''].filter(Boolean).join(' · '))+'</b></span><span class="print-mark" aria-label="'+(state==='done'?'Оплачено':state==='partial'?'Частично оплачено':'Не оплачено')+'">'+mark+'</span></div>';
 }
 return html+(day?'</section>':'');
}
export function printDocument(records,opts={}){return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>'+e(opts.business||'Аманат')+' — список</title><style>@page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#172e29;margin:0}h2{font-size:14px;margin:18px 0 6px;break-after:avoid}.print-line{display:flex;align-items:center;gap:12px;border-bottom:1px solid #ddd;padding:9px 0;break-inside:avoid}.print-text{flex:1;overflow-wrap:anywhere;line-height:1.6}.print-serial{font-weight:bold}.print-mark{font-size:22px;flex:none;width:25px;text-align:center}</style></head><body>'+printBody(records)+'</body></html>';}
