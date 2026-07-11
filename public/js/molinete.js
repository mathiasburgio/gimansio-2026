class Molinete{
    constructor(){
        this.conectado = null;
        this.usuariosMolinete = [];
        this.init();
    }
    async init(){
        $("#conectar").on("click", async ev => {
            let ele = $(ev.currentTarget);
            ele.prop("disabled", true);
            await this.conectarse();
            ele.prop("disabled", false);
        });
        $("#ver-usuarios-molinete").on("click", (ev) => {
            if(!this.conectado) return this.escribirLog("No hay conexión con el molinete", "danger");
            this.listarUsuariosMolinete(ev.shiftKey);
        });
        $("#sincronizar").on("click", async (ev) => {
            if(!this.conectado) return this.escribirLog("No hay conexión con el molinete", "danger");
            let inteligente = (ev.shiftKey);
            let borrarLogs = false;
            
            let ultimaSincronizacion = await window.electronAPI.getRegistro("ultima-sincronizacion-molinete");
            let ultimaSincronizacionInteligente = await window.electronAPI.getRegistro("ultima-sincronizacion-molinete-inteligente");
            let ultimaLimpiezaLogs = await window.electronAPI.getRegistro("ultima-limpieza-logs-molinete");

            let ahora = new Date();
            if(!ultimaSincronizacion) ultimaSincronizacion = 0;
            if(!ultimaSincronizacionInteligente) ultimaSincronizacionInteligente = 0;
            if(!ultimaLimpiezaLogs) ultimaLimpiezaLogs = 0;

            //verifico si la ultima sincro completa no inteligente fue hace mas de 10 dias
            if(!inteligente && (ahora.getTime() - ultimaSincronizacion) > (10 * 24 * 60 * 60 * 1000)){
                inteligente = false; // fuerzo la sincro completa
            }

            //verifico si la ultima limpieza de logs fue hace mas de 10 dias
            if((ahora.getTime() - ultimaLimpiezaLogs) > (10 * 24 * 60 * 60 * 1000)){
                borrarLogs = true; // fuerzo la limpieza de logs
            }

            modal.waiting("Sincronizando usuarios -> turnos(fierros/musculación) -> molinete...");
            await this.sincronizar(inteligente, borrarLogs);
            modal.hide();
        });
        $("#habilitar-pase").on("click", async () => {
            if(!this.conectado) return this.escribirLog("No hay conexión con el molinete", "danger");
            modal.waiting("Habilitando pase...");
            await this.habilitarPase();
            modal.hide();
        });

        window.electronAPI.onEventoSDK((body) => {
            console.log(body);
        });
        window.electronAPI.escucharSDK();

        let isConnected = (await window.electronAPI.isConnectedMolinete())?.status || false;
        if(isConnected){
            $("#conectar").addClass("btn-success").removeClass("btn-danger");
            this.conectado = true;
        }
    }
    async habilitarPase(ms=3000){
        try{
            let resp = await this.ejecutar("habilitar-pase-molinete", {time: ms})
            if(resp == "ok") this.escribirConsola("Molinete habilitado para paso");
        }catch(e){
            this.escribirLog("Error al habilitar pase: " + e.message, "danger");
        }finally{
            await utils.sleep(3000);
        }
    }
    async conectarse(){
        let isConnected = (await window.electronAPI.isConnectedMolinete())?.status || false;
        if(!this.conectado){
            
            let config = await window.electronAPI.getConfig();
            let data= {
                ip: config.molinete.ip || "",
                port: config.molinete.port || "",
                password: config.molinete.password || ""
            };

            let resp = await this.ejecutar("conectar-molinete", data);
            if(resp == "conectado"){
                this.escribirConsola(`Conectado a ${data.ip}:${data.port}`);
                $("#conectar").addClass("btn-success").removeClass("btn-danger");
                this.conectado = true;
            }
        }else{
            let resp = await modal.yesno("¿Reiniciar conexión?");
            if(!resp) return;
            let resp2 =await window.electronAPI.connectMolinete();
            if(resp2 === true){
                this.escribirLog("Conexión con molinete establecida (reconexión)", "success");
                $("#conectar").addClass("btn-success").removeClass("btn-danger");
                this.conectado = true;
            }
        }
    }
    async listarUsuariosMolinete(relectura=false){
        modal.show({
            title: "Usuarios del molinete",
            body: $("#modal-usuarios-molinete").html(),
            buttons: "back"
        })

        //obtengo los usuarios
        modal.setWaiting2(true, "Cargando usuarios del molinete...");
        if(relectura || !this.usuariosMolinete.length){
            let resp = await this.ejecutar("obtener-usuarios-molinete");
            this.usuariosMolinete = resp;
        }
        modal.setWaiting2(false);

        //filtrador
        const filtrarUsuarios = () => {
            let palabra = $("#modal #buscar").val().toLowerCase().trim();
            let tbody = [];
            this.usuariosMolinete
            .filter(u=>{
                if(!palabra || u.name.toLowerCase().includes(palabra)) return true;
                return false;
            })
            .forEach(u=>{
                if(tbody.length > 100) return;
                tbody.push(`
                    <tr data-id="${u.id}">
                        <td>${u.name}</td>
                        <td class='text-right'>${u.enrollNumber || "No asignado"}</td>
                    </tr>
                `);
            });
            $("#modal table tbody").html(tbody.join(""));
        }
        
        //evento de filtrado
        $("#modal #buscar").on("input", filtrarUsuarios);
        filtrarUsuarios();
    }
    async sincronizar(sincroInteligente=true, limpiarRegistros=true){
        if(!this.conectado) return this.escribirLog("No hay conexión con el molinete", "danger");
        
        this.escribirLog(`Sincronizando molinete (modo: ${sincroInteligente ? "inteligente" : "completo"})...`, "info");
        let t0 = performance.now();
        
        //1- Obtengo los datos del molinete
        let tObtenerLogs0 = performance.now();
        let logs = await this.ejecutar("obtener-logs-molinete");
        if(typeof logs == "string") logs = JSON.parse(logs);
        let tObtenerLogs1 = performance.now();

        //3- Obtengo los ultimos registros en mi BD
        let tPasesBD0 = performance.now();
        let hace20Dias = new Date();
        hace20Dias.setDate(hace20Dias.getDate() - 20);
        let misRegistros = await window.electronAPI.executeQuery(`SELECT * FROM pase WHERE fecha >= ?`, [hace20Dias.toISOString().slice(0, 10)]);
        let tPasesBD1 = performance.now();

        //4- Obtengo los usuarios locales
        let tUsuariosLocales0 = performance.now();
        let usuariosLocales = await window.electronAPI.executeQuery(`SELECT * FROM usuario WHERE eliminado != 1`);
        let objUsuariosLocales = {};
        usuariosLocales.forEach(u=>{
            objUsuariosLocales[u.enrollNumber] = u;
        });
        let tUsuariosLocales1 = performance.now();

        //5- Guardo en mi BD los registros que no existan
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

                await window.electronAPI.executeQuery(q, [
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

        //5- Vuelvo a obtener los registros de mi BD para contabilizar los pases por usuario
        let tSincroUsuarioPaseTurno0 = performance.now();
        let ultimosRegistros = await window.electronAPI.executeQuery(`SELECT * FROM pase WHERE fecha >= ?`, [hace20Dias.toISOString().slice(0, 10)]);

        //6- Asigno pases a usuarios
        ultimosRegistros.forEach(r=>{
            let usuarioLocal = objUsuariosLocales[r.enrollNumber];
            if(!usuarioLocal) return; // no existe en mi BD local
            if(!usuarioLocal.regPases) usuarioLocal.regPases = [];
            usuarioLocal.regPases.push(r);
        });

        //7- Asigno a cada usuario si tiene activo el pase a fierros (order by id desc)
        let regTurnos = await window.electronAPI.executeQuery(`SELECT * FROM turno WHERE disciplinaId = -1 AND cancelado = 0 AND eliminado = 0 AND desde <= ? AND hasta >= ? ORDER BY id DESC`, [new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)]);
        
        //8- Contabilizo pases verificando intervalo y asigno a cada usuario la cantidad de pases que tiene
        for(let usuario of objUsuariosLocales){
            usuario.cantPases = utils.verificarCantidadPasadas(usuario.regPases || []);
            usuario.dias = regTurnos.find(t=> t.usuarioId == usuario.id)?.dias || 0;
        }
        let tSincroUsuarioPaseTurno1 = performance.now();

        //8- Ejecuto acciones de acuerdo a la cantidad de pases
        let tEjecutarAcciones0 = performance.now();
        for(let usuario of this.usuariosMolinete){
            let usuarioLocal = objUsuariosLocales[usuario.enrollNumber];
            if(!usuarioLocal) continue; // no existe en mi BD local

            if(sincroInteligente){
                let permitido = (usuarioLocal.dias < usuarioLocal.cantPases);
                if(permitido && !usuarioLocal.paseActivo){
                    await this.ejecutar("habilitar-usuario-molinete", { enrollNumber: usuario.enrollNumber });
                    await window.electronAPI.executeQuery(`UPDATE usuario SET paseActivo = 1 WHERE id = ?`, [usuarioLocal.id]);
                } 
                else if(!permitido && usuarioLocal.paseActivo) {
                    await this.ejecutar("deshabilitar-usuario-molinete", { enrollNumber: usuario.enrollNumber });
                    await window.electronAPI.executeQuery(`UPDATE usuario SET paseActivo = 0 WHERE id = ?`, [usuarioLocal.id]);
                }
            }else{
                if(usuarioLocal.dias < usuarioLocal.cantPases){
                    await this.ejecutar("habilitar-usuario-molinete", { enrollNumber: usuario.enrollNumber });
                    await window.electronAPI.executeQuery(`UPDATE usuario SET paseActivo = 1 WHERE id = ?`, [usuarioLocal.id]);
                }else{
                    await this.ejecutar("deshabilitar-usuario-molinete", { enrollNumber: usuario.enrollNumber });
                    await window.electronAPI.executeQuery(`UPDATE usuario SET paseActivo = 0 WHERE id = ?`, [usuarioLocal.id]);
                }
            }
        }
        let tEjecutarAcciones1 = performance.now();


        //9- Borro los registros pasados del molinete
        if(limpiarRegistros){
            let tBorrarLogs0 = performance.now();
            let resp = await this.ejecutar("borrar-logs-pasadas");
            this.escribirLog(`Pasadas borradas del molinete`, "info");
            let tBorrarLogs1 = performance.now();
            console.log("tiempos borrar logs " + (tBorrarLogs1 - tBorrarLogs0).toFixed(2) + " ms");
        }

        console.log("tiempos", {
            tObtenerLogs: (tObtenerLogs1 - tObtenerLogs0).toFixed(2),
            tPasesBD: (tPasesBD1 - tPasesBD0).toFixed(2),
            tUsuariosLocales: (tUsuariosLocales1 - tUsuariosLocales0).toFixed(2),
            tRegistrarPases: (tRegistrarPases1 - tRegistrarPases0).toFixed(2),
            tSincroUsuarioPaseTurno: (tSincroUsuarioPaseTurno1 - tSincroUsuarioPaseTurno0).toFixed(2),
            tEjecutarAcciones: (tEjecutarAcciones1 - tEjecutarAcciones0).toFixed(2),
            tTotal: (performance.now() - t0).toFixed(2)
        });
        this.escribirLog(`Sincronización finalizada en ${(performance.now() - t0).toFixed(2)} ms`, "success");
    }
    escribirLog(mensaje, color="black"){
        let day = new Date().toLocaleDateString();
        let time = new Date().toLocaleTimeString();
        $("#consola").append(`<div class='text-${color}'>${day} ${time} # ${mensaje}</div>`);
        $("#consola").scrollTop($("#consola")[0].scrollHeight); //auto-scroll al final de la consola
    }
    async ejecutar(accion, data = {}){
        let t0 = performance.now();
        try{
            let fd = new FormData();
            fd.append("accion", accion);
            for(let key in data){
                fd.append(key, data[key]);
            }

            let resp = await $.post({
                url: "http://localhost:9000/ejecutar",
                data: fd,
                processData: false,
                cache: false
            })
            console.log("resp:", resp);
            return resp;
        }catch(e){
            this.escribirLog("Error al ejecutar acción: " + e.message, "danger");
            return false;
        }finally{
            let t1 = performance.now();
            console.log(`Acción "${accion}" ejecutada en ${(t1 - t0).toFixed(2)} ms`);
        }
    }
}
