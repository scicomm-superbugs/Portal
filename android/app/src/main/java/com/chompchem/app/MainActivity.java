package com.chompchem.app;

import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            SwipeRefreshLayout swipeRefreshLayout = new SwipeRefreshLayout(this);
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) {
                parent.removeView(webView);
                swipeRefreshLayout.addView(webView);
                parent.addView(swipeRefreshLayout);

                swipeRefreshLayout.setOnRefreshListener(() -> {
                    webView.reload();
                    swipeRefreshLayout.setRefreshing(false);
                });
            }
        }
    }
}
