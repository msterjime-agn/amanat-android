# Amanat Android

Offline Android app for tracking money and parcel handovers between Turkey and Turkmenistan.

The interface and full instructions are in Russian: [README_RU.md](README_RU.md).

Upload this directory's contents to the root of a new GitHub repository. Push to `main` or `master` to run **Build Android APK**, or start it from the Actions tab. Download **Amanat-Android-APK** from the completed run's artifacts. No APK has been built in this source archive.

Without signing secrets the workflow produces a test debug APK. Use a permanent release signing key for ongoing updates; configuration is documented in the Russian README.

Accounting checks: `node --test tests/*.test.mjs`.
