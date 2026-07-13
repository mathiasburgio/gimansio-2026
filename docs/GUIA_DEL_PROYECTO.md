# Guía técnica de FullTraining 2026

Esta guía describe el código observado en el repositorio al 13 de julio de 2026.
Su objetivo es permitir que otra persona pueda ubicar una funcionalidad, seguir
el flujo de datos y hacer su primer cambio sin confundir el código activo con
componentes heredados.

## 1. Resumen ejecutivo

FullTraining 2026 es una aplicación de escritorio para Windows. Electron crea la
ventana principal, abre archivos HTML locales y mantiene en el proceso principal
las conexiones con MySQL y con el software externo del molinete.

El diseño activo no usa una API HTTP para el CRUD. Las páginas del renderer
invocan `window.electronAPI`, publicada por `preload.js`; la llamada viaja por IPC
a `index.js`, que ejecuta SQL mediante `utils/db2.js` o interactúa con el SDK.

```text
HTML + public/js/*.js
        |
        | window.electronAPI
        v
preload.js (contextBridge / ipcRenderer)
        |
        | ipcMain.handle(...)
        v
index.js (proceso principal Electron)
        |                         |
        v                         v
utils/db2.js -> MySQL       InterfazMolineteSDK.exe :9000
                                  |
                                  v
                         escuchadorSDK.js :4000/escucha
```

Las carpetas `controllers/` y `routes/` pertenecen a una implementación anterior
basada en Express/Mongoose. Actualmente no se importan desde `index.js`, varios
controladores requieren una carpeta `models/` inexistente y no deben tomarse
como punto de entrada de una funcionalidad nueva.

## 2. Tecnologías identificadas

### Núcleo activo

| Tecnología | Uso real en el proyecto |
| --- | --- |
| Electron 41 | Ventana de escritorio, ciclo de vida, preload, IPC, DevTools y empaquetado. |
| Node.js / CommonJS | Proceso principal y módulos de infraestructura (`require`, `module.exports`). |
| JavaScript clásico | Renderer sin bundler, módulos ES ni TypeScript; clases globales cargadas con `<script>`. |
| MySQL 8 + `mysql2/promise` | Persistencia. Se mantiene una conexión y se ejecutan consultas parametrizadas. |
| HTML/CSS | Una página por módulo funcional, con navegación por enlaces entre archivos. |
| jQuery 3.7.1 | Selección y mutación del DOM, eventos y AJAX en helpers heredados. |
| Bootstrap 4 + Popper | Formularios, grilla, modal, popover y utilidades visuales. |
| AdminLTE | Tema y componentes administrativos. |
| Font Awesome 6 | Iconografía. |
| SweetAlert2 | Disponible localmente en las páginas, aunque la interacción principal usa `Modal2.js`. |
| Axios | Comunicación HTTP desde el proceso principal hacia el puente del molinete en `localhost:9000`. |
| Express | Servidor mínimo que recibe eventos del SDK en `POST localhost:4000/escucha`. |
| `node-cron` | Sincronización automática del molinete cada hora. |
| Electron Builder / NSIS | Construcción del instalador de Windows. |

### Bibliotecas disponibles o de uso puntual

- SheetJS se carga desde CDN en `resumen.html` para exportar tablas a Excel. Esto
  introduce una dependencia de Internet en esa pantalla.
- ExcelJS, FileSaver, JsBarcode, QRCode y CKEditor están copiados dentro de
  `public/resources/cdn/`; sus helpers existen, pero no todos se cargan en las
  pantallas activas.
- `temporal-polyfill` es usado por `utils/FechasTemporal.js`, hoy vinculado al
  código legado de controladores.
- `node-7z` y las funciones criptográficas de `utils/utils.js` pertenecen al
  conjunto de utilidades Node heredado; no participan del flujo principal actual.

### Dependencias instaladas pero no conectadas al flujo activo

`body-parser`, `connect-mongo`, `cors`, `ejs`, `express-session`, `mongoose` y
`multer` corresponden principalmente a la arquitectura anterior de rutas y
controladores. Antes de usarlas o eliminarlas hay que validar si se planea
reactivar ese backend.

