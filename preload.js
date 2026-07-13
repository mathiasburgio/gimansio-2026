const { contextBridge, ipcRenderer  } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    isElectron: true,
    getLog: () => ipcRenderer.invoke("get-log"),
    writeLog: (message, ...args) => ipcRenderer.invoke("write-log", { message, args }),

    setUsuarioLogeado: (data) => ipcRenderer.invoke("set-usuario-logeado", data),
    getUsuarioLogeado: () => ipcRenderer.invoke("get-usuario-logeado"),
    
    executeQuery: (query, params) => ipcRenderer.invoke("execute-query", { query, params }),
    setRegistro: (clave, valor) => ipcRenderer.invoke("set-registro", { clave, valor }),
    getRegistro: (clave) => ipcRenderer.invoke("get-registro", { clave }),

    makeBackup: () => ipcRenderer.invoke("make-backup"),
    restoreBackup: () => ipcRenderer.invoke("restore-backup"),
    openDevTools: () => ipcRenderer.invoke("open-dev-tools"),
    getConfig: () => ipcRenderer.invoke("get-config"),
    
    //connectMolinete: () => ipcRenderer.invoke("connect-molinete"), //si esta conectado fuerza reconexion
    //isConnectedMolinete: () => ipcRenderer.invoke("is-connected-molinete"),

    //escucharSDK: () => ipcRenderer.send("escuchar-sdk"),
    onEventoSDK: (callback) => { ipcRenderer.on("evento-sdk", (event, body) => { callback(body); }); },
    getConsolaMolinete: () => ipcRenderer.invoke("get-consola-molinete"),
    statusMolinete: () => ipcRenderer.invoke("status-molinete"),
    conectarMolinete: () => ipcRenderer.invoke("conectar-molinete"),
    sincronizarMolinete: (sincroInteligente, limpiarRegistros) => ipcRenderer.invoke("sincronizar-molinete", { sincroInteligente, limpiarRegistros }),
    obtenerUsuariosMolinete: () => ipcRenderer.invoke("obtener-usuarios-molinete"),
    habilitarPasoMolinete: (ms=3000) => ipcRenderer.invoke("habilitar-paso-molinete", { ms }),
    ejecutarMolinete: (comando, params) => ipcRenderer.invoke("ejecutar-molinete", { comando, params }),
    sincronizarIndividualMolinete: (enrollNumber, habilitar) => ipcRenderer.invoke("sincronizar-individual-molinete", { enrollNumber, habilitar }),
});