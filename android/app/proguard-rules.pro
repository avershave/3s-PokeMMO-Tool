# App-specific R8 keep rules. Libraries bring their own; add rules here only for code
# reached by reflection that R8 cannot see.

# ML Kit text recognition: its internal classes are created indirectly (component registrars,
# static holders), and R8 full mode merged/stripped them, which crashed the capture service at
# start ("NullPointerException ... mlkit.vision.text.internal"). Keep ML Kit and its GMS internals.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_text_common.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_common.** { *; }
-keep class com.google.android.gms.internal.mlkit_common.** { *; }
-keep class com.google.android.odml.** { *; }