## 3. Estructura del repositorio

| Ruta | Responsabilidad |
| --- | --- |
| `index.js` | Entry point de Electron, ventana, IPC, conexión MySQL, integración y sincronización del molinete, cron. |
| `preload.js` | Contrato seguro entre el renderer y el proceso principal. Publica `window.electronAPI`. |
| `escuchadorSDK.js` | Servidor Express local que recibe eventos del molinete en el puerto 4000. |
| `utils/db2.js` | Conexión y consultas MySQL, registro clave/valor, backup y restore. |
| `utils/logger.js` | Log mensual en archivos dentro de Documentos. |
| `utils/utils.js` | Utilidades para Node; actualmente mayormente heredadas. |
| `utils/FechasTemporal.js` | Conversión y aritmética de fechas con Temporal. |
| `public/html/` | Vistas completas: login, inicio, usuarios, disciplinas, turnos, resumen y molinete. |
| `public/js/` | Lógica de cada vista y SQL enviado por IPC. |
| `public/css/` | Estilos propios. `main.css` es el estilo compartido. |
| `public/resources/Modal2.js` | Abstracción global sobre el modal/popover de Bootstrap. |
| `public/resources/Utils.js` | Utilidades globales para el navegador. |
| `public/resources/*.js` | Otros helpers UI disponibles, no cargados por las pantallas actuales. |
| `controllers/`, `routes/` | Backend legado e incompleto; no forma parte del arranque actual. |
| `configuracion.json` | Configuración de la versión legada; no es el config que lee el arranque actual. |
| `dist/` | Artefactos generados por Electron Builder; ignorados por Git. |

## 4. Arranque y configuración

### Requisitos

- Windows, debido al SDK externo, NSIS y comandos `tasklist`/`taskkill`.
- Node.js compatible con Electron 41.
- MySQL 8 accesible desde el equipo.
- Para backup/restore, binarios `mysqldump` y `mysql` instalados.
- Para el molinete, `InterfazMolineteSDK.exe` dentro de
  `Documentos/fulltraining-2026/`.

### Secuencia de arranque

1. `app.whenReady()` crea las carpetas de datos.
2. Se inicializa el logger.
3. `escuchadorSDK.js` intenta escuchar en el puerto 4000.
4. Si no existe, se crea `Documentos/fulltraining-2026/config.json`.
5. `createWindow()` lee ese archivo y crea `BrowserWindow` con aislamiento de
   contexto y `preload.js`.
6. Se conecta a MySQL.
7. Sólo si la conexión resulta exitosa se carga `public/html/index.html`.
8. El cron queda programado para sincronizar el molinete a cada hora en el minuto 0.

### Configuración vigente

El archivo vigente es:

```text
%USERPROFILE%/Documents/fulltraining-2026/config.json
```

Contiene:

```json
{
  "debug": false,
  "db": {
    "host": "localhost",
    "user": "...",
    "password": "...",
    "database": "gimnasio2026"
  },
  "molinete": {
    "ip": "...",
    "port": "...",
    "password": "..."
  }
}
```

No guardar credenciales reales en el repositorio. El `configuracion.json` de la
raíz contiene claves y valores de la versión anterior y debería tratarse como
material sensible hasta retirarlo o reemplazarlo por un ejemplo sanitizado.

### Comandos

```powershell
npm install
npm start
npm run build
```

En desarrollo se muestra la barra de menú y se abren DevTools. En producción se
ocultan, salvo que `debug` sea `true`. También existe un atajo funcional no
visual: escribir `devtools` en la pantalla de inicio.

## 5. Contrato IPC (`window.electronAPI`)

El preload usa `contextBridge`, con `contextIsolation: true` y
`enableRemoteModule: false`. Ésta es una práctica correcta: el renderer no recibe
acceso general a Node, sólo a operaciones explícitas.

