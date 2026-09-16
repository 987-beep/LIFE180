plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.lostdeviceguard.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.lostdeviceguard.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 4
        versionName = "1.3.0"
        // ⚠️ Change to YOUR Vercel URL (or change it inside the app's settings screen)
        buildConfigField("String", "SERVER_URL", "\"https://your-app.vercel.app\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity:1.9.2")
    // Google Sign-In (email only — no Firebase needed for v1)
    implementation("com.google.android.gms:play-services-auth:21.2.0")
}
