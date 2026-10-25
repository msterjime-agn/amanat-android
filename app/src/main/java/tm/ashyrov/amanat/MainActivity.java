package tm.ashyrov.amanat;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://amanat.local/";
    private static final int SAVE_FILE = 101, OPEN_BACKUP = 102;
    private WebView webView, printView;
    private boolean pageReady = false;
    private String pendingText;
    private byte[] pendingSave;
    private String pendingFilename;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setBackgroundColor(Color.rgb(246, 247, 243));
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                return insets;
            });
        }
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        webView = new WebView(this);
        root.addView(webView, new LinearLayout.LayoutParams(-1, -1));
        setContentView(root);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true); ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(false); ws.setAllowContentAccess(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        ws.setBlockNetworkLoads(true); ws.setSupportMultipleWindows(false);
        webView.setWebViewClient(new LocalClient());
        webView.addJavascriptInterface(new Bridge(), "Android");
        consumeIntent(getIntent());
        webView.loadUrl(ORIGIN + "index.html");
    }
    private final class LocalClient extends WebViewClient {
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!"https".equals(url.getScheme()) || !"amanat.local".equals(url.getHost())) return denied();
            String path = url.getPath();
            if (path == null || path.contains("..") || !path.matches("/[a-zA-Z0-9._-]+")) return denied();
            try {
                InputStream bytes = getAssets().open("web" + path);
                String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".css") ? "text/css" : path.endsWith(".mjs") ? "application/javascript" : "application/octet-stream";
                return new WebResourceResponse(mime, "UTF-8", 200, "OK", Collections.singletonMap("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'"), bytes);
            } catch (Exception ignored) { return denied(); }
        }
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if ("https".equals(u.getScheme()) && "amanat.local".equals(u.getHost())) return false;
            if (request.isForMainFrame() && "tel".equals(u.getScheme()) && u.getSchemeSpecificPart().matches("\\+?[0-9 ()-]{7,25}")) {
                try { startActivity(new Intent(Intent.ACTION_DIAL, u)); } catch (ActivityNotFoundException ignored) { }
            }
            return true;
        }
    }
    private static WebResourceResponse denied() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", null, new ByteArrayInputStream(new byte[0]));
    }
    private void send(String function, String argument) {
        if (!pageReady) return;
        runOnUiThread(() -> webView.evaluateJavascript("window.Amanat && window.Amanat." + function + "(" + JSONObject.quote(argument) + ");", null));
    }
    private void consumeIntent(Intent intent) {
        if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
            CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (text != null) pendingText = text.toString();
        }
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent); consumeIntent(intent);
        if (pageReady && pendingText != null) { send("onSharedText", pendingText); pendingText = null; }
    }
    @Override protected void onResume() {
        super.onResume();
        if (pageReady) webView.evaluateJavascript("window.Amanat && window.Amanat.onResume();", null);
    }
    @Override public void onBackPressed() {
        webView.evaluateJavascript("window.Amanat ? window.Amanat.back() : false", handled -> { if (!"true".equals(handled)) finish(); });
    }
    private final class Bridge {
        @JavascriptInterface public void ready() {
            runOnUiThread(() -> {
                pageReady = true;
                if (pendingText != null) { send("onSharedText", pendingText); pendingText = null; }
            });
        }
        @JavascriptInterface public String getState() {
            JSONObject state = new JSONObject();
            try {
                ComponentName component = new ComponentName(MainActivity.this, ImoNotificationService.class);
                boolean access;
                if (Build.VERSION.SDK_INT >= 27) access = getSystemService(NotificationManager.class).isNotificationListenerAccessGranted(component);
                else {
                    String all = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
                    access = all != null && (":" + all + ":").contains(":" + component.flattenToString() + ":");
                }
                state.put("notificationAccess", access);
                state.put("captureEnabled", getSharedPreferences("amanat", MODE_PRIVATE).getBoolean("capture", false));
                android.content.SharedPreferences chat=getSharedPreferences("amanat",MODE_PRIVATE);
                boolean chatAccess=false;
                android.view.accessibility.AccessibilityManager manager=(android.view.accessibility.AccessibilityManager)getSystemService(ACCESSIBILITY_SERVICE);
                if(manager!=null)for(android.accessibilityservice.AccessibilityServiceInfo info:manager.getEnabledAccessibilityServiceList(android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK)) {
                    android.content.pm.ServiceInfo si=info.getResolveInfo().serviceInfo;
                    if(getPackageName().equals(si.packageName)&&ImoChatService.class.getName().equals(si.name))chatAccess=true;
                }
                state.put("chatAccess",chatAccess);
                state.put("chatCapture",chat.getBoolean("chatCapture",false));
                state.put("chatBound",!chat.getString("chatBoundMembers","").isEmpty());
                state.put("chatMembers",chat.getString("chatBoundMembers",""));
                state.put("chatCandidate",chat.getString("chatCandidateMembers",""));
                state.put("chatCandidateAt",chat.getLong("chatCandidateAt",0));
                state.put("chatLastRead",chat.getLong("chatLastRead",0));
                state.put("chatLastVisible",chat.getInt("chatLastVisible",0));
            } catch (Exception ignored) { }
            return state.toString();
        }
        @JavascriptInterface public void setCaptureEnabled(boolean enabled) { getSharedPreferences("amanat", MODE_PRIVATE).edit().putBoolean("capture", enabled).apply(); }
        @JavascriptInterface public void openNotificationSettings() {
            runOnUiThread(() -> {
                new AlertDialog.Builder(MainActivity.this).setTitle("Уведомления IMO").setMessage("Android предложит доступ к уведомлениям. Аманат сохраняет только текст уведомлений IMO на этом телефоне. Разрешение можно отключить в любой момент.")
                    .setNegativeButton("Отмена", (d, w) -> { })
                    .setPositiveButton("Открыть настройки", (d, w) -> {
                        try { startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); }
                        catch (ActivityNotFoundException error) { send("onError", "Не удалось открыть настройки доступа к уведомлениям."); }
                    }).show();
            });
        }
        @JavascriptInterface public void openChatSettings() {
            runOnUiThread(()->new AlertDialog.Builder(MainActivity.this)
                .setTitle("Чтение открытой группы IMO")
                .setMessage("Служба специальных возможностей видит текст открытого окна IMO. После привязки она сохраняет только видимые передачи из Amanat на этом телефоне, даже при закрытом окне Аманата. Не отправляет сообщения и не нажимает кнопки. Неполные даты требуют проверки. Включите службу «Аманат: чтение группы IMO», затем откройте Amanat в IMO, вернитесь сюда и подтвердите привязку. Разрешение можно отозвать в любой момент.")
                .setNegativeButton("Отмена",(d,w)->{})
                .setPositiveButton("Открыть настройки",(d,w)->{
                    try {startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));}
                    catch(ActivityNotFoundException error){send("onError","Не удалось открыть специальные возможности.");}
                }).show());
        }
        @JavascriptInterface public void bindChat() {
            // Always show the exact recent header to the user before persisting a binding.
            runOnUiThread(()->{
                android.content.SharedPreferences p=getSharedPreferences("amanat",MODE_PRIVATE);
                String pkg=p.getString("chatCandidatePkg",""), members=p.getString("chatCandidateMembers","");
                long age=System.currentTimeMillis()-p.getLong("chatCandidateAt",0);
                if(age<0||age>180000||!ImoScreenReader.candidate(pkg,"Amanat",members)) {
                    send("onError","Сначала откройте группу Amanat в IMO на пару секунд, затем вернитесь и нажмите «Привязать».");return;
                }
                new AlertDialog.Builder(MainActivity.this).setTitle("Привязать группу Amanat?")
                    .setMessage("Участники в заголовке: "+members+"\n\nБудут читаться передачи только при совпадении приложения, названия и этой строки. При изменении состава потребуется повторная привязка. Два чата с одинаковым названием и одинаковой строкой участников этим способом различить нельзя.")
                    .setNegativeButton("Отмена",(d,w)->{})
                    .setPositiveButton("Привязать",(d,w)->{
                        p.edit().putString("chatBoundPkg",pkg).putString("chatBoundMembers",members).putBoolean("chatCapture",true).apply();
                        send("onChatChanged","Группа привязана. Откройте её в IMO ещё раз для чтения.");
                    }).show();
            });
        }
        @JavascriptInterface public void pauseChat() {
            getSharedPreferences("amanat",MODE_PRIVATE).edit().putBoolean("chatCapture",false).apply();
        }
        @JavascriptInterface public String getInbox() { try (InboxStore db = new InboxStore(MainActivity.this)) { return db.pendingJson(); } }
        @JavascriptInterface public void markInbox(String id) { try (InboxStore db = new InboxStore(MainActivity.this)) { db.mark(id); } }
        @JavascriptInterface public void printHtml(String html) {
            if (html == null || html.length() > 8_000_000) { send("onError", "Список слишком большой. Разделите его по датам или городам."); return; }
            runOnUiThread(() -> {
                printView = new WebView(MainActivity.this);
                printView.getSettings().setJavaScriptEnabled(false);
                printView.getSettings().setBlockNetworkLoads(true);
                printView.getSettings().setAllowFileAccess(false);
                printView.setWebViewClient(new WebViewClient() {
                    @Override public void onPageFinished(WebView view, String url) {
                        PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                        if (pm == null) { send("onError", "Служба печати недоступна на этом телефоне."); return; }
                        pm.print("Аманат — список передач", view.createPrintDocumentAdapter("Аманат — список передач"), new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape()).setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME).build());
                    }
                });
                printView.loadDataWithBaseURL(ORIGIN, html, "text/html", "UTF-8", null);
            });
        }
        @JavascriptInterface public void saveFile(String filename, String mime, String content) {
            if (content == null || content.length() > 30 * 1024 * 1024) { send("onError", "Файл больше 30 МБ. Разделите выгрузку."); return; }
            runOnUiThread(() -> {
                if (pendingSave != null) { send("onError", "Сначала завершите предыдущее сохранение."); return; }
                pendingSave = content.getBytes(StandardCharsets.UTF_8); pendingFilename = filename;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, filename);
                try { startActivityForResult(i, SAVE_FILE); }
                catch (ActivityNotFoundException error) { pendingSave = null; send("onError", "На телефоне не найдено приложение выбора файлов."); }
            });
        }
        @JavascriptInterface public void chooseBackup() {
            runOnUiThread(() -> {
                try { startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"), OPEN_BACKUP); }
                catch (ActivityNotFoundException error) { send("onError", "Не найдено приложение выбора файлов."); }
            });
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SAVE_FILE) {
            final byte[] bytes = pendingSave; final String filename = pendingFilename;
            pendingSave = null; pendingFilename = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            final Uri destination = data.getData();
            new Thread(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(destination, "wt")) {
                    if (out == null) throw new Exception(); out.write(bytes); send("onFileSaved", filename);
                } catch (Exception error) { send("onError", "Не удалось сохранить файл. Выберите другое место."); }
            }).start();
        } else if (requestCode == OPEN_BACKUP && resultCode == RESULT_OK && data != null && data.getData() != null) {
            final Uri source = data.getData();
            new Thread(() -> {
                try (InputStream in = getContentResolver().openInputStream(source); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    if (in == null) throw new Exception();
                    byte[] buffer = new byte[8192]; int n;
                    while ((n = in.read(buffer)) != -1) { if (out.size() + n > 30 * 1024 * 1024) throw new Exception(); out.write(buffer, 0, n); }
                    send("onBackup", out.toString(StandardCharsets.UTF_8.name()));
                } catch (Exception error) { send("onError", "Не удалось прочитать копию. Проверьте файл и его размер (до 30 МБ)."); }
            }).start();
        }
    }
    @Override protected void onDestroy() {
        if (webView != null) { webView.removeJavascriptInterface("Android"); webView.destroy(); }
        if (printView != null) printView.destroy();
        super.onDestroy();
    }
}
