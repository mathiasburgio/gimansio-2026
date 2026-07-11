class Molinete{
    constructor(){
        this.conectado = null;
        this.usuariosMolinete = [];
        this.init();
    }
    async init(){
        $("#reconectar").on("click", async ev => {
            let ele = $(ev.currentTarget);
            ele.prop("disabled", true);
            await this.reconectarMolinete();
            ele.prop("disabled", false);
        });
        
        $("#permitir-paso").on("click", async () => {
            if(!this.conectado) return modal.message("No hay conexión con el molinete");
            await modal.waiting("Habilitando pase...");
            await this.habilitarPase();
            modal.hide();
        });

        $("#ver-usuarios-molinete").on("click", (ev) => {
            if(!this.conectado) return modal.message("No hay conexión con el molinete");
            this.listarUsuarios();
        });
        $("#sincronizar").on("click", async (ev) => {
            if(!this.conectado) return modal.message("No hay conexión con el molinete");
            let inteligente = (ev.shiftKey);
            await this.sincronizar(inteligente);
        });

        //recibe respuestas del SDK del molinete
        window.electronAPI.onEventoSDK((msj) => {
            console.log(msj);
            this.escribirConsola(msj.body);
        });
        
        //obtengo los registros de la consola del molinete
        const registrosConsola = await window.electronAPI.getConsolaMolinete();
        this.escribirConsola(registrosConsola, true);

        //verifico estado de conexion
        this.verificarEstadoMolinete();
    }
    async verificarEstadoMolinete(){
        const statusMolinete = await window.electronAPI.statusMolinete();
        if(statusMolinete?.status){
            $("#reconectar").addClass("btn-success").removeClass("btn-danger").text("Estado: Conectado");
            this.conectado = true;
        }else{
            $("#reconectar").addClass("btn-danger").removeClass("btn-success").text("Estado: Desconectado");
            this.conectado = false;
        }
    }
    async reconectarMolinete(){
        let confirm = await modal.yesno("¿Desea forzar una reconexión con el molinete?");
        if(!confirm) return;

        await modal.waiting("Reconectando molinete...");
        let resp = await window.electronAPI.conectarMolinete();
        console.log(resp);
        modal.hide(false);
    }
    async habilitarPase(ms=3000){
        let resp = await window.electronAPI.habilitarPasoMolinete(ms);
        console.log(resp);
    }
    async sincronizar(full=false){
        let confirm = await modal.yesno("La información se sincroniza automaticamente cada 1 hora. ¿Desea sincronizar los usuarios del molinete con la base de datos local?");
        if(!confirm) return;
        await modal.waiting("Sincronizando usuarios -> turnos(fierros/musculación) -> molinete...");
        let resp = await window.electronAPI.sincronizarMolinete(full, false);
        console.log(resp);
        modal.hide(false);
    }
    escribirConsola(msj="", full=false){
        if(full) $("#consola").html("");
        if(Array.isArray(msj)) return msj.forEach(m=> this.escribirConsola(m));
        else{
            const aux = msj.split("#");
            const fechaHora = aux[0];
            const texto = aux.slice(1).join(" ");

            $("#consola").append(`<div class=''><b>${fechaHora}</b> ${texto}</div>`);
        }
        $("#consola").scrollTop($("#consola")[0].scrollHeight); //auto-scroll al final de la consola
    }
    async ejecutar(comando, params){
        try{
            const resp = await window.electronAPI.ejecutarMolinete(comando, params);
            console.log(resp);
            return resp;
        }catch(e){
            console.error("Error al ejecutar acción en molinete:", e);
        }
    }
    async listarUsuarios(){
        let usuarios = await window.electronAPI.obtenerUsuariosMolinete();
        console.log(usuarios);
        modal.show({
            title: "Usuarios del molinete",
            body: $("#modal-usuarios-molinete").html(),
            buttons: "back"
        });

        const filtrar = () => {
            const palabra = $("#modal #buscar").val().toLowerCase().trim();
            const tbody = [];
            
            $("#modal table tbody").html("");
            usuarios
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

        $("#modal #buscar").on("input", filtrar);
        filtrar();
    }
}
