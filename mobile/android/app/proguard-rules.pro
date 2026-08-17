# Flutter'ın kendi kuralları flutter_gradle_plugin tarafından eklenir; burada
# yalnızca uygulamaya özel istisnalar yer alır.

# Flutter motoru yansıma (reflection) ile erişilen sınıfları içerir.
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Google Play Core — Flutter'ın ertelenmiş bileşen (deferred component)
# desteği bu sınıflara referans verir ama biz kullanmıyoruz. Eksik sınıf
# uyarılarını yok say, aksi hâlde R8 derlemeyi durdurur.
-dontwarn com.google.android.play.core.**

# Satır numaraları çökme raporlarında yığın izini okunur tutar.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
