package tm.ashyrov.amanat;

import android.app.Notification;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public final class ImoNotificationService extends NotificationListenerService {
    @Override public void onNotificationPosted(StatusBarNotification notification) {
        if (!getSharedPreferences("amanat", MODE_PRIVATE).getBoolean("capture", false)) return;
        String pkg = notification.getPackageName();
        if (!"com.imo.android.imoim".equals(pkg) && !"com.imo.android.imoimhd".equals(pkg)) return;
        Notification n = notification.getNotification();
        if (n == null || n.extras == null || Notification.CATEGORY_CALL.equals(n.category) || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        Bundle extras = n.extras;
        String title = asText(extras.getCharSequence(Notification.EXTRA_TITLE));
        long fallback = n.when > 0 ? n.when : notification.getPostTime();
        try (InboxStore store = new InboxStore(this)) {
            Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
            boolean hasMessage = false;
            if (messages != null) {
                for (Parcelable message : messages) if (message instanceof Bundle) {
                    Bundle item = (Bundle) message;
                    String text = asText(item.getCharSequence("text"));
                    String sender = asText(item.getCharSequence("sender"));
                    if (!text.trim().isEmpty()) {
                        store.add(pkg, sender.isEmpty() ? title : sender, text, item.getLong("time", fallback));
                        hasMessage = true;
                    }
                }
            }
            if (!hasMessage) {
                String text = asText(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
                if (text.isEmpty()) text = asText(extras.getCharSequence(Notification.EXTRA_TEXT));
                store.add(pkg, title, text, fallback);
            }
        } catch (Exception ignored) { }
    }
    private static String asText(CharSequence value) { return value == null ? "" : value.toString(); }
}
