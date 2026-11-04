import java.util.Properties

plugins {
    id("com.android.application")
    id("com.google.gms.google-services") // Firebase: avisos push
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Llave de firma de la versión para tiendas: android/key.properties (NUNCA se sube a git, ver .gitignore).
// Contiene storeFile, storePassword, keyAlias y keyPassword. Sin ese archivo, la versión final no se firma
// con la llave de pruebas: la compilación de release falla con un mensaje que explica qué falta.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("key.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val hasReleaseKey = keystoreProperties.getProperty("storeFile") != null

android {
    namespace = "mx.zugar.homiz"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "mx.zugar.homiz"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKey) {
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
            if (hasReleaseKey) {
                signingConfig = signingConfigs.getByName("release")
            }
            // Código reducido y ofuscado (R8) y sin recursos sin usar
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

// La versión de release no se firma con la llave de pruebas: sin key.properties se detiene con instrucciones
gradle.taskGraph.whenReady {
    if (!hasReleaseKey && allTasks.any { it.name.contains("Release") && (it.name.startsWith("assemble") || it.name.startsWith("bundle")) }) {
        throw GradleException(
            "Falta android/key.properties con la llave de firma de la app (ver docs/produccion.md). " +
                "La versión para la tienda no se firma con la llave de pruebas.",
        )
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
