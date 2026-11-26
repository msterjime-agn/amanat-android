package tm.ashyrov.amanat;

import android.accessibilityservice.AccessibilityService;
import android.content.SharedPreferences;
import android.app.KeyguardManager;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/** Reads visible text only; never taps, types, scrolls or opens another chat. */
public final class ImoChatService extends AccessibilityService {
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable scan=this::readVisibleChat;
    @Override protected void onServiceConnected() { schedule(); }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) {
        if(event!=null && ImoScreenReader.supported(String.valueOf(event.getPackageName())))schedule();
    }
    private void schedule() { handler.removeCallbacks(scan);handler.postDelayed(scan,450); }
    @Override public void onInterrupt() { handler.removeCallbacks(scan); }
    @Override public void onDestroy() { handler.removeCallbacks(scan);super.onDestroy(); }
    private SharedPreferences prefs(){return getSharedPreferences("amanat",MODE_PRIVATE);}
    private void readVisibleChat() {
        PowerManager power=(PowerManager)getSystemService(POWER_SERVICE);
        KeyguardManager keyguard=(KeyguardManager)getSystemService(KEYGUARD_SERVICE);
        if(power==null||!power.isInteractive()||(keyguard!=null&&keyguard.isKeyguardLocked()))return;
        AccessibilityNodeInfo root=getRootInActiveWindow();
        if(root==null)return;
        try {
            String pkg=String.valueOf(root.getPackageName());
            if(!ImoScreenReader.supported(pkg))return;
            String title=textById(root,pkg+":id/chat_name"), members=textById(root,pkg+":id/last_seen");
            if(!ImoScreenReader.candidate(pkg,title,members))return;
            SharedPreferences p=prefs();
            // Only header metadata is retained before explicit binding.
            p.edit().putString("chatCandidatePkg",pkg).putString("chatCandidateMembers",members)
                    .putLong("chatCandidateAt",System.currentTimeMillis()).apply();
            if(!p.getBoolean("chatCapture",false)||!ImoScreenReader.matches(pkg,title,members,
                    p.getString("chatBoundPkg",""),p.getString("chatBoundMembers","")))return;
            List<AccessibilityNodeInfo> lists=root.findAccessibilityNodeInfosByViewId(pkg+":id/listview");
            try {
                if(lists.size()!=1)return;
                List<ImoScreenReader.Entry> entries=new ArrayList<>();
                collect(lists.get(0),pkg,entries,0,new int[]{0});
                LocalDate today=LocalDate.now(ZoneId.of("Asia/Ashgabat"));
                List<ImoScreenReader.Message> messages=ImoScreenReader.extract(entries,today);
                try(InboxStore store=new InboxStore(this)) {
                    for(ImoScreenReader.Message m:messages) {
                        // Only explicit handover-style messages are collected from the screen.
                        if(!m.text.matches("(?s)^#\\d+\\s+.+")||m.text.length()>20000)continue;
                        store.addScreen(pkg,members,m.text,m.time,m.day,m.warning,m.context);
                    }
                }
                p.edit().putLong("chatLastRead",System.currentTimeMillis()).putInt("chatLastVisible",messages.size()).apply();
            } finally {for(AccessibilityNodeInfo n:lists)n.recycle();}
        } catch(Exception ignored) {
            prefs().edit().putString("chatLastError","Не удалось прочитать экран IMO. Попробуйте открыть группу заново.").apply();
        } finally {root.recycle();}
    }
    private static String textById(AccessibilityNodeInfo root,String id) {
        List<AccessibilityNodeInfo> nodes=root.findAccessibilityNodeInfosByViewId(id);
        try{return nodes.size()==1&&nodes.get(0).getText()!=null?nodes.get(0).getText().toString().trim():"";}
        finally {for(AccessibilityNodeInfo n:nodes)n.recycle();}
    }
    private static void collect(AccessibilityNodeInfo n,String pkg,List<ImoScreenReader.Entry> out,int depth,int[] count) {
        if(depth>60||++count[0]>5000)return;
        if(!n.isVisibleToUser())return;
        String id=n.getViewIdResourceName(),text=n.getText()==null?"":n.getText().toString();
        if((pkg+":id/tv_timestamp_date").equals(id))out.add(new ImoScreenReader.Entry("date",text));
        else if((pkg+":id/tv_message").equals(id))out.add(new ImoScreenReader.Entry("message",text));
        else if((pkg+":id/imkit_date_inside").equals(id))out.add(new ImoScreenReader.Entry("time",text));
        for(int i=0;i<n.getChildCount();i++) {
            AccessibilityNodeInfo child=n.getChild(i);
            if(child!=null)try{collect(child,pkg,out,depth+1,count);}finally{child.recycle();}
        }
    }
}
