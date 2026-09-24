package com.wizardnative.wizardcode;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {

    private static final int OPEN_FILE_REQUEST = 5101;
    private static final int SAVE_FILE_REQUEST = 5102;

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private String pendingSaveName = "main.js";
    private String pendingSaveContent = "";

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        configureWindow();
        configureWebView();
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html");
    }

    private void configureWindow() {
        getWindow().setStatusBarColor(android.graphics.Color.rgb(17, 19, 24));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(13, 15, 19));
        getWindow().getDecorView().setSystemUiVisibility(0);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " WizardCode/1.0");

        webView.setBackgroundColor(android.graphics.Color.rgb(13, 15, 19));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view,
                    WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    return false;
                }

                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (resultCode != RESULT_OK || data == null) {
            return;
        }

        if (requestCode == OPEN_FILE_REQUEST) {
            Uri uri = data.getData();
            if (uri == null) return;

            String name = getDisplayName(uri);
            String content;
            try {
                content = readText(uri);
            } catch (IOException e) {
                Toast.makeText(this, "Cannot read file", Toast.LENGTH_SHORT).show();
                return;
            }

            String jsName = JSONObject.quote(name);
            String jsContent = JSONObject.quote(content);
            webView.evaluateJavascript(
                    "window.WizardCode.receiveFile(" + jsName + "," + jsContent + ");",
                    null
            );
        } else if (requestCode == SAVE_FILE_REQUEST) {
            Uri uri = data.getData();
            if (uri == null) return;

            try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                if (output == null) throw new IOException("No output stream");
                output.write(pendingSaveContent.getBytes(StandardCharsets.UTF_8));
                output.flush();

                webView.evaluateJavascript(
                        "window.WizardCode.saveResult('Saved " +
                                JSONObject.quote(pendingSaveName).replace("'", "\\'").substring(1,
                                        JSONObject.quote(pendingSaveName).length() - 2) +
                                "');",
                        null
                );
                Toast.makeText(this, "Saved " + pendingSaveName, Toast.LENGTH_SHORT).show();
            } catch (IOException e) {
                Toast.makeText(this, "Cannot save file", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private String getDisplayName(Uri uri) {
        Cursor cursor = getContentResolver().query(
                uri,
                new String[]{"_display_name"},
                null,
                null,
                null
        );
        if (cursor != null) {
            try {
                if (cursor.moveToFirst()) {
                    int index = cursor.getColumnIndex("_display_name");
                    if (index >= 0) return cursor.getString(index);
                }
            } finally {
                cursor.close();
            }
        }
        String path = uri.getLastPathSegment();
        return path == null ? "untitled.txt" : path;
    }

    private String readText(Uri uri) throws IOException {
        InputStream input = getContentResolver().openInputStream(uri);
        if (input == null) throw new IOException("No input stream");

        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(input, StandardCharsets.UTF_8))) {
            char[] buffer = new char[8192];
            int count;
            while ((count = reader.read(buffer)) != -1) {
                result.append(buffer, 0, count);
                if (result.length() > 8_000_000) {
                    throw new IOException("File is too large");
                }
            }
        }
        return result.toString();
    }

    public final class AndroidBridge {

        @JavascriptInterface
        public void openFile() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "text/*",
                        "application/json",
                        "application/javascript",
                        "application/xml",
                        "application/x-httpd-php"
                });
                try {
                    startActivityForResult(intent, OPEN_FILE_REQUEST);
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "No file picker found", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void saveFile(String name, String content) {
            pendingSaveName = (name == null || name.trim().isEmpty()) ? "main.js" : name;
            pendingSaveContent = content == null ? "" : content;

            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("text/plain");
                intent.putExtra(Intent.EXTRA_TITLE, pendingSaveName);
                try {
                    startActivityForResult(intent, SAVE_FILE_REQUEST);
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "No file saver found", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void vibrate() {
            runOnUiThread(() -> {
                android.os.Vibrator vibrator =
                        (android.os.Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (vibrator != null && android.os.Build.VERSION.SDK_INT >= 26) {
                    vibrator.vibrate(
                            android.os.VibrationEffect.createOneShot(
                                    18,
                                    android.os.VibrationEffect.DEFAULT_AMPLITUDE
                            )
                    );
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
