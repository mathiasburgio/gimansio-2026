class Usuarios {
    constructor() {
        this.usuarios = [];
        this.usuarioSeleccionado = null;
        this.esNuevo = null;
        this.init();
    }

    async init() {
        this.usuarioLogeado = await window.electronAPI.getUsuarioLogeado();
        console.log(this.usuarioLogeado);
        this.usuarios = await window.electronAPI.executeQuery("SELECT * FROM usuario WHERE eliminado = 0");
        this.buscar();

        // Inicialización de la clase
        $("#nuevo").on("click", () => {
            this.nuevo();
        });
        $("#modificar").on("click", () => {
            if(!this.usuarioSeleccionado) return modal.message("Seleccione un usuario para modificar");
            this.modificar();
        });
        $("#eliminar").on("click", () => {
            if(!this.usuarioSeleccionado) return modal.message("Seleccione un usuario para eliminar");
            this.eliminar();
        });
        $("#buscar").on("input", () => {
            this.buscar();
        });
        $("#guardar").on("click", () => {
            if(this.esNuevo === false && !this.usuarioSeleccionado) return modal.message("Seleccione una accion (nuevo/modificar) para poder guardar los datos");
            this.guardar();
        });

        //backdoor para editar contraseña facilmente
        $("#contrasena").on("click", ev => {
            if(ev.shiftKey) $("#contrasena").prop("readonly", false);
        });
    }
    nuevo(){
        $("#accion").html("Nuevo");
        $("#datos input, #datos select").val("");
        $("#usuarios tbody tr").removeClass("table-primary");
        $("#contrasena").prop("readonly", false);
        this.usuarioSeleccionado = null;
        this.esNuevo = true;
    }
    modificar(){
        $("#accion").html(`Modificar: ${this.usuarioSeleccionado ? this.usuarioSeleccionado.nombre : ""}`);
        this.esNuevo = false;
    }
    async eliminar(){
        let resp = await modal.yesno("¿Está seguro que desea eliminar el usuario seleccionado?");
        if(!resp) return;
        try{
            let resp = await window.electronAPI.executeQuery("UPDATE usuario SET eliminado=1 WHERE id = ?", [this.usuarioSeleccionado.id]);
            modal.message("Usuario eliminado correctamente");
            this.usuarios = this.usuarios.filter(u=>u.id !== this.usuarioSeleccionado.id);
            this.usuarioSeleccionado = null;
            this.esNuevo = null;
            $("#accion").html("");
            this.buscar(true);
        }catch(err){
            modal.message(err?.responseText || err.toString());
        }
    }
    buscar(forzarVacio=false){
        if(forzarVacio) $("#buscar").val("");
        let busqueda = $("#buscar").val().toLowerCase();
        
        
        let tbody = [];
        this.usuarios
        .filter(usuario=>{
            if(
                busqueda === "" || 
                usuario?.nombre?.toString().toLowerCase().includes(busqueda) || 
                usuario?.email?.toString().toLowerCase().includes(busqueda) ||
                usuario?.dni?.toString().toLowerCase().includes(busqueda)
            )return true;
            else return false;
        })
        .forEach(usuario=>{
            if(tbody.length < 200){
                tbody.push(`
                    <tr data-id="${usuario.id}">
                        <td>${usuario.nombre}</td>
                        <td>${usuario.email}</td>
                        <td class='text-right'>${usuario.enrollNumber || ""}</td>
                    </tr>
                `);
            }
        });
        $("table tbody").html(tbody.join(""));

        $("table tbody tr").on("click", async ev=>{
            let id = $(ev.currentTarget).data("id");
            this.usuarioSeleccionado = this.usuarios.find(u=>u.id == id);
            $("table tbody tr").removeClass("table-primary");
            $(ev.currentTarget).addClass("table-primary");
            for(let prop in this.usuarioSeleccionado){
                $(`#${prop}`).val(this.usuarioSeleccionado[prop]);
            }
            this.modificar();
            if(this.usuarioLogeado.email == this.usuarioSeleccionado.email){
                $("#contrasena").prop("readonly", false);
            }else{
                $("#contrasena").prop("readonly", true);
            }
        });
    }
    async guardar(){
        let data = {
            nombre: $("#nombre").val(),
            email: $("#email").val(),
            contrasena: $("#contrasena").val(),
            direccion: $("#direccion").val(),
            telefono: $("#telefono").val(),
            dni: $("#dni").val(),
            enrollNumber: $("#enrollNumber").val(),
            esAdmin: utils.getBoolean($("#esAdmin").val()),
            esProfe: utils.getBoolean($("#esProfe").val()),
            paseLibre: utils.getBoolean($("#paseLibre").val()),
        };

        if(!data.nombre) return modal.message("El nombre es obligatorio");
        if(!data.email && data.esAdmin === 1) return modal.message("El email es obligatorio para administradores");
        if(!data.contrasena && data.esAdmin === 1) return modal.message("La contraseña es obligatoria para administradores");

        try{
            if(this.esNuevo){
                let resp = await window.electronAPI.executeQuery(
                    `INSERT INTO usuario SET 
                        nombre = ?, 
                        email = ?, 
                        contrasena = ?, 
                        direccion = ?, 
                        telefono = ?, 
                        dni = ?, 
                        enrollNumber = ?, 
                        esAdmin = ?, 
                        esProfe = ?, 
                        paseLibre = ?, 
                        eliminado = 0,
                        createdAt= NOW()`,
                    [data.nombre, data.email, data.contrasena, data.direccion, data.telefono, data.dni, data?.enrollNumber || 0, data.esAdmin, data.esProfe, data.paseLibre]
                );
                console.log(resp)
                let nuevo = await window.electronAPI.executeQuery("SELECT * FROM usuario WHERE id = ?", [resp.insertId]);
                console.log(nuevo)
                this.usuarios.push(nuevo[0]);
                modal.message("Usuario creado correctamente");
            }else{
                let resp = await window.electronAPI.executeQuery(
                    `UPDATE usuario SET 
                        nombre = ?, 
                        email = ?, 
                        contrasena = ?, 
                        direccion = ?, 
                        telefono = ?, 
                        dni = ?, 
                        enrollNumber = ?, 
                        esAdmin = ?, 
                        esProfe = ?, 
                        paseLibre = ? 
                    WHERE id = ?`,
                    [data.nombre, data.email, data.contrasena, data.direccion, data.telefono, data.dni, data.enrollNumber, data.esAdmin, data.esProfe, data.paseLibre, this.usuarioSeleccionado.id]
                );
                console.log(resp)
                let modificado = await window.electronAPI.executeQuery("SELECT * FROM usuario WHERE id = ?", [this.usuarioSeleccionado.id]);
                console.log(modificado)
                let index = this.usuarios.findIndex(u=>u.id == this.usuarioSeleccionado.id);
                if(index !== -1) this.usuarios[index] = modificado[0];
                modal.message("Usuario modificado correctamente");
            }

            this.esNuevo = null;
            this.usuarioSeleccionado = null;
            $("#accion").html("");
            $("#datos input, #datos select").val("");
            this.buscar(true);
        }catch(err){
            modal.message(err?.responseText || err.toString());
        }
    }
}