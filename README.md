# CIBA Android

Aplicación móvil Android de **CIBA: plataforma digital cubana de educación parental en los primeros mil días de las infancias**.

**Lema:** «Crecemos acompañándonos».

## Arquitectura

- Expo SDK 58, React Native 0.88 y TypeScript.
- Aplicación nativa independiente del sitio editorial `ciba2.0`.
- Identidad visual CIBA y navegación nativa por CRIANZA, INFORMÁTICA, BIENESTAR y ACOMPAÑAMIENTO.
- Buscador inicial de áreas.
- Lector híbrido con WebView que abre las secciones y conserva el HTML, CSS, JavaScript y multimedia publicados en CIBA.
- Perfiles EAS separados para APK de distribución directa y AAB de Google Play.

## Estado de desarrollo

**Versión 0.1.0 · Base Android inicial creada.**

Ya están incorporadas la interfaz nativa, la navegación principal, la búsqueda de artículos conectada al catálogo y la apertura de contenidos dentro de la aplicación.

Pendiente para las siguientes etapas:
- conectar el catálogo editorial generado por el sitio;
- biblioteca local y lectura sin conexión;
- sincronización de actualizaciones editoriales;
- ejecutar la primera vinculación del proyecto con Expo EAS y validar la generación del APK de prueba.

**Todavía no se ha generado un APK.** La configuración de compilación está preparada, pero requiere vincular el proyecto con Expo EAS.

## Repositorios

- Aplicación Android: https://github.com/ciba1000dias-lab/ciba-android
- Plataforma editorial (no modificar desde este proyecto): https://github.com/ciba1000dias-lab/ciba2.0
- Sitio publicado: https://ciba1000dias-lab.github.io/ciba2.0/

## Requisitos de desarrollo

Expo SDK 58 requiere Node.js 22.13 o superior.

```bash
npm install
npx expo install --fix
npx expo start
```

Para compilar el APK de prueba, después de vincular EAS:

```bash
npx eas-cli build --platform android --profile preview
```

No se guardan contraseñas ni tokens en el repositorio.


## Compilación automatizada

La cuenta Expo propietaria configurada para esta aplicación es `rjalonso-ciba`.
El repositorio utiliza el secreto de GitHub `EXPO_TOKEN`; el token no debe incluirse en archivos ni mensajes.

El flujo **CIBA Android APK** se ejecuta desde GitHub Actions (pestaña Actions) o al modificar los archivos principales de la aplicación. Primero vincula el proyecto mediante `eas project:init` y después solicita a EAS Build un APK Android con el perfil `preview`.

El APK estará disponible en el enlace de compilación que EAS muestre cuando el trabajo termine correctamente. La creación del flujo no significa que el APK ya esté generado.
