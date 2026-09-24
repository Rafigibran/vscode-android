# Code - OSS Android

This directory contains the Android shell for the Code - OSS web workbench in this repository.

## Build an APK

The repository workflow builds only an Android APK:

    gradle -p android :app:assembleDebug

The complete web workbench is prepared by the GitHub Actions workflow before Gradle runs. It is copied into:

    android/app/src/main/assets/www/

The APK is intentionally produced as a debug APK so it is directly installable for testing without a release keystore.

## Architecture

- VS Code / Code - OSS web workbench: TypeScript, bundled with the repository's existing `vscode-web-min` task.
- Android shell: Java + Android WebView.
- Local web content: AndroidX WebKit `WebViewAssetLoader`.
- File input: Android Storage Access Framework through WebView's file chooser.

This first Android target focuses on packaging the existing web workbench as an Android application. Native terminal, local workspace filesystem, Git, and full desktop extension-host support require additional Android-native runtime work.
