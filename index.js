const { app, BrowserWindow, ipcMain, globalShortcut, shell  } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const db = require("./utils/db2");
const logger = require("./utils/logger.js");
const { exec } = require("child_process");
const escuchadorSDK = require("./escuchadorSDK.js");
const cron = require("node-cron");

let documentsPath = "";
let desktopPath = "";
const isPackaged = app.isPackaged; // modo de produccion o desarrollo
let usuarioLogeado = null; // variable global para almacenar el usuario logeado
let config = null;

let win;
async function createWindow() {
    try{
        config = JSON.parse(fs.readFileSync(path.join(documentsPath, "fulltraining-2026", "config.json"), "utf-8"));
    
        win = new BrowserWindow({
            width: 1600,
            height: 900,
            icon: path.join(__dirname, 'public', 'resources', 'icono-96-blanco.png'),
            webPreferences: {
                //devTools: configuracion?.debug === true,
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                enableRemoteModule: false,
            },
        });
        logger.log("Aplicacion iniciada");
    
        
        db.connect(config?.db).then(()=>{
            win.loadFile('./public/html/index.html');
        }).catch(err=>{
            win.loadURL(`
                data:text/html,
                <h1>Error al conectar con la base de datos</h1>
                <pre>${encodeURIComponent(err.stack || err.message)}</pre>
            `);
        });
    
    
        if(isPackaged && config.debug !== true){
            win.setMenuBarVisibility(false);
        }else{
            win.setMenuBarVisibility(true);
            setTimeout(()=>{//espero y muestro devtools
                win.webContents.openDevTools();
            },2000);
        }
    
        win.on('closed', () => {
            win = null;
        });
    }catch(e){
        console.log("Error al crear la ventana principal: " + e.message, "error");
        throw e;
    }
}

app.whenReady().then(() => {
    //Crea las carpetas neecesarias para el sistema
    try{
        documentsPath = app.getPath('documents');
        desktopPath = app.getPath('desktop');
        let directories = [
            path.join(documentsPath, "fulltraining-2026"), // guarda los archivos de configuracion y datos del sistema
            path.join(documentsPath, "fulltraining-2026", "data"), // guarda los productos y configuracion
            path.join(documentsPath, "fulltraining-2026", "logs"), 
            path.join(documentsPath, "fulltraining-2026", "temp"), // guarda datos temporales
        ];
        directories.forEach(directory=>{
            if(fs.existsSync(directory) == false) fs.mkdirSync( directory, { recursive: true } );
        });
        logger.init(path.join(documentsPath, "fulltraining-2026", "logs"));

        //inicio express para escuchar al SDK
        escuchadorSDK.startListener((resp)=>{
            if(resp.status == "error"){
                logger.log(`No se pudo iniciar el escuchador SDK: ${resp.message}`, "error");
            }else{
                logger.log("Iniciado escuchador SDK en puerto 4000. POST /escucha");
            }
        });
        
        //copio config.json
        if(fs.existsSync(path.join(documentsPath, "fulltraining-2026", "config.json")) == false){
            let defaultConfig = {
                debug: false,
                db: {
                    host: "localhost",
                    user: "root",
                    password: "servidor",
                    database: "gimnasio2026"
                },
                molinete: {
                    ip: "127.0.0.1",
                    port: "1234",
                    password: "123456789"
                }
            }
            fs.writeFileSync(path.join(documentsPath, "fulltraining-2026", "config.json"), JSON.stringify(defaultConfig, null, 4));
        }
    }catch(e){
        console.log("Error al iniciar la aplicación: " + e.message, "error");
        throw e;
    }

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
    if (win === null) createWindow();
});
ipcMain.handle("set-usuario-logeado", async (event, data) => {
    usuarioLogeado = data;
    return true;
});
ipcMain.handle("get-usuario-logeado", async (event, data) => {
    return usuarioLogeado;
});
ipcMain.handle("execute-query", async (event, data) => {
    let resp = await db.executeQuery(data.query, data.params);
    return resp;
});
ipcMain.handle("set-registro", async (event, data) => {
    let resp = await db.setRegistro(data.clave, data.valor);
    return resp;
});
ipcMain.handle("get-registro", async (event, data) => {
    let resp = await db.getRegistro(data.clave);
    return resp;
});
ipcMain.handle("get-log", async (event, data) => {
    let resp = await logger.getLog(data?.yearMonth);
    return resp;
});
ipcMain.handle("write-log", async (event, data) => {
    logger.log(data.message, data.args);
    return true;
});
ipcMain.handle("make-backup", async (event, data) => {
    let p = path.join(documentsPath, "fulltraining-2026", "data", `backup-${new Date().toISOString().replace(/:/g, "-")}.sql`);
    let resp = await db.makeBackup(p);
    shell.showItemInFolder(p);
    return resp;
});
ipcMain.handle("restore-backup", async (event, data) => {
    let resp = await db.restoreBackup();
    return resp;
});
ipcMain.handle("open-dev-tools", async (event, data) => {
    win.webContents.openDevTools();
    return true;
});
ipcMain.handle("get-config", async (event, data) => {
    let config = JSON.parse(fs.readFileSync(path.join(documentsPath, "fulltraining-2026", "config.json"), "utf-8"));
    return config;
});