| Método renderer | Canal IPC / efecto |
| --- | --- |
| `getLog()` | Lee el log mensual. El handler admite `yearMonth`, pero el wrapper actual no lo expone. |
| `writeLog(message, ...args)` | Escribe en el log. |
| `setUsuarioLogeado(data)` | Guarda el usuario sólo en memoria del proceso principal. |
| `getUsuarioLogeado()` | Recupera el usuario en memoria. No es una sesión persistente. |
| `executeQuery(query, params)` | Ejecuta SQL en MySQL y devuelve las filas o el resultado del comando. |
| `setRegistro(clave, valor)` | Inserta/actualiza un valor en la tabla `registro`. |
| `getRegistro(clave)` | Lee un valor de la tabla `registro`. |
| `makeBackup()` | Genera un `.sql` y lo muestra en el Explorador. |
| `restoreBackup()` | Intenta restaurar un `.sql`; existe una inconsistencia de parámetros, detallada en riesgos. |
| `openDevTools()` | Abre DevTools. |
| `getConfig()` | Devuelve la configuración vigente completa al renderer. |
| `onEventoSDK(callback)` | Suscribe el renderer a mensajes enviados por el proceso principal. |
| `getConsolaMolinete()` | Devuelve hasta 1000 mensajes recientes de la integración. |
| `statusMolinete()` | Devuelve `{status, message}`. |
| `conectarMolinete()` | Reinicia/conecta el ejecutable puente. |
| `sincronizarMolinete(inteligente, limpiar)` | Ejecuta la sincronización completa. |
| `obtenerUsuariosMolinete()` | Solicita usuarios al dispositivo. |
| `habilitarPasoMolinete(ms)` | Abre/habilita el paso. El wrapper envía un número y el handler espera `{ms}`, por lo que hoy ignora tiempos personalizados y usa 3000 ms. |
| `ejecutarMolinete(comando, params)` | Escape hatch para un comando arbitrario soportado por el puente. |
| `sincronizarIndividualMolinete(id, habilitar)` | Pretende habilitar/deshabilitar un usuario. El preload envía `usuarioId` y el handler espera `enrollNumber`, por lo que hoy falla la validación inicial. |

Para agregar una operación nativa se debe modificar en conjunto `preload.js` y
el `ipcMain.handle(...)` correspondiente en `index.js`. No habilitar `nodeIntegration`
ni exponer `ipcRenderer` completo.

## 6. Módulos funcionales activos

| Pantalla | Clase/archivo | Responsabilidad principal |
| --- | --- | --- |
| `index.html` | `public/js/index.js` | Login contra la tabla `usuario`; guarda la sesión en memoria. |
| `inicio.html` | `public/js/inicio.js` | Inicio, backup/restore y atajo de DevTools. |
| `usuarios.html` | `public/js/usuarios.js` | Alta, modificación, búsqueda y baja lógica de usuarios. |
| `disciplinas.html` | `public/js/disciplinas.js` | CRUD de disciplinas y sus horarios/configuración. |
| `turnos.html` | `public/js/turnos.js` | Turnos, historial, asistentes, cobros, pases y sincronización individual. |
| `resumen.html` | `public/js/resumen.js` | Movimientos, acumulados y exportación a Excel. |
| `molinete.html` | `public/js/molinete.js` | Estado, consola, comandos y sincronización del dispositivo. |

Cada vista repite las etiquetas `<script>` necesarias y crea instancias globales
como `modal` y `utils`. No hay bundler, router SPA ni sistema de componentes.

## 7. Persistencia y modelo implícito

No hay migraciones, ORM activo ni archivo de esquema. El modelo se deduce del SQL:

- `usuario`: identidad, credenciales, roles, enrolamiento y estado del pase.
- `disciplina`: nombre, precio, habilitación, cupos/horarios y baja lógica.
- `turno`: contratación o reserva por usuario/disciplina, vigencia, días, cobro,
  cancelación y baja lógica.
- `cobropago`: movimientos de caja, monto, medio/desglose y referencia al turno.
- `pase`: eventos importados del molinete.
- `registro`: almacenamiento clave/valor de configuración operativa.

Prácticas observadas:

