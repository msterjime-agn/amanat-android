package tm.ashyrov.amanat;

import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

final class CallIndexStore extends SQLiteOpenHelper {
    CallIndexStore(Context c){super(c,"call-index.db",null,1);}
    @Override public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE cards (id TEXT PRIMARY KEY, phone TEXT NOT NULL, day TEXT NOT NULL, serial INTEGER NOT NULL, label TEXT NOT NULL)");db.execSQL("CREATE INDEX cards_phone ON cards(phone,day)");}
    @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion){}
    void replace(String json) throws Exception {
        JSONArray rows=new JSONArray(json);
        if(rows.length()>50000)throw new IllegalArgumentException("Слишком много карточек");
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try{db.delete("cards",null,null);for(int i=0;i<rows.length();i++){
            JSONObject r=rows.getJSONObject(i);String key=CallNumbers.key(r.getString("phone"));if(key.isEmpty())continue;
            ContentValues v=new ContentValues();v.put("id",r.getString("id"));v.put("phone",key);v.put("day",r.getString("day"));v.put("serial",r.getInt("serial"));v.put("label",r.getString("label"));db.insertOrThrow("cards",null,v);
        }db.setTransactionSuccessful();}finally{db.endTransaction();}
    }
    List<String> lookup(String phone){
        List<String> rows=new ArrayList<>();String key=CallNumbers.key(phone);if(key.isEmpty())return rows;
        try(Cursor c=getReadableDatabase().query("cards",new String[]{"label"},"phone=?",new String[]{key},null,null,"day DESC, serial ASC")){while(c.moveToNext())rows.add(c.getString(0));}return rows;
    }
}
