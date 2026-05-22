package com.chompchem.app;

import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebSettings;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register the FirebaseAuthentication native plugin BEFORE super.onCreate
        registerPlugin(io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            // Disable caching to always load fresh website content
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            // Add "Capacitor" to the User Agent so the website detects native environment
            String userAgent = settings.getUserAgentString();
            settings.setUserAgentString(userAgent + " Capacitor");

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
