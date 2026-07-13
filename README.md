# FullTraining 2026

Aplicación de escritorio para la operación de un gimnasio: usuarios, disciplinas,
turnos, cobros y sincronización de accesos con un molinete.

La aplicación activa está construida con Electron y páginas HTML/JavaScript
clásicas. El renderer accede a MySQL y a las funciones nativas exclusivamente a
través de la API IPC publicada por `preload.js`.

## Empezar

1. Instalar Node.js y MySQL 8.
2. Ejecutar `npm install`.
3. Iniciar una vez la aplicación con `npm start`; esto crea
   `Documentos/fulltraining-2026/config.json`.
4. Ajustar en ese archivo la conexión `db` y, si corresponde, los datos de
   `molinete`.
5. Verificar que exista la base `gimnasio2026` con las tablas requeridas.
6. Volver a ejecutar `npm start`.

> El repositorio no contiene todavía migraciones ni un volcado inicial de la
> base. Para una instalación nueva es necesario obtener el esquema por separado.

Para arquitectura, tecnologías, convenciones, flujos y referencia completa de
helpers, consultar [docs/GUIA_DEL_PROYECTO.md](docs/GUIA_DEL_PROYECTO.md).

## Comandos

```powershell
npm start
npm run build
```

- `npm start`: abre Electron en modo desarrollo.
- `npm run build`: genera el instalador NSIS de Windows en `dist/`.

## Datos fuera del repositorio

La aplicación usa `Documentos/fulltraining-2026/` para configuración, logs,
respaldos y archivos temporales. El ejecutable puente del molinete,
`InterfazMolineteSDK.exe`, también se espera en esa carpeta.

