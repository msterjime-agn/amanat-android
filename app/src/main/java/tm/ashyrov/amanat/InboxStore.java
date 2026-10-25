package tm.ashyrov.amanat;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

final class InboxStore extends SQLiteOpenHelper {
    InboxStore(Context context) { super(context, "imo-inbox.db", null, 2); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE inbox (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, stamp INTEGER NOT NULL, processed INTEGER NOT NULL DEFAULT 0, screen_meta TEXT NOT NULL DEFAULT '')");
        db.execSQL("CREATE INDEX inbox_pending ON inbox(processed, stamp)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if(oldVersion<2)db.execSQL("ALTER TABLE inbox ADD COLUMN screen_meta TEXT NOT NULL DEFAULT ''");
    }
    void add(String app, String title, String text, long stamp) {
        if (text == null || text.trim().isEmpty()) return;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest((app + "\n" + title + "\n" + text + "\n" + stamp).getBytes(StandardCharsets.UTF_8));
            StringBuilder id = new StringBuilder();
            for (byte b : digest) id.append(String.format("%02x", b & 0xff));
            ContentValues cv = new ContentValues();
            cv.put("id", id.toString()); cv.put("title", title); cv.put("body", text); cv.put("stamp", stamp);
            getWritableDatabase().insertWithOnConflict("inbox", null, cv, SQLiteDatabase.CONFLICT_IGNORE);
        } catch (Exception ignored) { }
    }
    void addScreen(String pkg,String members,String text,String time,String day,String warning,String context) {
        try {
            // No capture timestamp in the key: repeated screen events are idempotent.
            String identity="screen\n"+pkg+"\n"+members+"\n"+day+"\n"+context+"\n"+time+"\n"+text;
            byte[] digest=MessageDigest.getInstance("SHA-256").digest(identity.getBytes(StandardCharsets.UTF_8));
            StringBuilder id=new StringBuilder();for(byte b:digest)id.append(String.format("%02x",b&255));
            JSONObject metadata=new JSONObject();metadata.put("day",day);metadata.put("warning",warning);metadata.put("time",time);
            ContentValues cv=new ContentValues();cv.put("id",id.toString());cv.put("title","Amanat · чат");cv.put("body",text);cv.put("stamp",System.currentTimeMillis());cv.put("screen_meta",metadata.toString());
            getWritableDatabase().insertWithOnConflict("inbox",null,cv,SQLiteDatabase.CONFLICT_IGNORE);
        } catch(Exception ignored) { }
    }
    String pendingJson() {
        JSONArray list = new JSONArray();
        try (Cursor cursor = getReadableDatabase().query("inbox", new String[]{"id", "title", "body", "stamp", "screen_meta"}, "processed=0", null, null, null, "stamp DESC")) {
            while (cursor.moveToNext()) {
                JSONObject item = new JSONObject();
                item.put("id", cursor.getString(0)); item.put("title", cursor.getString(1)); item.put("text", cursor.getString(2)); item.put("timestamp", cursor.getLong(3)); if(!cursor.getString(4).isEmpty())item.put("screen",new JSONObject(cursor.getString(4))); list.put(item);
            }
        } catch (Exception ignored) { }
        return list.toString();
    }
    void mark(String id) {
        ContentValues values = new ContentValues(); values.put("processed", 1);
        getWritableDatabase().update("inbox", values, "id=?", new String[]{id});
    }
}
