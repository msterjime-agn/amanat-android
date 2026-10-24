import {validateRecord,validateBackup,status,uid} from './core.mjs';
let connection;
export function openDb() {
  if(connection) return Promise.resolve(connection);
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('amanat-v1',1);
    req.onupgradeneeded=()=>{const db=req.result;const s=db.createObjectStore('records',{keyPath:'id'});s.createIndex('dayNumber',['day','serial'],{unique:true});db.createObjectStore('meta',{keyPath:'key'});};
    req.onsuccess=()=>{connection=req.result;connection.onversionchange=()=>{connection.close();connection=null;};resolve(connection);};
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(new Error('Закройте другие вкладки приложения и откройте его снова.'));
  });
}
const requestResult=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
export async function allRecords(){const db=await openDb();return requestResult(db.transaction('records').objectStore('records').getAll());}
export async function meta(key){const db=await openDb();return (await requestResult(db.transaction('meta').objectStore('meta').get(key)))?.value;}
export async function setMeta(key,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('meta','readwrite');tx.objectStore('meta').put({key,value});tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);});}
export async function saveRecord(record,expectedUpdatedAt){
  validateRecord(record);
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['records','meta'],'readwrite');const records=tx.objectStore('records'), m=tx.objectStore('meta');
    let result, error;
    const fail=msg=>{error=new Error(msg);tx.abort();};
    if(!record.id){
      const req=m.get('seq:'+record.day);
      req.onsuccess=()=>{const serial=(req.result?.value||0)+1;result={...record,id:uid(),serial,history:[],archived:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};m.put({key:'seq:'+record.day,value:serial});records.add(result);};
    }else{
      const req=records.get(record.id);
      req.onsuccess=()=>{
        const old=req.result;
        if(!old) return fail('Запись не найдена. Обновите список.');
        if(expectedUpdatedAt && old.updatedAt!==expectedUpdatedAt) return fail('Запись уже изменена в другой вкладке. Откройте её заново.');
        if(old.day!==record.day || old.serial!==record.serial) return fail('День списка и п/н сохраняются после регистрации.');
        if(old.currency!==record.currency && old.history?.length) return fail('После выдачи валюта записи сохраняется.');
        if(record.archived && status(record)!=='done') return fail('В архив можно перенести только полностью выданную передачу.');
        result={...record,createdAt:old.createdAt,updatedAt:new Date(Math.max(Date.now(),Date.parse(old.updatedAt)+1)).toISOString()};records.put(result);
      };
    }
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(error||tx.error||new Error('Не удалось сохранить запись.'));tx.onabort=()=>reject(error||tx.error||new Error('Сохранение отменено.'));
  });
}
export async function makeBackup(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['records','meta']);let records,metadata;
    tx.objectStore('records').getAll().onsuccess=e=>records=e.target.result;
    tx.objectStore('meta').getAll().onsuccess=e=>metadata=e.target.result;
    tx.oncomplete=()=>resolve({app:'amanat',version:1,exportedAt:new Date().toISOString(),records,sequences:Object.fromEntries(metadata.filter(x=>x.key.startsWith('seq:')).map(x=>[x.key.slice(4),x.value])),settings:metadata.find(x=>x.key==='settings')?.value || {}});
    tx.onerror=()=>reject(tx.error);
  });
}
export async function restoreBackup(raw){
  const data=validateBackup(raw);const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['records','meta'],'readwrite'),r=tx.objectStore('records'),m=tx.objectStore('meta');let err;
    const q=r.count();q.onsuccess=()=>{
      if(q.result!==0){err=new Error('Восстановление возможно в пустую базу. Текущие записи не были изменены.');tx.abort();return;}
      const seq={...data.sequences};for(const rec of data.records){r.add(rec);seq[rec.day]=Math.max(seq[rec.day]||0,rec.serial);}
      for(const [day,value] of Object.entries(seq))m.put({key:'seq:'+day,value});
      if(data.settings)m.put({key:'settings',value:data.settings});
    };
    tx.oncomplete=()=>resolve(data.records.length);tx.onerror=()=>reject(err||tx.error);tx.onabort=()=>reject(err||tx.error);
  });
}