- Consultas parametrizadas para valores (`?`), lo que reduce inyección SQL.
- SQL y reglas de negocio viven principalmente en el renderer.
- Bajas lógicas mediante `eliminado = 1`.
- Banderas MySQL se normalizan con `utils.getBoolean()`.
- Se usan transacciones manuales para algunos flujos de cobro (`START TRANSACTION`,
  `COMMIT`, `ROLLBACK`) desde llamadas IPC separadas.
- Los JSON complejos se almacenan serializados en columnas, por ejemplo detalles
  de turnos, pagos o logs.

Al modificar datos relacionados, conservar la coherencia entre `turno`,
`cobropago`, `usuario.paseHabilitado` y el estado real del molinete.

## 8. Referencia de `public/resources/Modal2.js`

`Modal` crea dinámicamente un modal Bootstrap y ofrece diálogos basados en
promesas. Requiere que jQuery, Popper y Bootstrap estén cargados antes.

### Construcción

```js
const modal = new Modal({ id: "modal", lang: "es", fade: true });
```

- Si ya existe un elemento con el mismo id, lo elimina.
- Crea header, body y footer dentro de `body`.
- Configura backdrop estático y enlaza los cuatro eventos Bootstrap:
  `show`, `shown`, `hide` y `hidden`.

### Métodos

| Método | Resultado |
| --- | --- |
| `show(options)` | Renderiza título, cuerpo, tamaño, botones y callbacks; abre el modal. |
| `hide(promiseUntilClose, cb)` | Cierra el modal; `cb` corre después de ocultarse. Ver advertencia sobre la promesa. |
| `close(...)` | Alias de `hide`. |
| `message(text)` | Muestra un mensaje con Aceptar y resuelve al cerrarse. Admite HTML. |
| `yesno(text, focusOn)` | Confirmación; resuelve `true`, `false` o `null` si se cierra por otro medio. |
| `prompt(options)` | Solicita un valor y resuelve string o `null`. Enter acepta. |
| `promptSelect(options)` | Lista seleccionable, con filtro opcional y selección numérica 1–9. |
| `waiting(text, fn)` | Modal con spinner; si recibe `fn`, la espera y luego cierra. Sin `fn`, queda abierto hasta cierre externo. |
| `waiting2(status, text)` | Superpone o retira una capa de espera sobre un modal ya abierto. |
| `addPopover(options)` | Popover dentro del modal: mensaje, sí/no o input; devuelve la respuesta. |
| `buttons({color,text,name})` | Genera el HTML de un botón Bootstrap. |
| `setAnimation(status)` | Activa o desactiva la clase `fade`. |

Opciones de `show`:

```js
modal.show({
  title: "Título",          // sin título se oculta el header
  body: "<p>Contenido</p>",
  size: "lg",              // sm, lg, xl, 70, 80 o 90
  buttons: [
    { color: "secondary", text: "Cancelar", name: "dismiss" },
    { color: "primary", text: "Guardar", name: "save" }
  ],
  onShow() {},
  onShown() {},
  onHide() {},
  onHidden() {}
});
```

Los strings `close`, `back` o `dismiss` crean un botón Cerrar; `accept` crea un
botón Aceptar. Un botón llamado `dismiss` cierra automáticamente. Los demás deben
recibir su evento luego de `show()`.

Ejemplo recomendado:

```js
const confirmado = await modal.yesno("¿Guardar los cambios?");
if (!confirmado) return;

modal.show({
  title: "Editar", body: formularioHtml,
  buttons: [
    { color: "secondary", text: "Cancelar", name: "dismiss" },
    { color: "primary", text: "Guardar", name: "save" }
  ]
});

modal.element.find("[name='save']").on("click", guardar);
```

Advertencias:

- El contenido se inserta con `.html()`. No interpolar texto externo sin escapar.
- Varios métodos usan el selector fijo `#modal`, no `this.id`; los ids personalizados
  no funcionan de manera consistente.
- Sólo se permite un modal abierto; `show()` lanza un string si ya está visible.
- `hide()` crea una promesa pero sólo la resuelve cuando el primer argumento es
  verdadero. No hacer `await modal.hide()` con el valor por defecto.
