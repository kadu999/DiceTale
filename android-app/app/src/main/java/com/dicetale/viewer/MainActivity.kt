package com.dicetale.viewer

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.os.Bundle
import android.view.View
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.TextView

class MainActivity : Activity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        val btnSettings = findViewById<TextView>(R.id.btnSettings)

        webView.webViewClient = WebViewClient()
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
        }

        btnSettings.setOnClickListener { showUrlDialog() }

        val url = getSavedUrl()
        if (url == null) {
            showUrlDialog()
        } else {
            webView.loadUrl(url)
        }
    }

    private fun getSavedUrl(): String? {
        val prefs = getSharedPreferences("dicetale", Context.MODE_PRIVATE)
        return prefs.getString("server_url", null)
    }

    private fun showUrlDialog() {
        val input = EditText(this)
        input.setText(getSavedUrl() ?: DEFAULT_URL)

        AlertDialog.Builder(this)
            .setTitle("服务器地址")
            .setMessage("输入后台地址（含 http://），例如 192.168.1.33:8080")
            .setView(input)
            .setPositiveButton("连接") { _, _ ->
                var url = input.text.toString().trim()
                if (url.isEmpty()) {
                    url = DEFAULT_URL
                }
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    url = "http://$url"
                }
                getSharedPreferences("dicetale", Context.MODE_PRIVATE)
                    .edit()
                    .putString("server_url", url)
                    .apply()
                webView.loadUrl(url)
            }
            .setNegativeButton("取消", null)
            .show()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onResume() {
        super.onResume()
        // 沉浸式全屏（隐藏状态栏/导航栏）
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
    }

    companion object {
        private const val DEFAULT_URL = "http://192.168.1.33:8080/"
    }
}
