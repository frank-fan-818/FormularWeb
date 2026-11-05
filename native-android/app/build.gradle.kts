import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}
val publicConfig = Properties().apply {
    rootProject.file("backend.public.properties").takeIf { it.isFile }?.inputStream()?.use { load(it) }
}
fun publicValue(key: String): String = "\"" + publicConfig.getProperty(key, "").replace("\\", "\\\\").replace("\"", "\\\"") + "\""
android {
    namespace = "com.formularone.nativeapp"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.formularone.nativeapp"
        minSdk = 26
        targetSdk = 36
        versionCode = 5
        versionName = "0.2.3"
        buildConfigField("String", "SUPABASE_URL", publicValue("SUPABASE_URL"))
        buildConfigField("String", "SUPABASE_ANON_KEY", publicValue("SUPABASE_ANON_KEY"))
        buildConfigField("String", "TURNSTILE_SITE_KEY", publicValue("TURNSTILE_SITE_KEY"))
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    testOptions { unitTests.isReturnDefaultValues = true }
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
dependencies {
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.compose.preview)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.coroutines.android)
    implementation(libs.datastore.preferences)
    debugImplementation(libs.compose.tooling)
    testImplementation(libs.junit)
    testImplementation(libs.json.test)
    testImplementation(libs.coroutines.test)
}