- La instancia conserva `promiseUntilClose` después de resolverla; abrir y cerrar
  repetidamente con esa modalidad merece prueba específica.

## 9. Referencia de `public/resources/Utils.js`

`Utils` corre en el renderer y depende, según el método, de jQuery, FileSaver,
QRCode o JsBarcode. `isMobile` se calcula una sola vez al construir la instancia.

### Tiempo, colecciones y conversiones

| Método | Función |
| --- | --- |
| `sleep(ms)` / `wait(ms)` | Espera asíncrona. |
| `sort(array, prop, asc)` | Ordena el array recibido in place por una propiedad. |
| `arrayToObject(array, id)` | Indexa objetos por una propiedad o función de clave. |
| `getNumber(value, default)` | Convierte a Number o devuelve el default. |
| `getBoolean(value)` | Reconoce `true`, `"true"`, `1` y `"1"`. |
| `decimals(value, dec)` | Convierte coma decimal y redondea. |
| `splitAmountByPercentage(monto, porcentaje, returnBase)` | Separa impuesto/porcentaje incluido o devuelve la base. |
| `reverserPercent(monto, porcentaje)` | Devuelve `{base, percent}`. |
| `debounce(fn, wait, immediate)` | Devuelve una función con debounce. |

### Strings, URLs y formato

| Método | Función |
| --- | --- |
| `simplifyString(str, noSpaces)` | Minúsculas, normalización parcial y eliminación de caracteres. |
| `validateString(str, validator)` | Valida `email`/`mail`, `uuid`/`guid` o `ip`. |
| `getRandomString(...)` | Genera una cadena alfanumérica no criptográfica. |
| `getUUID()` | Genera un UUID v4 aproximado con `Math.random`; no usar como secreto. |
| `getURL(prepend, id, title)` | Construye un slug prefijado. |
| `getUrlQuery()` | Convierte `location.search` en un objeto simple, sin URL decoding. |
| `formatNumberWithSeparators(...)` | Aplica separador decimal y de miles. |
| `formatNumber(value, dec)` | Redondea y formatea. |
| `invertirFecha(fecha)` | Convierte segmentos `-` a orden inverso con `/`. |
| `getOptions(options)` | Genera `<option>` para un select. |

### DOM, archivos e integración

| Método | Función / dependencia |
| --- | --- |
| `isJquery(element)` | Detecta una instancia jQuery. |
| `FD(object)` | Crea `FormData`. |
| `copyToClipboard(value, container)` | Clipboard API con fallback DOM. |
| `uploadFile(url,file,params)` | Upload con `$.ajax`. |
| `uploadFileWithProgress(options)` | Upload por XHR con callbacks de progreso/final. |
| `uploadButton(options)` | Conecta input/botón al upload y muestra porcentaje. |
| `saveFile(content,name,type)` | Descarga con FileSaver `saveAs`. |
| `ping(timeout)` | Intenta `GET /ping`; pertenece al backend HTTP legado. |
| `bindShowPasswordEvent(button,input)` | Mostrar contraseña por click móvil o mientras se presiona en escritorio. |
| `getQR(options,container,sleep)` | Genera QR mediante la global `QRCode`. |
| `getBarcode(text,container)` | Genera código de barras con el plugin JsBarcode. |
| `scrollTo(element)` | Scroll animado con jQuery. |
| `checkBarcodeScanner(options)` | Acumula teclas rápidas y dispara callback al recibir Enter. |
| `sendWhatsapp(phone,text)` | Abre WhatsApp en una pestaña externa. |
| `setLocalData` / `getLocalData` | Storage namespaced; dependen de una global `primordial` que no existe en la app activa. |
| `verificarCantidadPasadas(registros)` | Cuenta accesos, ignorando repeticiones separadas por menos de 3 horas. |
| `obtenerNumeroSemana(date)` | Calcula semana ISO aproximada. |

Observaciones antes de reutilizar:

- `getOptions()` y otros generadores devuelven HTML sin escape.
- `uploadButton()` no vuelve a habilitar el botón ni retira el indicador.
- `ping()` retorna `false` en `finally`, por lo que actualmente siempre retorna
  `false`, incluso si recibió `pong`.
