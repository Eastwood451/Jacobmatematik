# Jacobmatematik til Google Play

Android-appen er en Trusted Web Activity. Den åbner https://jacobmatematik.dk/ i Chrome uden en indlejret WebView. Pakkenavnet er `dk.jacobmatematik.app`, appnavnet er Jacobmatematik, og `targetSdk` er 36.

Appen indeholder ikke reklamer, Firebase, Google Analytics eller andre SDK'er der indsamler data. Netværket sker i Chrome. Appen anmoder ikke om placering, mikrofon, kamera, kontakter eller notifikationer, og reklame-id er fjernet fra manifestet.

## Nøgler

Upload-nøglen ligger ikke i git. Keystore og adgangskoder udleveres ved siden af den signerede AAB og må ikke committes eller sættes ind i en pull request.

Upload-nøglens SHA-256, som ikke er hemmelig, er:

`8B:A0:7C:96:15:8E:CD:DF:C7:BD:A6:F0:A1:EF:5D:33:4D:ED:09:D5:17:0B:57:29:0E:D4:0C:9A:73:81:D4:E6`

Den står også i `/.well-known/assetlinks.json`. Play App Signing bruger en anden nøgle. Dens SHA-256 kendes først efter første upload og skal tilføjes i samme liste, før en installation fra Play kan skjule browserbjælken. Kopiér alle fingeraftryk, som Play Console viser under app-signering, også eventuelle ekstra nøgler.

Indtil filen er udgivet på https://jacobmatematik.dk/.well-known/assetlinks.json, åbner appen siden i en Custom Tab med bjælke. Selve indholdet virker stadig.

## Byg

Kræver JDK 17 eller nyere og Android SDK 36.

```sh
echo "sdk.dir=$ANDROID_HOME" > local.properties
export JM_UPLOAD_STORE_FILE=/sti/til/jacobmatematik-upload.jks
export JM_UPLOAD_STORE_PASSWORD=...
export JM_UPLOAD_KEY_ALIAS=upload
export JM_UPLOAD_KEY_PASSWORD=...
./gradlew bundleRelease
```

PKCS12 bruger samme adgangskode til lager og nøgle, så de to password-variabler skal have samme værdi. AAB-filen ligger i `app/build/outputs/bundle/release/`. Uden nøglevariablerne bliver udgivelsesbygget usigneret, og det kan ikke uploades til Play.

Play-konsol, data safety, målgruppe og det der mangler før en lukket test, står i [PLAY.md](PLAY.md).
