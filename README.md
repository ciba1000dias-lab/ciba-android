# CIBA Android

Aplicación móvil Android de **CIBA: plataforma digital cubana de educación parental en los primeros mil días de las infancias**.

**Lema:** «Crecemos acompañándonos».

## Arquitectura

- Expo SDK 58 y React Native 0.88 con TypeScript.
- Aplicación nativa independiente del sitio editorial `ciba2.0`.
- Identidad visual CIBA y navegación inicial por las cuatro áreas.
- Integración progresiva del catálogo editorial, lector híbrido y biblioteca sin conexión.
- Construcción de APK de distribución directa mediante EAS Build.
- Perfil AAB previsto para Google Play.

## Estado

**Versión 0.1.0 · Base nativa inicial.** La interfaz y navegación inicial están creadas. El lector integrado, sincronización editorial, base local y compilación APK quedan para las siguientes etapas.

## Repositorios

- Aplicación Android: https://github.com/ciba1000dias-lab/ciba-android
- Plataforma editorial (no modificar desde este proyecto): https://github.com/ciba1000dias-lab/ciba2.0
- Sitio publicado: https://ciba1000dias-lab.github.io/ciba2.0/

## Desarrollo

Requiere Node.js 22.13 o superior para Expo SDK 58.

```bash
npm install
npx expo start
```

Para compilar el APK de prueba:

```bash
npx eas-cli build --platform android --profile preview
```

La primera compilación requiere configurar el proyecto EAS y su identificador. No se guardan contraseñas ni tokens en el repositorio.
