# CIBA Android

Aplicación móvil Android de CIBA: plataforma digital cubana de educación parental en los primeros mil días de las infancias.

Lema: «Crecemos acompañándonos».

## Versión 0.3.0
- Identidad visual actualizada con el logotipo oficial CIBA.
- Navegación nativa por CRIANZA, INFORMÁTICA, BIENESTAR y ACOMPAÑAMIENTO.
- Catálogo editorial sincronizable desde CIBA 2.0 y copia local del índice.
- Buscador general y «Dudas de Nayara», que localiza publicaciones relacionadas sin generar respuestas clínicas automáticas.
- Favoritos e historial guardados en el dispositivo.
- Descarga voluntaria de artículos para lectura offline.
- Biblioteca local para abrir y eliminar artículos.
- Sin cuentas, permisos innecesarios ni recopilación de datos personales.

Nota offline: se conserva el documento HTML y su texto. Imágenes, vídeos, audios y otros recursos externos pueden seguir necesitando Internet.

## Arquitectura
- Expo SDK 58, React Native 0.88 y TypeScript.
- Aplicación independiente del sitio editorial ciba2.0.
- Almacenamiento local con AsyncStorage.
- Lector de artículos mediante WebView.
- Perfil EAS preview para APK directo y production para AAB.

## Repositorios
- Android: https://github.com/ciba1000dias-lab/ciba-android
- Plataforma editorial (no modificar desde este proyecto): https://github.com/ciba1000dias-lab/ciba2.0
- Sitio: https://ciba1000dias-lab.github.io/ciba2.0/

El flujo CIBA Android APK verifica el vínculo EAS, ejecuta el prebuild Android y solicita un APK de distribución directa. El secreto EXPO_TOKEN permanece en GitHub Secrets.
