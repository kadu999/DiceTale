package com.dicetale.gm

import android.os.Bundle

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // 注意：模板默认调用 enableEdgeToEdge()，会让 WebView 画到系统栏下面——
    // 横屏时右侧被虚拟按键栏遮挡。这里不再启用，内容区自动避开系统栏
    // （状态栏/导航栏）；左侧摄像头挖孔由主题 windowLayoutInDisplayCutoutMode=never 处理。
    super.onCreate(savedInstanceState)
  }
}
