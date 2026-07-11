class Disciplinas {
    constructor() {
        this.disciplinas = [];
        this.disciplinaSeleccionada = null;
        this.esNuevo = null;
        this.init();
    }
    async init() {

        this.disciplinas = await window.electronAPI.executeQuery("SELECT * FROM disciplina WHERE eliminado = 0");
        this.buscar();

        // Inicialización de la clase
        $("#nuevo").on("click", () => {
            this.nuevo();
        });
        $("#modificar").on("click", () => {
            if(!this.disciplinaSeleccionada) return modal.message("Seleccione una disciplina para modificar");
            this.modificar();
        });
        $("#eliminar").on("click", () => {
            if(!this.disciplinaSeleccionada) return modal.message("Seleccione una disciplina para eliminar");
            this.eliminar();
        });
        $("#buscar").on("input", () => {
            this.buscar();
        });
        $("#guardar").on("click", () => {
            if(this.esNuevo === false && !this.disciplinaSeleccionada) return modal.message("Seleccione una accion (nuevo/modificar) para poder guardar los datos");
            this.guardar();
        });
    }
    nuevo(){
        $("#accion").html("Nuevo");
        $("#datos input, #datos select").val("");
        $("table:eq(0) tbody tr").removeClass("table-primary");
        this.disciplinaSeleccionada = null;
        this.esNuevo = true;
    }
    modificar(){
        $("#accion").html(`Modificar: ${this.disciplinaSeleccionada ? this.disciplinaSeleccionada.nombre : ""}`);
        this.esNuevo = false;
    }
    async eliminar(){
        let resp = await modal.yesno("¿Está seguro que desea eliminar la disciplina seleccionada?");
        if(!resp) return;
        try{
            let resp = await window.electronAPI.executeQuery("UPDATE disciplina SET eliminado=1 WHERE id = ?", [this.disciplinaSeleccionada.id]);
            await modal.message("Disciplina eliminada correctamente");
            this.disciplinas = this.disciplinas.filter(d=>d.id !== this.disciplinaSeleccionada.id);
            this.disciplinaSeleccionada = null;
            this.esNuevo = null;
            $("#accion").html("");
            this.buscar(true);
        }catch(err){
            await modal.message(err?.responseText || err.toString());
        }
    }
    buscar(){
        let tbody = [];
        this.disciplinas
        .forEach(disciplina=>{
            if(tbody.length < 200){
                tbody.push(`
                    <tr data-id="${disciplina.id}">
                        <td>${disciplina.nombre}</td>
                        <td class='text-right'>${disciplina.habilitado ? "Sí" : "No"}</td>
                    </tr>
                `);
            }
        });
        $("table:eq(0) tbody").html(tbody.join(""));

        $("table:eq(0) tbody tr").on("click", ev=>{
            let id = $(ev.currentTarget).data("id");
            this.disciplinaSeleccionada = this.disciplinas.find(d=>d.id == id);
            $("table:eq(0) tbody tr").removeClass("table-primary");
            $(ev.currentTarget).addClass("table-primary");
            $("#datos input, #datos select").val("");
            for(let prop in this.disciplinaSeleccionada){
                $(`#${prop}`).val(this.disciplinaSeleccionada[prop]);
            }

            if(typeof this.disciplinaSeleccionada.diasHorarios === "string") this.disciplinaSeleccionada.diasHorarios = JSON.parse(this.disciplinaSeleccionada.diasHorarios);
            this.disciplinaSeleccionada.diasHorarios.forEach((dh, iDia)=>{
                dh.forEach((reg, iHora)=>{
                    $("table:eq(1) tbody tr:eq(" + iDia + ") input:eq(" + iHora + ")").val(reg);
                });
            });
            this.modificar();
        });
    }
    async guardar(){
        let data = {
            nombre: $("#nombre").val(),
            habilitado: utils.getBoolean($("#habilitado").val()),
            precio: parseInt($("#precio").val()) || 0,
            diasHorarios: []
        };

        if(!data.nombre) return modal.message("El nombre es obligatorio");
        //if(!data.precio) return modal.message("El precio es obligatorio");

        $("table:eq(1) tbody tr").each((iDia, tr)=>{
            data.diasHorarios.push([]);
            $(tr).find("input").each((iHora, input)=>{
                let v = $(input).val();
                if(v) data.diasHorarios[iDia].push(v);
            });
        });

        try{
            if(this.esNuevo){
                let resp = await window.electronAPI.executeQuery(
                    `INSERT INTO disciplina SET nombre = ?, 
                        habilitado = ?, 
                        precio = ?, 
                        diasHorarios = ?, 
                        eliminado = 0, 
                        createdAt = NOW()`,
                    [data.nombre, data.habilitado, data.precio, JSON.stringify(data.diasHorarios)]
                );
                console.log(resp)
                let nuevo = await window.electronAPI.executeQuery("SELECT * FROM disciplina WHERE id = ?", [resp.insertId]);
                console.log(nuevo)
                this.disciplinas.push(nuevo[0]);
                modal.message("Disciplina creada correctamente");
            }else{
                let resp = await window.electronAPI.executeQuery(
                    `UPDATE disciplina SET nombre = ?, 
                        habilitado = ?, 
                        precio = ?, 
                        diasHorarios = ? 
                    WHERE id = ?`,
                    [data.nombre, data.habilitado, data.precio, JSON.stringify(data.diasHorarios), this.disciplinaSeleccionada.id]
                );
                console.log(resp)
                let modificado = await window.electronAPI.executeQuery("SELECT * FROM disciplina WHERE id = ?", [this.disciplinaSeleccionada.id]);
                console.log(modificado)
                let index = this.disciplinas.findIndex(u=>u.id == this.disciplinaSeleccionada.id);
                if(index !== -1) this.disciplinas[index] = modificado[0];
                modal.message("Disciplina modificada correctamente");
            }

            this.esNuevo = null;
            this.disciplinaSeleccionada = null;
            $("#accion").html("");
            $("#datos input, #datos select").val("");
            $("table:eq(1) tbody tr input").val("");
            this.buscar(true);
        }catch(err){
            modal.message(err?.responseText || err.toString());
        }
    }
}