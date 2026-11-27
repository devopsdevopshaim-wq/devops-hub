package il.framemagnets.screen;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * אופטימוס מסך: the live event's hall screen, full screen, for TVs and TV sticks.
 * It opens the site's pairing page (tv.html?app=1): a 6-digit code that the owner types in Optimus; from then on Optimus
 * runs what this screen shows. The page remembers the last event and comes back to it by itself (after a power cut too).
 * The screen never sleeps. The remote's arrows and OK reach the page as keys; Menu goes back to the pairing code;
 * Back twice leaves. Without the internet it shows its own "no connection" page and tries again every 5 seconds.
 */
public class MainActivity extends Activity {
    static final String SITE = "https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/";
    static final String START = SITE + "tv.html?app=1";
    WebView web;
    long backAt = 0;
    boolean failed = false;
    final Handler h = new Handler(Looper.getMainLooper());

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " OptimusScreen/" + Version.name(this));
        web.addJavascriptInterface(new Bridge(), "OptimusScreen");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String u = r.getUrl().toString();
                return !(u.startsWith(SITE) || u.startsWith("file:///android_asset/"));   /* the screen never leaves the site */
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) offline();
            }
            @Override public void onReceivedSslError(WebView v, SslErrorHandler hd, SslError e) { hd.cancel(); offline(); }
        });
        setContentView(web);
        immersive();
        web.loadUrl(START);
        web.requestFocus();
    }

    void offline() {
        if (failed) return;
        failed = true;
        web.loadUrl("file:///android_asset/offline.html");
        h.postDelayed(new Runnable() { @Override public void run() { failed = false; web.loadUrl(START); } }, 5000);
    }

    void immersive() {
        if (Build.VERSION.SDK_INT >= 19) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) immersive(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); immersive(); }
    @Override protected void onPause() { web.onPause(); super.onPause(); }

    /** the remote: Menu = back to the pairing code (another event); Back twice = leave; the rest goes to the page */
    @Override public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (e.getAction() == KeyEvent.ACTION_DOWN && (k == KeyEvent.KEYCODE_MENU || k == KeyEvent.KEYCODE_SETTINGS)) {
            web.loadUrl(START + "&pair=1");
            return true;
        }
        if (k == KeyEvent.KEYCODE_BACK) {
            if (e.getAction() == KeyEvent.ACTION_UP) {
                long now = System.currentTimeMillis();
                if (now - backAt < 2500) finish();
                else { backAt = now; Toast.makeText(this, "לחיצה נוספת על חזרה תסגור את המסך", Toast.LENGTH_SHORT).show(); }
            }
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    /** what the page may ask the app (window.OptimusScreen) */
    class Bridge {
        @JavascriptInterface public String version() { return Version.name(MainActivity.this); }
        @JavascriptInterface public void setAutostart(boolean on) {
            SharedPreferences p = getSharedPreferences("screen", MODE_PRIVATE); p.edit().putBoolean("autostart", on).apply();
        }
        @JavascriptInterface public boolean autostart() { return getSharedPreferences("screen", MODE_PRIVATE).getBoolean("autostart", true); }
    }
}
