class Turnos {
    constructor() {
        this.usuarios = [];
        this.usuarioSeleccionado = null;
        this.disciplinas = [];
        this.disciplinaSeleccionada = null; //{id, nombre} //fierros usa id -1
        this.accion = null;
        this.ultimoTurno = null; //aqui almaceno si tengo el yutlimo turno para cobrar/cancelar
        this.init();
    }

    async init() {

        this.usuarios = await window.electronAPI.executeQuery("SELECT * FROM usuario WHERE eliminado = 0");
        await this.verificarPasesDisponibles();

        this.disciplinas = await window.electronAPI.executeQuery("SELECT * FROM disciplina WHERE eliminado = 0 AND habilitado = 1");
        this.disciplinas.splice(0, 0, { id: -1, nombre: "fierros", diasHorarios: "[[], [], [], [], [], [], []]" }); //agrego fierros al principio
        this.disciplinas.forEach(d=>{
            d.diasHorarios = JSON.parse(d.diasHorarios);
            $("#disciplina").append(`<option value="${d.id}">${d.nombre}</option>`);
        });

        $("#buscar").on("input", () => {
            this.buscarUsuario();
        });
        $("#ver-historial").on("click", () => {
            if(!this.usuarioSeleccionado) return modal.message("Seleccione un usuario para ver su historial");
            this.verHistorial();
        });
        $("#ver-asistentes").on("click", () => {
            //if(!this.disciplinaSeleccionada) return modal.message("Seleccione una disciplina para ver sus asistentes");
            this.verAsistentes();
        });
        $("#disciplina").on("change", ev=>{
            let id = Number($(ev.currentTarget).val());
            this.disciplinaSeleccionada = this.disciplinas.find(d=>d.id == id);
            this.limpiar();
        }).change(); //ejecuto inmediatamente

        $("#ultimo-turno").on("click", () => {
            if(!this.usuarioSeleccionado) return modal.message("Seleccione un usuario para ver su último turno");
            this.setUltimoTurno();
        });
        $("#nuevo-turno").on("click", () => {
            if(!this.usuarioSeleccionado) return modal.message("Seleccione un usuario para ver su último turno");
            this.setTurnoNuevo();
        });
        $("#guardar-turno").on("click", () => {
            this.guardar();
        });
        $("#cancelar").on("click", async () => {
            if(this.ultimoTurno === null) return modal.message("No hay un turno seleccionado para cancelar");
            if(utils.getBoolean(this.ultimoTurno.cancelado)) return modal.message("El turno ya se encuentra cancelado");

            let resp = await modal.yesno("¿Está seguro que desea cancelar este turno?");
            if(!resp) return;
            try{
                let q = `UPDATE turno SET cancelado = 1 WHERE id = ?`;
                let p = [this.ultimoTurno.id];
                let resultado = await window.electronAPI.executeQuery(q, p);
                console.log(resultado);
                modal.message("Turno cancelado correctamente");
                this.limpiar();
            }catch(err){
                console.error(err);
                modal.message("Ocurrió un error al cancelar el turno");
            }
        });

        $("#cobrar").on("click", () => {
            if(this.ultimoTurno === null) return modal.message("No hay un turno seleccionado para cobrar");
            this.modalCobrar(this.ultimoTurno.id);
        });

        $("#desde").change(ev=>{
            let desde = new Date($(ev.currentTarget).val());
            let proximoMes = new Date(desde.getFullYear(), desde.getMonth() + 1, desde.getDate());
            $("#hasta").val(proximoMes.toISOString().split("T")[0]);
        })

        $("#bt-historial-molinete").on("click", () => {
            if(!this.usuarioSeleccionado) return modal.message("Seleccione un usuario para ver su historial de pases en el molinete");
            this.modalPasadas(this.usuarioSeleccionado.id);
        });

        /* $("#guardar").on("click", () => {
            if(this.esNuevo === false && !this.turnoSeleccionado) return modal.message("Seleccione una accion (nuevo/modificar) para poder guardar los datos");
            this.guardar();
        }); */
        this.limpiar();
    }
    buscarUsuario(forzarVacio=false){
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
                let pases = "-";
                if(utils.getBoolean(usuario.paseLibre)) pases = "Libre";
                else{
                    if(usuario.pasesDisponibles > 0) pases = "?/" + usuario.pasesDisponibles;
                }

                tbody.push(`
                    <tr data-id="${usuario.id}">
                        <td>${usuario.nombre}</td>
                        <td class="text-right">${usuario.enrollNumber || ""}</td>
                        <td class="text-right ${utils.getBoolean(usuario.paseHabilitado) ? "table-success" : "table-danger"}">${pases}</td>
                    </tr>
                `);
            }
        });
        $("table:eq(0) tbody").html(tbody.join(""));

        $("table:eq(0) tbody tr").on("click", ev=>{
            let id = $(ev.currentTarget).data("id");
            this.usuarioSeleccionado = this.usuarios.find(u=>u.id == id);
            this.limpiar();
            $("table:eq(0) tbody tr").removeClass("table-primary");
            $(ev.currentTarget).addClass("table-primary");
            $("#usuario").val(this.usuarioSeleccionado.nombre);
            this.verificarDisciplinasConTurnos();
        }).on("dblclick", ev=>{
            let id = $(ev.currentTarget).data("id");
            this.usuarioSeleccionado = this.usuarios.find(u=>u.id == id);
            this.modalPasadas();
        });
    }
    async verHistorial(){
        let registros = await window.electronAPI.executeQuery("SELECT * FROM turno WHERE usuarioId = ? AND eliminado = 0 ORDER BY id DESC LIMIT 100", [this.usuarioSeleccionado.id]);
    
        modal.show({
            title: "Historial de turnos",
            body: $("#modal-historial").html(),
            size: "lg",
            buttons:"back"
        });
        $("#modal table tbody").html("");
        
        //obtengo la fecha sin hora para comparar
        let hoy = new Date();
        hoy = hoy.toISOString().split("T")[0];

        let tbody = [];
        registros.forEach(registro=>{
            let _desde = new Date(registro.desde).toISOString().split("T")[0];
            let _hasta = new Date(registro.hasta).toISOString().split("T")[0];
            let activo = (_desde <= hoy && _hasta >= hoy) ? true : false;
            if(utils.getBoolean(registro.cancelado) == true) activo = false;

            tbody.push(`
                <tr data-id="${registro.id}">
                    <td>${registro.disciplinaNombre}</td>
                    <td>${utils.invertirFecha(_desde)}</td>
                    <td>${utils.invertirFecha(_hasta)}</td>
                    <td class="${!utils.getBoolean(registro.cobrado) ? "table-hover-primary cp" : ""}">${utils.getBoolean(registro.cobrado) ? "Sí" : "No"}</td>
                    <td class="${!utils.getBoolean(registro.cancelado) ? "table-hover-danger cp" : ""}">${utils.getBoolean(registro.cancelado) ? "Sí" : "No"}</td>
                </tr>
            `);
        });
        $("#modal table tbody").html(tbody.join(""));

        //no cobrado
        $("#modal table tbody .table-hover-primary").on("click", ev=>{
            let tr = $(ev.currentTarget).closest("tr");
            let turnoId = tr.data("id");
            let turno = registros.find(r=>r.id == turnoId);
            modal.hide(false, ()=>{
                this.modalCobrar(turnoId);
            })
        });

        //no cancelado
        $("#modal table tbody .table-hover-danger").on("click", async ev=>{
            let td = $(ev.currentTarget);
            let tr = $(ev.currentTarget).closest("tr");
            let turnoId = tr.data("id");
            let turno = registros.find(r=>r.id == turnoId);
            let resp = await modal.addPopover({querySelector: td, type: "yesno", message: "¿Está seguro que desea cancelar este turno?"});
            if(!resp) return;
            let r = await window.electronAPI.executeQuery("UPDATE turno SET cancelado = 1 WHERE id = ?", [turnoId]);
            turno.cancelado = 1;
            tr.find("td:eq(4)").html("Sí").removeClass("table-hover-danger cp");
        });
    }
    async verAsistentes(){

        modal.show({
            title: "Asistentes",
            body: $("#modal-asistentes").html(),
            size: "lg",
            buttons:"back"
        });
        $("#modal table tbody").html("");

        $("#modal #disciplina").val(this.disciplinaSeleccionada.nombre);

        let opt = `<option value="todos">todos</option>`;
        if(this.disciplinaSeleccionada.id != -1){
            let labelDia = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
            for(let i = 0; i < 7; i++){
                let horariosDia = this.disciplinaSeleccionada.diasHorarios[i];
                horariosDia.forEach(hora=>{
                    opt += `<option value="${i} ${hora}">${labelDia[i]} ${hora}</option>`;
                });
            }
        }
        $("#modal #horario").html(opt);

        let hoy = new Date();
        hoy = hoy.toISOString().split("T")[0];

        //verico posterimmente si esta "cancelado" (en el filtro)
        let q = `SELECT * from turno where disciplinaId = ? AND eliminado = 0 AND hasta >= ? ORDER BY id DESC LIMIT 1000`;
        let p = [this.disciplinaSeleccionada.id, hoy];
        let registros = await window.electronAPI.executeQuery(q, p);
        registros.forEach(registro=>{
            registro._desde = new Date(registro.desde).toISOString().split("T")[0];
            registro._hasta = new Date(registro.hasta).toISOString().split("T")[0];
            registro.diasHorarios = JSON.parse(registro.diasHorarios);
        });
        console.log(registros);
        const filtrar = (filtro="todos") => {   
            let tbody = [];
            registros
            .filter(registro=>{
                if(utils.getBoolean(registro.cancelado)) return false;
                let mostrar = false;
                if(filtro === "todos") mostrar = true;
                else{
                    let [fDia, fHora] = filtro.split(" ");
                    registro.diasHorarios.forEach((dh, iDia)=>{
                        if(Number(fDia) === iDia && dh.includes(fHora)) mostrar = true;
                    });
                }
                return mostrar;
            })
            .forEach((registro, ind)=>{
                let usuario = this.usuarios.find(u=>u.id == registro.usuarioId);
                tbody.push(`
                    <tr data-id="${registro.id}">
                        <td>${ind + 1}</td>
                        <td>${usuario?.nombre || "?"}</td>
                        <td>${utils.invertirFecha(registro._desde)}</td>
                        <td>${utils.invertirFecha(registro._hasta)}</td>
                        <td class="table-hover">${utils.getBoolean(registro.cobrado) ? "Sí" : "No"}</td>
                    </tr>
                `);
            });
            $("#modal table tbody").html(tbody.join(""));
        }

        $("#modal #horario").on("change", ev=>{
            let val = $(ev.currentTarget).val();
            filtrar(val);
        }).change();//ejecuto inmediatamente
        
    }
    async setUltimoTurno(){
        this.limpiar();
        $("#ultimo-turno").addClass("btn-primary").removeClass("btn-light");
        $("#nuevo-turno").addClass("btn-light").removeClass("btn-primary");
        $("#desde").prop("disabled", true);
        $("#hasta").prop("disabled", true);
        $("#dias").prop("disabled", true);
        $("#guardar-turno").prop("disabled", true);

        this.accion = "ultimo";
        let registro = await window.electronAPI.executeQuery("SELECT * FROM turno WHERE usuarioId = ? AND disciplinaId = ? AND eliminado = 0 ORDER BY id DESC LIMIT 1", [this.usuarioSeleccionado.id, this.disciplinaSeleccionada.id]);
        if(registro.length === 1){
            let turno = registro[0];
            $("#desde").val(new Date(turno.desde).toISOString().split("T")[0]);
            $("#hasta").val(new Date(turno.hasta).toISOString().split("T")[0]);
            $("#cobrado").val(utils.getBoolean(turno.cobrado) ? "Sí" : "No");
            $("#cancelado").val(utils.getBoolean(turno.cancelado) ? "Sí" : "No");
            $("#dias").val(turno.dias);
            if(utils.getBoolean(turno.cancelado) == true){
                $("#cancelar").attr("disabled", true);
            }else{
                $("#cancelar").attr("disabled", false);
            }
            if(utils.getBoolean(turno.cobrado) == true){
                $("#cobrar").attr("disabled", true);
            }else{
                $("#cobrar").attr("disabled", false);
            }
            this.ultimoTurno = turno;
            if(this.disciplinaSeleccionada.id > -1){ 
                this.listarHorarios(turno.diasHorarios);
                $("#tabla-horarios").removeClass("d-none");
            }else{
                $("#tabla-horarios").addClass("d-none");
            }
            $("#campos").removeClass("d-none");
        }else{
            modal.message("No se encontró un turno previo para este usuario y disciplina");
            this.limpiar();
            $("#campos").addClass("d-none");
        }
    }
    setTurnoNuevo(){
        $("#ultimo-turno").addClass("btn-light").removeClass("btn-primary");
        $("#nuevo-turno").addClass("btn-primary").removeClass("btn-light");
        this.accion = "nuevo";
        
        $("#desde").prop("disabled", false);
        $("#hasta").prop("disabled", false);
        
        $("#guardar-turno").attr("disabled", false);
        $("#cancelar").attr("disabled", true);
        $("#cobrar").attr("disabled", true);

        $("#cobrado").val("No");
        $("#cancelado").val("No");
        $("#dias").val("");
        $("#campos").removeClass("d-none");
        if(this.disciplinaSeleccionada.id === -1){ 
            $("#tabla-horarios").addClass("d-none");
            $("#dias").prop("disabled", false);
        }else{
            $("#tabla-horarios").removeClass("d-none");
            this.listarHorarios(this.disciplinaSeleccionada.diasHorarios);
            $("#dias").prop("disabled", true);
        }
    }
    limpiar(){
        if( this.disciplinaSeleccionada.diasHorarios) this.listarHorarios(this.disciplinaSeleccionada.diasHorarios); //para limpiar selecciones previaas
        $("#campos").addClass("d-none");
        $("#ultimo-turno").addClass("btn-light").removeClass("btn-primary");
        $("#nuevo-turno").addClass("btn-light").removeClass("btn-primary");
        this.accion = null;
        this.ultimoTurno = null;

        if(this.disciplinaSeleccionada.id === -1){
            $("#bt-historial-molinete").removeClass("d-none");
        }else{
            $("#bt-historial-molinete").addClass("d-none");
        }


        let hoy = new Date();
        let anioMesDia = hoy.toISOString().split("T")[0];
        $("#desde").val(anioMesDia);
        let proximoMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate());
        $("#hasta").val(proximoMes.toISOString().split("T")[0]);
        
        $("#cobrado").val("No");
        $("#cancelado").val("No");

        $("#dias").val("");

        $("#cobrar").attr("disabled", true);
        $("#cancelar").attr("disabled", true);
        $("#guardar-turno").attr("disabled", true);
    }
    listarHorarios(diasHorarios){
        if(this.disciplinaSeleccionada.id === -1) return
        if(typeof diasHorarios === "string") diasHorarios = JSON.parse(diasHorarios);
        /*if(!this.disciplinaSeleccionada.diasHorarios) return modal.message("No se encontraron horarios para la disciplina seleccionada");
        if(typeof this.disciplinaSeleccionada.diasHorarios === "string"){
            this.disciplinaSeleccionada.diasHorarios = JSON.parse(this.disciplinaSeleccionada.diasHorarios);
        } */

        const maxHorarios = Math.max(
            ...diasHorarios.map(dh => dh.length)
        );

        let dLabel = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

        let tbody = "";
        diasHorarios.forEach((dh, iDia)=>{
            tbody += `<tr><td class='font-weight-bold'>${dLabel[iDia]}</td>`;
            for (let iHora = 0; iHora < maxHorarios; iHora++) {
                const reg = dh[iHora] ?? "";
                tbody += `<td class='text-center' dia="${iDia}" hora="${reg}" valido=${reg ? "true" : "false"}>${reg}</td>`;
            }
            tbody += `</tr>`;
        });
        $("#tabla-horarios tbody").html(tbody);
        $("#tabla-horarios [valido='true']").on("click", ev=>{
            if(this.accion == "ultimo") return;

            let td = $(ev.currentTarget);
            td.toggleClass("table-primary");
            let c = $("#tabla-horarios .table-primary").length;
            $("#dias").val(c);
        });
    }
    async guardar(){
        try{
            let data = {
                usuarioNombre: this.usuarioSeleccionado?.nombre,
                usuariosId: this.usuarioSeleccionado?.id,
                
                disciplinaNombre: this.disciplinaSeleccionada?.nombre,
                disciplinaId: this.disciplinaSeleccionada?.id,

                desde: $("#desde").val(),
                hasta: $("#hasta").val(),
                dias: Number($("#dias").val()),
                diasHorarios: []
            };

            if(!data.desde) return modal.message("La fecha de inicio es obligatoria");
            if(!data.hasta) return modal.message("La fecha de fin es obligatoria");
            if(data.desde > data.hasta) return modal.message("La fecha de inicio no puede ser mayor a la fecha de fin");
            if(!data.dias || data.dias <= 0) return modal.message("Los <b>días</b> son obligatorios");

            if(data.disciplinaId === -1 && data.dias > 7) return modal.message("Para <b>fierros</b> el máximo de días es 7");
            if(data.disciplinaId === -1 && data.dias < 1) return modal.message("Para <b>fierros</b> el mínimo de días es 1");

            if(data.disciplinaId > -1){
                for(let i = 0; i < 7; i++){
                    data.diasHorarios.push([]);
                    let aux = data.diasHorarios[i];
                    $("#tabla-horarios tbody tr:eq(" + i + ") .table-primary").each((ind, tr)=>{
                        let dia = $(tr).attr("dia");
                        let hora = $(tr).attr("hora");
                        aux.push(hora);
                    });
                }
            }


            let resp = await modal.yesno("¿Está seguro que desea guardar este turno?");
            if(!resp) return;

            let q = `INSERT INTO turno SET
                usuarioNombre = ?,
                usuarioId = ?,
                
                disciplinaNombre = ?,
                disciplinaId = ?,
                
                desde = ?,
                hasta = ?,
                dias = ?,
                diasHorarios = ?,
                cobrado = 0,
                cancelado = 0,
                eliminado = 0,
                createdAt = NOW()`;
            let p = [
                data.usuarioNombre, 
                data.usuariosId, 
                data.disciplinaNombre, 
                data.disciplinaId, 
                data.desde, 
                data.hasta, 
                data.dias, 
                JSON.stringify(data.diasHorarios)
            ];
            let resultado = await window.electronAPI.executeQuery(q, p);
            console.log(resultado);
            modal.message("Turno guardado correctamente");
            await this.verificarPasesDisponibles();
            this.verificarDisciplinasConTurnos();
            this.limpiar();
            this.setUltimoTurno();
        }catch(err){
            console.error(err);
            modal.message("Ocurrió un error al guardar el turno");
        }
    }
    modalCobrar(turnoId){
        modal.show({
            title: "Cobrar turno",
            body: $("#modal-cobrar").html(),
            buttons: "back"
        });

        $("#modal #efectivo, #modal #transferencia").on("input", ev=>{
            let efectivo = Number($("#modal #efectivo").val());
            let transferencia = Number($("#modal #transferencia").val());
            $("#modal #total").val( "$" + utils.formatNumber(efectivo + transferencia));
        });

        $("#modal #registrar-cobro").on("click", async (ev) => {
            let ele = $(ev.currentTarget);
            let efectivo = Number($("#modal #efectivo").val());
            let transferencia = Number($("#modal #transferencia").val());
            let resp = await modal.addPopover({querySelector: ele, type: "yesno", message: `¿Está seguro que desea registrar el cobro de este turno por un total de $${utils.formatNumber(efectivo + transferencia)}?`});
            if(!resp) return;

            let usuarioLogeado = await window.electronAPI.getUsuarioLogeado();
            let turno = await window.electronAPI.executeQuery("SELECT * FROM turno WHERE id = ?", [turnoId]);
            let disciplina = this.disciplinas.find(d=>d.id == turno[0].disciplinaId);

            try{
                let q = `UPDATE turno SET cobrado = 1 WHERE id = ?`;
                let p = [turnoId];
                let resultado = await window.electronAPI.executeQuery(q, p);
                console.log(resultado);

                let q2 = `INSERT INTO cobroPago SET
                    accion = 'cobro',
                    monto = ?,
                    detalle = ?,
                    turnoId = ?,
                    disciplinaNombre = ?,
                    usuarioCobrador= ?,
                    usuarioAbonador= ?,
                    usuarioCobradorId= ?,
                    usuarioAbonadorId= ?,
                    multicaja= ?,
                    createdAt = NOW()`;
                let p2 = [
                    (efectivo + transferencia),
                    'Cobro de turno ' + disciplina.nombre,
                    turnoId,
                    disciplina.nombre,
                    usuarioLogeado.nombre,
                    this.usuarioSeleccionado.nombre,
                    usuarioLogeado.id,
                    this.usuarioSeleccionado.id,
                    JSON.stringify({efectivo, transferencia})
                ];
                let resultado2 = await window.electronAPI.executeQuery(q2, p2);
                console.log(resultado2);
                modal.hide(false, ()=>{
                    modal.message("Cobro registrado correctamente");
                    this.limpiar();
                })
            }catch(err){
                console.error(err);
                window.electronAPI.writeLog("Error al registrar el cobro:", err);
                menu.addPopover({querySelector: ele, message: "Ocurrió un error al registrar el cobro"});
            }
        });
    }
    async verificarPasesDisponibles(){
        let pasesDisponiblesFierros = await window.electronAPI.executeQuery("SELECT * FROM turno WHERE eliminado = 0 AND cancelado = 0 AND disciplinaId = -1 AND hasta >= ?", [new Date().toISOString().split("T")[0]]);
        pasesDisponiblesFierros.forEach(pase=>{
            let usuario = this.usuarios.find(u=>u.id == pase.usuarioId);
            if(usuario) usuario.pasesDisponibles = pase.dias;
        });
        this.buscarUsuario();
    }
    async verificarDisciplinasConTurnos(){
        let hoy = new Date().toISOString().split("T")[0];
        let resp = await window.electronAPI.executeQuery("SELECT * FROM turno WHERE cancelado = 0 AND eliminado = 0 AND usuarioId = ? AND desde <= ? AND hasta >= ?", [this.usuarioSeleccionado.id, hoy, hoy]);
        $("#disciplina option").each((ind, opt)=>{
            let value = Number($(opt).val());
            let existe = resp.find(r=>r.disciplinaId == value);
            let label = $(opt).html();
            let [original, estado] = label.split("-");
            $(opt).html(original.trim());
            if(existe) $(opt).html(original.trim() + " -ACTIVO-");
        });
    }
    async modalPasadas(){
        modal.show({
            title: "Pasadas por molinete",
            body: $("#modal-pasadas").html(),
            buttons:"back",
        });
        $("#modal #usuario").html(this.usuarioSeleccionado.nombre);
        let registros = await window.electronAPI.executeQuery("SELECT * FROM pase WHERE usuarioId = ? ORDER BY id DESC LIMIT 100", [this.usuarioSeleccionado.id]);
        let tbody = [];
        let ultimaFecha = null;
        let color = "table-info";
        registros.forEach(registro=>{
            //verifico si registro.fecha tiene mas de 3hs de diff con ultimaFecha, si es asi cambio el color de la fila
            if(ultimaFecha){
                let diff = new Date(registro.fecha) - new Date(ultimaFecha);
                if(diff > 3 * 60 * 60 * 1000){
                    color = (color === "table-info") ? "table-warning" : "table-info";
                }
            }
            let fecha = new Date(registro.fecha).toISOString().split("T")[0];
            let hora = new Date(registro.fecha).toLocaleTimeString();
            tbody.push(`<tr class="${color}"><td>${fecha}</td><td>${hora}</td></tr>`);
            ultimaFecha = registro.fecha;
        });
        $("#modal #tabla-pasadas tbody").html(tbody.join(""));

        $("#modal #habilitar-pase").on("click", async ev=>{
            modal.waiting2(true, "Habilitando pase...");
            const r = await window.electronAPI.sincronizarIndividualMolinete(this.usuarioSeleccionado.enrollNumber, true);
            console.log(r);
            modal.waiting2(false, "Habilitando pase...");
            modal.hide(false, ()=>{
                modal.message("Pase habilitado correctamente");
                this.usuarioSeleccionado.paseHabilitado = true;
                this.buscarUsuario();
            });
        });
        $("#modal #deshabilitar-pase").on("click", async ev=>{
            modal.waiting2(true, "Deshabilitando pase...");
            const r = await window.electronAPI.sincronizarIndividualMolinete(this.usuarioSeleccionado.enrollNumber, false);
            console.log(r);
            modal.waiting2(false, "Deshabilitando pase...");
            modal.hide(false, ()=>{
                modal.message("Pase deshabilitado correctamente");
                this.usuarioSeleccionado.paseHabilitado = false;
                this.buscarUsuario();
            });
        });
    }
}