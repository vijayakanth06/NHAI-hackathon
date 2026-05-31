# ============================================================================
# NHAI Biometrics — ProGuard / R8 Rules
# ============================================================================
# These rules prevent R8 from stripping or renaming classes that are accessed
# via reflection at runtime (TFLite, SQLCipher, React Native bridge, etc.).
# Without these rules, the release APK will crash on initialization.
# ============================================================================

# ─── 1. Keep ALL classes in our own package ───────────────────────────────────
# React Native discovers @ReactMethod annotations via reflection.
# If R8 renames or strips BiometricsModule, the JS bridge can't find it.
-keep class com.nhai.biometrics.** { *; }
-keepclassmembers class com.nhai.biometrics.** { *; }

# ─── 2. TensorFlow Lite (LiteRT) ─────────────────────────────────────────────
# TFLite uses reflection for delegates (NNAPI, GPU, XNNPACK).
# Stripping these causes "UnsatisfiedLinkError" or "ClassNotFoundException".
-keep class org.tensorflow.** { *; }
-keep class org.tensorflow.lite.** { *; }
-keep class com.google.ai.edge.litert.** { *; }
-keepclassmembers class org.tensorflow.lite.** { *; }
-keepclassmembers class com.google.ai.edge.litert.** { *; }
-dontwarn org.tensorflow.**
-dontwarn com.google.ai.edge.litert.**

# ─── 3. SQLCipher ─────────────────────────────────────────────────────────────
# SQLCipher loads native .so libraries via System.loadLibrary().
# R8 can strip the Java wrapper classes if they appear unused.
-keep class net.sqlcipher.** { *; }
-keep class net.sqlcipher.database.** { *; }
-keepclassmembers class net.sqlcipher.database.** { *; }
-dontwarn net.sqlcipher.**

# ─── 4. React Native Core ────────────────────────────────────────────────────
# React Native discovers native modules, view managers, and TurboModules
# via reflection. Keep the bridge infrastructure intact.
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.proguard.annotations.KeepGettersAndSetters *;
}

-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep all ReactPackage implementations
-keep class * implements com.facebook.react.ReactPackage { *; }

# Keep all NativeModule implementations (our BiometricsModule)
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# Keep TurboModule infrastructure (New Architecture)
-keep class * extends com.facebook.react.bridge.NativeModule { *; }

# ─── 5. Hermes Engine ─────────────────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.hermes.**

# ─── 6. AndroidX / Kotlin ────────────────────────────────────────────────────
-keep class androidx.** { *; }
-dontwarn androidx.**
-keep class kotlin.** { *; }
-dontwarn kotlin.**
-keepclassmembers class kotlin.Metadata { *; }

# ─── 7. Coroutines (used in BiometricsModule) ────────────────────────────────
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}
-dontwarn kotlinx.coroutines.**

# ─── 8. Java Security / Crypto (used by EncryptionManager) ───────────────────
-keep class javax.crypto.** { *; }
-keep class java.security.** { *; }
-dontwarn javax.crypto.**

# ─── 9. Vision Camera & Reanimated (native SO libraries) ─────────────────────
-keep class com.mrousavy.** { *; }
-dontwarn com.mrousavy.**
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# ─── 10. Worklets ─────────────────────────────────────────────────────────────
-keep class com.reactnativeworklets.** { *; }
-dontwarn com.reactnativeworklets.**

# ─── 11. General safety rules ─────────────────────────────────────────────────
# Keep native methods — JNI will crash if these are renamed
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums (used in various places)
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable implementations
-keepclassmembers class * implements android.os.Parcelable {
    static ** CREATOR;
}

# Keep Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Don't warn about missing optional dependencies
-dontwarn java.lang.invoke.**
-dontwarn **$$Lambda$*