- `debounce(..., immediate=true)` comprueba `timeout` después de asignarlo; la
  rama inmediata no se ejecuta como se espera.
- `verificarCantidadPasadas()` presupone que los registros están ordenados por
  `date` ascendente.

## 10. `utils/utils.js`: utilidades del proceso Node

Este archivo no es la misma clase que `public/resources/Utils.js`. Exporta
funciones CommonJS para el proceso principal o un backend Node.

| Función | Propósito |
| --- | --- |
| `encryptString` / `decryptString` | AES usando parámetros de configuración legada. |
| `getPasswordHash` / `comparePasswordHash` | Stubs deshabilitados porque bcrypt no está instalado. |
| `getUUID`, `getRandomString` | Identificadores aleatorios no criptográficos. |
| `getShortToken` | Intenta crear un hash corto; actualmente no retorna el valor. |
| `simplifyString`, `safeString`, `validateString` | Normalización, limpieza y validación. |
| `encryptFile` | Comprime/cifra un archivo con 7-Zip. |
| `downloadFile` | Descarga a disco. Requiere revisar compatibilidad con el stream de `fetch`. |
| `api` | Wrapper JSON GET/POST básico. |
| `getFilesInfo` | Metadatos de los hijos directos de una carpeta. |
| `decimals`, `splitAmountByPercentage`, `reverserPercent` | Cálculos monetarios simples. |
| `arrayToObject`, `getNumber`, `getBoolean` | Colecciones y coerción de tipos. |

Antes de reactivar este módulo:

- Depende de `controllers/configuracion.js`, que usa la ruta legada
  `Documentos/molinete-v3/` y puede fallar si la carpeta no existe.
- `decryptString()` elimina siete caracteres aun cuando `prefix` es falso.
- Las claves criptográficas están ligadas al JSON legado del repositorio.
- `safeString()` ignora su parámetro `remove` y usa un patrón fijo.
- No debe usarse como sustituto de consultas parametrizadas ni como mecanismo de
  hashing de contraseñas.

## 11. Otros helpers disponibles

Estos archivos definen clases globales, pero ninguna pantalla activa los incluye
actualmente con `<script>`. Deben cargarse explícitamente antes de instanciarlos.

| Helper | Función |
| --- | --- |
| `SimpleCRUD.js` | Controlador genérico de formulario/listado: alta/modificación, búsqueda, selección, lectura de campos y render de filas. Espera una estructura declarativa y callbacks. |
| `DropdownSearcher.js` | Autocomplete/dropdown buscable enlazado a input y botón, con búsqueda local o callback. |
| `Menu.js` | Shell de UI más complejo: menús laterales, permisos, tema oscuro, sonidos, animaciones, mayúsculas, encabezados y toasts. Parece provenir de otra aplicación. |
| `Impresor.js` | Construcción de tickets y salida a impresión/servicio POS local; incluye alineación, wrapping, estilos y modal de configuración. |
| `Imagine.js` | Selección, preview, resize en canvas y conversión de imágenes entre File/base64/data URL. |
| `SuperExcel.js` | Lectura/escritura/exportación de libros mediante ExcelJS, incluidos objetos y tablas HTML. |

`Utils.js`, `SimpleCRUD.js` y `Menu.js` contienen referencias a globals o endpoints
de otros proyectos. Antes de incorporarlos, buscar dependencias como `primordial`,
`/ping`, APIs HTTP o elementos DOM esperados.

## 12. Fechas, logging, backups y molinete

### `utils/FechasTemporal.js`

Fija la zona `America/Argentina/Buenos_Aires` y ofrece parseo, formato argentino o
ISO, suma, diferencia en días, días del mes, semana y conversión a `Date`. Exporta
un objeto con `FechasTemporal` (instancia) y `Temporal`.

Los controladores legados lo importan como si el módulo fuera directamente la
instancia, por lo que esa integración debe corregirse si se reactiva.

### `utils/logger.js`