//MOLINETE
let estadoMolinete = {status: false, message: "No conectado"};
let sincronizando = {estado: false, iniciado: null};
let registrosMolinete = [];
async function conectarMolinete(forzar = false){
    try{
        escribirRegistrosMolinete("Intentando conectar con el molinete...");
        // Verifico la existencia del archivo InterfazMolineteSDK.exe
        const nombreExe = "InterfazMolineteSDK.exe";
        const molineteSDKPath = path.join(documentsPath, "fulltraining-2026", nombreExe);
        if(fs.existsSync(molineteSDKPath) == false) throw `No se encontró el archivo ${nombreExe} en la ruta ${molineteSDKPath}`;

        // Verificar si está ejecutándose
        const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${nombreExe}"`);

        const isRunning = stdout.toLowerCase().includes(nombreExe.toLowerCase());

        // Si está, finalizarlo
        if (isRunning) {
            await execAsync(`taskkill /F /IM "${nombreExe}"`);
            // Esperar un instante para asegurarse de que terminó
            await new Promise(resolve => setTimeout(resolve, 1000));
            estadoMolinete = {status: false, message: "Se detuvo el proceso InterfazMolineteSDK.exe"};
            escribirRegistrosMolinete("Se detuvo el proceso InterfazMolineteSDK.exe");
        }

        // Iniciar nuevamente como administrador
        await execAsync(`powershell -Command "Start-Process '${molineteSDKPath}' -Verb RunAs"`);
        estadoMolinete = {status: false, message: "Se inició correctamente InterfazMolineteSDK.exe"};
        escribirRegistrosMolinete("Se inició correctamente InterfazMolineteSDK.exe");

        let fd = new FormData();
        fd.append("accion", "conectar-molinete");
        fd.append("ip", config?.molinete?.ip || "");
        fd.append("port", config?.molinete?.port || "");
        fd.append("password", config?.molinete?.password || "");
        const resp = await axios.post(
            "http://localhost:9000/ejecutar", 
            fd, 
            {
                headers: fd.getHeaders?.() // no hace falta en Node 18, pero no molesta
            }
        );
        if(resp.data.toString() == "conectado"){
            estadoMolinete = {status: true, message: "Conectado correctamente al molinete"};
            escribirRegistrosMolinete("Conectado correctamente al molinete");
        }else{
            estadoMolinete = {status: false, message: "Error al conectar con el molinete: " + resp.data.toString()};
            escribirRegistrosMolinete("Error al conectar con el molinete: " + resp.data.toString());
        }
    }catch(err){
        estadoMolinete = {status: false, message: "Error al conectar con el molinete: " + err.toString()};
        escribirRegistrosMolinete("Error al conectar con el molinete: " + err.toString());
    }finally{
        return estadoMolinete;
    }
}
async function ejecutarMolinete(accion, data = {}){
    let t0 = performance.now();
    try{
        let fd = new FormData();
        fd.append("accion", accion);
        for(let key in data){
            fd.append(key, data[key]);
        }

        let resp = await axios({
            method: "post",
            url: "http://localhost:9000/ejecutar",
            data: fd,
            headers: fd.getHeaders?.(), // no hace falta en Node 18, pero no molesta
            timeout: 60_000 // 1 minuto
        });
        //console.log("resp:", resp);
        return resp.data;
    }catch(e){
        escribirRegistrosMolinete(`Error al ejecutar acción "${accion}": ${e.message}`);
        return false;
    }finally{
        let t1 = performance.now();
        escribirRegistrosMolinete(`Acción "${accion}" ejecutada en ${(t1 - t0).toFixed(2)} ms`);
    }
}
async function escribirRegistrosMolinete(str){
    const ahora = getDateTime(false);
    registrosMolinete.push(ahora + " # " + str);
    if(registrosMolinete.length > 1000) registrosMolinete.shift();
    win.webContents.send("evento-sdk", {from: "backend", body: registrosMolinete.at(-1)});
}
/* ipcMain.on("escuchar-sdk", () => {
    escuchadorSDK.setCallback((body) => {
        win.webContents.send("evento-sdk", {from: "molinete", body: body});
    });
}); */
ipcMain.handle("get-consola-molinete", async (event, data) => {
    return registrosMolinete;
});
ipcMain.handle("status-molinete", async (event, data) => {
    return estadoMolinete;
})
ipcMain.handle("conectar-molinete", async (event, data) => {
    let resp = await conectarMolinete(true);
    if(resp){
        escuchadorSDK.setCallback((body) => {
            win.webContents.send("evento-sdk", {from: "molinete", body: body});
        });
    }
    return resp;
});
ipcMain.handle("sincronizar-molinete", async (event, data) => {
    let resp = await sincronizar(data?.sincroInteligente, data?.limpiarRegistros);
    return resp;
});
ipcMain.handle("obtener-usuarios-molinete", async (event, data) => {
    let resp = await ejecutarMolinete("obtener-usuarios-molinete");
    if(typeof resp == "string") resp = JSON.parse(resp);
    return resp;
});
ipcMain.handle("habilitar-paso-molinete", async (event, data) => {
    const ms = Number(data?.ms || 3000);
    let resp = await ejecutarMolinete("habilitar-pase-molinete", {time: ms});  
    return resp;
});
ipcMain.handle("ejecutar-molinete", async (event, data) => {
    const resp = await ejecutarMolinete(data.accion, data.params);
    return resp;
});
ipcMain.handle("sincronizar-individual-molinete", async (event, data) => {
    let resp = [];
    try{
        const { enrollNumber, habilitar } = data;
        if(!enrollNumber) throw "No se proporcionó un enrollNumber válido";
        const ahora = getDateTime(true);
        if(sincronizando.estado == true){
            if(sincronizando.iniciado && (new Date() - sincronizando.iniciado) > 15 * 60 * 1000){ // si lleva mas de 15 minutos, lo reinicio
                sincronizando.estado = false;
                sincronizando.iniciado = null;
            }else{
                throw "Ya hay una sincronización en curso, espere a que finalice";
            }
        }
        sincronizando.estado = true;
        sincronizando.iniciado = new Date();

        //0. Verifico si el molinete está conectado, si no lo está, intento conectarlo
        if(estadoMolinete.status == false){
            let respMolinete = await conectarMolinete();
            if(respMolinete.status == false) throw "0. No se pudo conectar con el molinete: " + respMolinete.message;
            else resp.push("0. Conectado correctamente con el molinete");
        }

        //1. Ejecuto la acción en el molinete
        let accion = habilitar ? "habilitar-usuario-molinete" : "deshabilitar-usuario-molinete";
        let respMolinete = await ejecutarMolinete(accion, { enrollNumber });
        if(respMolinete.toString() == "ok"){
            resp.push(`1. Usuario ${enrollNumber} ${habilitar ? "habilitado" : "deshabilitado"} correctamente en el molinete`);
            //2. Actualizo la base de datos local
            await db.executeQuery(`UPDATE usuario SET paseHabilitado = ? WHERE enrollNumber = ?`, [habilitar ? 1 : 0, enrollNumber]);
            resp.push(`2. Base de datos local actualizada correctamente para el usuario ${enrollNumber}`);
        }else{
            throw `Error al ${habilitar ? "habilitar" : "deshabilitar"} el usuario ${enrollNumber} en el molinete: ${respMolinete.toString()}`;
        }

    }catch(err){
        resp.push("Error al sincronizar individual: " + err.toString());  
        logger.log("Error al sincronizar individual: " + err.toString(), "error");
    }finally{
        sincronizando.estado = false;
        sincronizando.iniciado = null;

        registrosMolinete.push(getDateTime(false) + " # " + resp.join("<br>"));
        return resp;
    }
});


