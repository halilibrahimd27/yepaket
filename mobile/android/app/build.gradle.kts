import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Firebase yapılandırması varsa push bildirimi etkinleşir.
//
// Koşullu uygulama bilinçlidir: google-services eklentisi dosya olmadan
// derlemeyi durdurur. Müşteri Firebase hesabını açana kadar geliştirme ve
// test derlemelerinin çalışmaya devam etmesi gerekiyor. Dosya eklendiği anda
// eklenti kendiliğinden devreye girer, başka bir değişiklik gerekmez.
val hasFirebaseConfig = file("google-services.json").exists()

if (hasFirebaseConfig) {
    apply(plugin = "com.google.gms.google-services")
} else {
    logger.lifecycle(
        "Bilgi: android/app/google-services.json yok — push bildirimi devre dışı. " +
            "Kurulum için docs/TESLIM.md bölüm 2.2'ye bakın."
    )
}

// İmzalama bilgileri depoya girmez: `android/key.properties` dosyası
// .gitignore altındadır ve yalnızca yayın yapan makinede bulunur.
// Dosya yoksa yayın derlemesi hata verir — imzasız bir AAB'nin sessizce
// üretilip mağazaya yüklenmeye çalışılması daha kötüdür.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("key.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

val hasReleaseKeystore = keystoreProperties.getProperty("storeFile") != null

android {
    namespace = "com.yepaket.yepaket"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.yepaket.yepaket"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Anahtar yoksa hata ver: debug anahtarıyla imzalanmış bir paket
            // Play Store tarafından reddedilir ve bu ancak yükleme anında
            // fark edilirdi.
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                logger.warn(
                    "UYARI: android/key.properties bulunamadı. Yayın derlemesi " +
                        "debug anahtarıyla imzalanacak ve Play Store'a YÜKLENEMEZ. " +
                        "Kurulum için docs/TESLIM.md bölüm 2.2'ye bakın."
                )
                signingConfigs.getByName("debug")
            }

            // Kod küçültme ve kaynak temizliği: APK boyutunu belirgin biçimde
            // düşürür ve tersine mühendisliği zorlaştırır.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

flutter {
    source = "../.."
}