- Requiere `init(directory)` antes de escribir.
- Crea un archivo por mes: `log-YYYY-MM.txt`.
- Cada línea lleva timestamp ISO.
- En desarrollo también escribe a consola.
- `getLog()` devuelve `null` si no existe el archivo.

### `utils/db2.js`

- Usa una conexión `mysql.createConnection`, no un pool pese a que la configuración
  contiene opciones de pool.
- `executeQuery()` es el único gateway general de SQL.
- `registro` funciona como almacén clave/valor.
- El backup invoca `mysqldump`; el restore invoca `mysql`.

### Integración con el molinete

- El puente externo escucha en `localhost:9000/ejecutar`.
- El proceso principal mata y reinicia el EXE al reconectar; solicita elevación de
  Windows con `Start-Process -Verb RunAs`.
- Los callbacks del puente llegan a `localhost:4000/escucha`.
- La sincronización importa logs, asocia usuarios y turnos de musculación,
  habilita/deshabilita usuarios y opcionalmente limpia registros del equipo.
- Hay un lock en memoria (`sincronizando`) y recuperación si quedó activo más de
  15 minutos.
- El cron alterna sincronizaciones inteligentes/completas y limpiezas según
  contadores guardados en `registro`.

## 13. Prácticas de desarrollo observadas

### Prácticas positivas

- Aislamiento de contexto en Electron y API limitada por preload.
- Consultas SQL generalmente parametrizadas.
- Separación visual por pantalla y clase controladora.
- `async`/`await` para flujos asíncronos.
- Bajas lógicas para conservar historial.
- Logs persistentes y mensajes de progreso para operaciones del molinete.
- Recursos UI principales empaquetados localmente, útil en un entorno sin Internet.
- Backup operativo y build reproducible mediante scripts npm.

### Convenciones del código

- CommonJS en Node; globals y clases sin módulos en el navegador.
- Nombres de dominio y mensajes en español.
- jQuery para eventos y DOM; Bootstrap para estado visual.
- Métodos `init()` cargan datos y registran eventos.
- Un objeto seleccionado y una bandera `esNuevo` gobiernan muchos CRUD.
- Validación de formularios en el renderer antes del SQL.
- Errores visibles mediante `modal.message()` y errores operativos mediante logger.

### Ausencias relevantes

- No hay tests automatizados.
- No hay ESLint, Prettier ni configuración de estilo.
- No hay CI.
- No hay migraciones, seeds ni documentación del esquema MySQL.
- No hay tipos estáticos ni JSDoc sistemático.
- No hay separación de repositorio/servicio para reglas de negocio.

## 14. Riesgos y deuda técnica priorizada

1. **SQL arbitrario desde el renderer.** Cualquier XSS o código inyectado en una
   vista puede invocar `executeQuery`. Conviene reemplazarlo gradualmente por
   operaciones IPC específicas con validación en el proceso principal.
2. **Credenciales sin hash.** El login compara `contrasena` directamente en SQL;
   las funciones bcrypt están deshabilitadas.
3. **HTML sin escape.** Modal, tablas y opciones interpolan datos con template
   strings; sanear valores provenientes de usuarios o dispositivos.
4. **Restore inconsistente.** `inicio.js` entrega `file.path`, pero `preload.js`
   no acepta ni reenvía argumentos; `index.js` llama `db.restoreBackup()` sin
   path. Además, en `db2.js` la dirección de `pipe` está invertida. Considerar
   restore no operativo hasta corregirlo y probarlo con una copia descartable.
5. **Backup frágil.** `makeBackup()` usa `this.setRegistro` desde una arrow
   function; debería invocar la función local. Puede fallar la primera vez que no
   existe `mysqldump-path`.
6. **Parámetros IPC del molinete desalineados.** La sincronización individual
   envía `{usuarioId}` pero recibe `{enrollNumber}`; la apertura temporal envía un
   número pero recibe `{ms}`. Corregir ambos extremos juntos y agregar una prueba
   del contrato.
7. **Sesión sólo en memoria y sin guardas.** Navegar directamente a otro HTML no
   muestra una verificación central de autenticación/autorización.
