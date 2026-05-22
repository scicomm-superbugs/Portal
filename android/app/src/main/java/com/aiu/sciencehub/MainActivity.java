package com.aiu.sciencehub;

import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebSettings;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            // Enable third-party cookies for Firebase iframe storage compatibility
            android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

            WebSettings settings = webView.getSettings();
            // Disable caching to always load fresh website content
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            // Use a clean Chrome User Agent to bypass Google accounts embedded WebView blocks
            String userAgent = "Mozilla/5.0 (Linux; Android 13; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";
            settings.setUserAgentString(userAgent);

            // Pull-to-refresh support
            SwipeRefreshLayout swipeRefreshLayout = new SwipeRefreshLayout(this);
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) {
                parent.removeView(webView);
                swipeRefreshLayout.addView(webView);
                parent.addView(swipeRefreshLayout);

                swipeRefreshLayout.setOnRefreshListener(() -> {
                    webView.clearCache(true);
                    webView.reload();
                    swipeRefreshLayout.setRefreshing(false);
                });
            }
        }
    }
}