//HELPERS
async function sincronizar(sincroInteligente=true, limpiarRegistros=false){
    let resp = [];
    try{
        if(typeof sincroInteligente !== "boolean") throw "sincroInteligente debe ser un booleano";
        if(typeof limpiarRegistros !== "boolean") throw "limpiarRegistros debe ser un booleano";

        const ahora = getDateTime(true);
        const ahoraFechaHora = getDateTime(false);
        if(sincronizando.estado == true){
            if(sincronizando.iniciado && (new Date() - sincronizando.iniciado) > 15 * 60 * 1000){ // si lleva mas de 15 minutos, lo reinicio
                sincronizando.estado = false;
                sincronizando.iniciado = null;
            }else{
                throw "Ya hay una sincronización en curso, espere a que finalice";
            }
        }
        sincronizando.estado = true;
        sincronizando.iniciado = new Date();

        resp.push(`${ahoraFechaHora} # Iniciando sincronización del molinete (sincroInteligente: ${sincroInteligente}, limpiarRegistros: ${limpiarRegistros})`);

        //0. Verifico si el molinete está conectado, si no lo está, intento conectarlo
        if(estadoMolinete.status == false){
            let respMolinete = await conectarMolinete();
            if(respMolinete.status == false) throw "0. No se pudo conectar con el molinete: " + respMolinete.message;
            else resp.push("0. Conectado correctamente con el molinete");
        }

        //1. Obtengo los logs (pasadas) del molinete
        let tObtenerLogs0 = performance.now();
        let logs = await ejecutarMolinete("obtener-logs-molinete");
        if(typeof logs == "string") logs = JSON.parse(logs);
        let tObtenerLogs1 = performance.now();
        resp.push("1. Logs obtenidos correctamente del molinete (registros: " + logs.length + ", tiempo: " + (tObtenerLogs1 - tObtenerLogs0).toFixed(2) + " ms)");

        //2. Obtenglo localmente las pasadas (de los ultimos 20 dias)
        let tPasesBD0 = performance.now();
        let hace20Dias = new Date();
        hace20Dias.setDate(hace20Dias.getDate() - 20);
        let misRegistros = await db.executeQuery(`SELECT * FROM pase WHERE fecha >= ?`, [hace20Dias.toISOString().slice(0, 10)]);
        let tPasesBD1 = performance.now();
        resp.push("2. Pasadas obtenidas correctamente de la base de datos (registros: " + misRegistros.length + ", tiempo: " + (tPasesBD1 - tPasesBD0).toFixed(2) + " ms)");

        //3- Obtengo los usuarios locales
        let tUsuariosLocales0 = performance.now();
        let usuariosLocales = await db.executeQuery(`SELECT * FROM usuario WHERE eliminado != 1`);
        let objUsuariosLocales = {};
        usuariosLocales.forEach(u=>{
            objUsuariosLocales[u.enrollNumber] = u;
        });
        let tUsuariosLocales1 = performance.now();
        resp.push("3. Usuarios locales obtenidos correctamente de la base de datos (registros: " + usuariosLocales.length + ", tiempo: " + (tUsuariosLocales1 - tUsuariosLocales0).toFixed(2) + " ms)");

        //4- Guardo en mi BD los registros que no existan
        let tRegistrarPases0 = performance.now();
        for(let log of logs){
            let existe = misRegistros.find(r=> r.fecha === log.date);
            if(!existe){
                let q = `INSERT INTO pase SET 
                usuarioId = ?, 
                usuarioNombre=?,
                enrollNumber = ?,
                createdAt = NOW(),

                fecha = ?, 
                full = ?, 
                iGLCount = ?`;
                let usuarioId = objUsuariosLocales[log.enrollNumber]?.id || -1;
                let usuarioNombre = objUsuariosLocales[log.enrollNumber]?.nombre || "Desconocido";

                await db.executeQuery(q, [
                    usuarioId, 
                    usuarioNombre, 
                    log.enrollNumber, 
                    log.date, 
                    JSON.stringify(log), 
                    log.iGLCount
                ]);
            }
        }
        let tRegistrarPases1 = performance.now();
        resp.push("4. Pasadas registradas correctamente en la base de datos (tiempo: " + (tRegistrarPases1 - tRegistrarPases0).toFixed(2) + " ms)");

        //5- Re-obtengo las pasadas directo desde BD y la asigno pases a usuarios
        let ultimosRegistros = await db.executeQuery(`SELECT * FROM pase WHERE fecha >= ?`, [hace20Dias.toISOString().slice(0, 10)]);
        ultimosRegistros.forEach(r=>{
            let usuarioLocal = objUsuariosLocales[r.enrollNumber];
            if(!usuarioLocal) return; // no existe en mi BD local
            if(!usuarioLocal.regPases) usuarioLocal.regPases = [];
            usuarioLocal.regPases.push(r);
        });
        resp.push("5. Pasadas re-obtenidas y asignadas a cada usuario (usuarios con pases: " + Object.values(objUsuariosLocales).filter(u=>u.regPases && u.regPases.length > 0).length + ")");

        //6- Obtengo de cada usuario el ultimo registro de fierros/musculacion (disciplinaId = -1) que no esté cancelado ni eliminado y que esté vigente (desde <= hoy <= hasta)
        //tambien asigno la cantidad de pasadas que tuvo en el dia y la cantidad disponible que tiene
        let tTurnos0 = performance.now();
        let regTurnos = await db.executeQuery(`SELECT * FROM turno WHERE disciplinaId = -1 AND cancelado = 0 AND eliminado = 0 AND desde <= ? AND hasta >= ? ORDER BY id DESC`, [ahora, ahora]);
        for(let usuario of Object.values(objUsuariosLocales)){
            usuario.cantPases = verificarCantidadPasadas(usuario.regPases || []);
            usuario.dias = regTurnos.find(t=> t.usuarioId == usuario.id)?.dias || 0;
        }
        let tTurnos1 = performance.now();
        resp.push("6. Turnos obtenidos correctamente de la base de datos y asignados a cada usuario (tiempo: " + (tTurnos1 - tTurnos0).toFixed(2) + " ms)");

        //7. Ejecuto los cambios en el molinete
        let ejecuciones = 0, habilitados = 0, deshabilitados = 0;
        let tEjecutarAcciones0 = performance.now();
        for(let usuario of this.usuariosMolinete){
            let usuarioLocal = objUsuariosLocales[usuario.enrollNumber];
            if(!usuarioLocal) continue; // no existe en mi BD local

            if(sincroInteligente){
                let permitido = (usuarioLocal.paseLibre === 1) || (usuarioLocal.cantPases < usuarioLocal.dias);
                if(permitido && !usuarioLocal.paseHabilitado){
                    await ejecutarMolinete("habilitar-usuario-molinete", { enrollNumber: usuario.enrollNumber });
                    await db.executeQuery(`UPDATE usuario SET paseHabilitado = 1 WHERE id = ?`, [usuarioLocal.id]);
                    ejecuciones++;
                    habilitados++;
                } 
                else if(!permitido && usuarioLocal.paseHabilitado) {
                    await ejecutarMolinete("deshabilitar-usuario-molinete", { enrollNumber: usuario.enrollNumber });
                    await db.executeQuery(`UPDATE usuario SET paseHabilitado = 0 WHERE id = ?`, [usuarioLocal.id]);
                    ejecuciones++;
                    deshabilitados++;
                }
            }else{
                if(usuarioLocal.paseLibre === 1 || usuarioLocal.cantPases < usuarioLocal.dias){
                    await ejecutarMolinete("habilitar-usuario-molinete", { enrollNumber: usuario.enrollNumber });
                    await db.executeQuery(`UPDATE usuario SET paseHabilitado = 1 WHERE id = ?`, [usuarioLocal.id]);
                    ejecuciones++;
                    habilitados++;
                }else{
                    await ejecutarMolinete("deshabilitar-usuario-molinete", { enrollNumber: usuario.enrollNumber });
                    await db.executeQuery(`UPDATE usuario SET paseHabilitado = 0 WHERE id = ?`, [usuarioLocal.id]);
                    ejecuciones++;
                    deshabilitados++;
                }
            }
        }
        let tEjecutarAcciones1 = performance.now();
        resp.push("7. Acciones ejecutadas correctamente en el molinete (ejecuciones: " + ejecuciones + ", habilitados: " + habilitados + ", deshabilitados: " + deshabilitados + ", tiempo: " + (tEjecutarAcciones1 - tEjecutarAcciones0).toFixed(2) + " ms)");

        //8. Borro los registros pasados del molinete
        if(limpiarRegistros){
            let tBorrarLogs0 = performance.now();
            let respBorrarLogs = await ejecutarMolinete("borrar-logs-pasadas");
            let tBorrarLogs1 = performance.now();
            resp.push("8. Registros del molinete borrados correctamente (tiempo: " + (tBorrarLogs1 - tBorrarLogs0).toFixed(2) + " ms)");
        }else{
            resp.push("8. No se borraron los registros del molinete (limpiarRegistros = false)");
        }

        resp.push("--Sincronización finalizada correctamente--");
    }catch(err){
        resp.push("Error al sincronizar: " + err.toString());  
        logger.log("Error al sincronizar: " + err.message, "error");
    }finally{
        sincronizando.estado = false;
        sincronizando.iniciado = null;
        registrosMolinete.push(resp.join("<br>"));
        if(registrosMolinete.length > 1000) registrosMolinete = registrosMolinete.slice(registrosMolinete.length - 1000);

        return resp;
    }
}
function verificarCantidadPasadas(registros){
    const umbral = 3 * 60 * 60 * 1000; // 3 horas
    const propFecha = "date"; // Propiedad que contiene la fecha en cada registro

    let contador = 0;
    registros
    .sort((a,b)=> new Date(a[propFecha]) - new Date(b[propFecha]))
    .forEach((p, i) => {
        let fx = new Date(p[propFecha]).getTime();
        let fxAnterior = i > 0 ? new Date(registros[i - 1][propFecha]).getTime() : null;

        // si la diferencia es menor al umbral, no contamos esta pasada
        if(fxAnterior && (fx - fxAnterior) < umbral) return;
        contador++;
    });
    return contador;
}
function obtenerNumeroSemana(date = new Date()){
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}
function execAsync(command) {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) return reject(err);
            resolve({ stdout, stderr });
        });
    });
}
function getDateTime(soloFecha = false) {
    const ahora = new Date().toLocaleString("sv-SE", {
        timeZone: "America/Argentina/Buenos_Aires"
    });
    if (soloFecha) return ahora.split(" ")[0];
    else return ahora;
}