8. **Configuración sensible.** El renderer puede pedir el config completo y el
   repositorio contiene configuración legada con secretos.
9. **Conexión única MySQL.** No hay reconexión ni pool real; una desconexión puede
   dejar inutilizable la sesión.
10. **Código legado mezclado.** Dependencias y carpetas antiguas dificultan saber
   qué está soportado.
11. **Problemas de encoding.** Hay texto mojibake (`Ã`, `Â`) en varios fuentes y
    configuraciones; estandarizar UTF-8 antes de hacer reemplazos masivos.
12. **Integridad transaccional.** El renderer envía cada sentencia de una
    transacción por IPC; un error o navegación entre llamadas puede dejar la
    conexión en estado transaccional.
13. **Dependencia externa de Excel.** `resumen.html` usa un CDN aunque hay otros
    recursos locales; sin red puede fallar la exportación.

## 15. Cómo implementar un cambio

### Cambio sólo visual o de formulario

1. Modificar `public/html/<modulo>.html`.
2. Modificar su clase en `public/js/<modulo>.js`.
3. Reutilizar `modal` y `utils` ya instanciados por la página.
4. Escapar cualquier texto externo antes de interpolarlo en HTML.
5. Probar alta, edición, cancelación y navegación completa de la pantalla.

### Nueva operación de datos

En el diseño actual se puede llamar `executeQuery`, pero para código nuevo se
recomienda una operación IPC específica:

1. Definir un método pequeño en `preload.js`.
2. Crear el handler en `index.js`.
3. Validar y normalizar los parámetros en el proceso principal.
4. Ejecutar SQL parametrizado en `utils/db2.js` o en un módulo de dominio nuevo.
5. Devolver datos serializables y manejar el error en el renderer.

### Nueva pantalla

1. Copiar la estructura compartida de una pantalla equivalente.
2. Agregar HTML, CSS si hace falta y una clase en `public/js/`.
3. Respetar el orden de scripts: jQuery → Popper → AdminLTE/Bootstrap → helpers →
   script de pantalla.
4. Crear `modal` y `utils` una sola vez.
5. Añadir el enlace de navegación en todas las páginas actuales o extraer primero
   el menú duplicado a una solución compartida.

### Cambio en el molinete

1. Confirmar el contrato exacto del comando con `InterfazMolineteSDK.exe`.
2. Mantener timeout y logging.
3. Respetar el lock `sincronizando`.
4. Probar conexión caída, respuesta no JSON, usuario inexistente y repetición.
5. No ejecutar una sincronización real contra producción como prueba inicial.

## 16. Checklist para el primer aporte

- [ ] Confirmar que se trabaja sobre el flujo activo Electron/IPC, no sobre rutas legadas.
- [ ] Respaldar la base antes de cambiar persistencia.
- [ ] No incluir `Documentos/fulltraining-2026/config.json` ni datos reales en Git.
- [ ] Usar placeholders SQL para todos los valores.
- [ ] No interpolar texto no confiable dentro de HTML.
- [ ] Verificar el resultado con DevTools y revisar el log mensual.
- [ ] Probar con el molinete desconectado si la pantalla lo utiliza.
- [ ] Ejecutar al menos `node --check` sobre los JavaScript modificados.
- [ ] Probar `npm start`; para cambios de distribución, probar también `npm run build`.
- [ ] Documentar cualquier cambio de esquema mientras no existan migraciones.

## 17. Próximos pasos recomendados

1. Incorporar un `schema.sql` o migraciones y un dataset mínimo sin información
   personal.
2. Corregir y probar backup/restore.
3. Retirar secretos del repositorio y rotar los que hayan sido reales.
4. Agregar handlers IPC orientados a casos de uso y dejar de exponer SQL general.
5. Implementar hashing de contraseña y guardas de autorización.
6. Añadir smoke tests para login, usuarios, turnos/cobros y sincronización simulada.
7. Separar o eliminar la arquitectura legada y sus dependencias.
8. Unificar encoding UTF-8 y fijar lint/format.
