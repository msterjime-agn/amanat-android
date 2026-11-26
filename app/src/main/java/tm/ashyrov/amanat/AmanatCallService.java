package tm.ashyrov.amanat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.telecom.Call;
import android.telecom.CallScreeningService;
import java.util.List;

/** Caller ID only: immediately allows incoming calls and never changes call handling. */
public final class AmanatCallService extends CallScreeningService {
    static final String CHANNEL="amanat-caller-id";
    @Override public void onScreenCall(Call.Details call){
        if(Build.VERSION.SDK_INT<29){respondToCall(call,new CallResponse.Builder().build());return;}
        boolean incoming=call.getCallDirection()==Call.Details.DIRECTION_INCOMING;
        if(incoming)respondToCall(call,new CallResponse.Builder().setDisallowCall(false).setRejectCall(false).setSkipCallLog(false).setSkipNotification(false).build());
        if(!getSharedPreferences("amanat",MODE_PRIVATE).getBoolean("callerEnabled",false))return;
        Uri handle=call.getHandle();if(handle==null||!"tel".equals(handle.getScheme()))return;
        String number=handle.getSchemeSpecificPart();
        try(CallIndexStore store=new CallIndexStore(this)){
            List<String> matches=store.lookup(number);
            NotificationManager manager=getSystemService(NotificationManager.class);if(manager==null)return;
            manager.cancel(407);
            if(matches.isEmpty())return;
            NotificationChannel channel=new NotificationChannel(CHANNEL,"Передачи при звонках",NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Получатель, номер передачи, дата и статус");channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);manager.createNotificationChannel(channel);
            Intent open=new Intent(this,MainActivity.class).putExtra("callNumber",number).setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent action=PendingIntent.getActivity(this,407,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            String title=(incoming?"Входящий":"Исходящий")+" · Аманат · "+matches.size()+" передач";
            String body=String.join("\n",matches.subList(0,Math.min(6,matches.size())))+(matches.size()>6?"\nЕщё: "+(matches.size()-6):"");
            Notification hidden=new Notification.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_amanat).setContentTitle("Аманат: найдены передачи").build();
            Notification notice=new Notification.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_amanat).setContentTitle(title).setContentText(matches.get(0)).setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(action).setAutoCancel(true).setTimeoutAfter(120000).setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(hidden).build();
            if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)return;
            manager.notify(407,notice);
            getSharedPreferences("amanat",MODE_PRIVATE).edit().remove("callerError").apply();
        }catch(Exception error){getSharedPreferences("amanat",MODE_PRIVATE).edit().putString("callerError","Не удалось показать подсказку звонка. Проверьте разрешение уведомлений.").apply();}
    }
}