//CRON - cada 1 hora sincronizo el molinete
cron.schedule('0 * * * *', async () => {
    try{
        logger.log("Iniciando sincronización automática del molinete...");
        let limpiarLogs = false; //por defecto no limpia
        let sincroInteligente = true; //por defecto sincro inteligente
        
        let contadorLimpiezaLogs = Number(await db.getRegistro("contador-limpieza-logs")) || 0;
        let contadorSincroFull = Number(await db.getRegistro("contador-sincro-full")) || 0;

        //cada X sincronizaciones sin limpieza, obliga a limpiar los logs
        if(contadorLimpiezaLogs > 100){
            await db.setRegistro("contador-limpieza-logs", 0);
            limpiarLogs = true;
        }else{
            await db.setRegistro("contador-limpieza-logs", contadorLimpiezaLogs + 1);
        }

        //cada X sincronizaciones inteligentes, obliga a hacer una full
        if(contadorSincroFull > 20){
            await db.setRegistro("contador-sincro-full", 0);
            sincroInteligente = false;
        }else{
            await db.setRegistro("contador-sincro-full", sincroInteligente + 1);
        }

        escribirRegistrosMolinete(`Iniciando sincronización automática del molinete (sincroInteligente: ${sincroInteligente}, limpiarLogs: ${limpiarLogs})`);
        let resp = await sincronizar(sincroInteligente, limpiarLogs);
        logger.log("Sincronización automática del molinete finalizada");
    }catch(e){
        logger.log("Error al iniciar la sincronización automática del molinete: " + e.message, "error");
    }
});