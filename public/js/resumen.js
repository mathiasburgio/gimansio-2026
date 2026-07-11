class Resumen{
    constructor(){
        this.registrosCobroPago = [];
        this.registrosTurno = [];
        this.accMontoDisciplina = {};
        this.desde = null;
        this.hasta = null;
        this.init();
    }
    init(){
        let anioMes = new Date().toISOString().slice(0, 7);
        $("#mes").val(anioMes);

        $("#mes").on("change", async () => {
            let mes = $("#mes").val();
            if(!mes) return;
            this.mesActual = mes;
            let [a, m] = mes.split("-");
            this.desde = `${a}-${m}-01`;
            let mesSiguiente = Number(m) + 1;
            if(mesSiguiente === 13) this.hasta = `${Number(a) + 1}-01-01`;
            else this.hasta = `${a}-${Number(mesSiguiente).toString().padStart(2, '0')}-01`;
            console.log("desde", this.desde, "hasta", this.hasta);

            this.listarResumen();
            this.listarAcumulado();
        }).change(); // disparo el evento para que se ejecute la primera vez

        $("#exportar").on("click", () => {
            this.exportarExcel();
        });

        $("#agregar-registro").on("click", () => {
            this.agregarRegistro();
        });
    }
    async listarResumen(){
    
        this.registrosCobroPago = await window.electronAPI.executeQuery(`SELECT * FROM cobropago WHERE createdAt >= ? AND createdAt < ?`, [this.desde, this.hasta]);

        let tbody = [];
        let saldo = 0;
        this.accMontoDisciplina = {};
        this.registrosCobroPago.forEach(r=>{
            r.monto = Number(r.monto);
            if(r.accion == "cobro") saldo += r.monto;
            else saldo -= r.monto;

            if(r.disciplinaNombre){
                if(!this.accMontoDisciplina[r.disciplinaNombre]) this.accMontoDisciplina[r.disciplinaNombre] = 0;
                this.accMontoDisciplina[r.disciplinaNombre] += r.monto;
            }

            tbody.push(`
                <tr data-id="${r.id}">
                    <td>${r.accion == "cobro" ? "<span class='badge badge-success'>Cobro</span>" : "<span class='badge badge-danger'>Pago</span>"}</td>
                    <td>${new Date(r.createdAt).toLocaleDateString()}</td>
                    <td>${r?.usuarioAbonador || "-"}</td>
                    <td class="text-right">$${utils.formatNumber(r.monto)}</td>
                    <td class="text-right font-weight-bold">$${utils.formatNumber(saldo)}</td>
                </tr>    
            `)
        });

        $("table:eq(0) tbody").html(tbody.join(""));
        
        //click => ver detalle
        $("table:eq(0) tbody tr").on("click", (ev)=>{
            let tr = $(ev.currentTarget);
            let id = tr.data("id");
            let registro = this.registrosCobroPago.find(r=>r.id == id);
            if(typeof registro.multicaja == "string") registro.multicaja = JSON.parse(registro.multicaja);

            modal.message(`
                <b>Fecha</b>: ${new Date(registro.createdAt).toLocaleDateString()}<br>
                <b>Abonador</b>: ${registro.usuarioAbonador || "-"}<br>
                <b>Cobrador</b>: ${registro.usuarioCobrador || "-"}<br>
                <b>Acción</b>: ${registro.accion == "cobro" ? "Cobro" : "Pago"}<br>

                <b>Monto</b>: $${utils.formatNumber(registro.monto)}<br>
                <b>Efectivo</b>: $${utils.formatNumber(registro.multicaja?.efectivo || 0)}<br>
                <b>Transferencia</b>: $${utils.formatNumber(registro.multicaja?.transferencia || 0)}<br>
                
                <b>Detalle</b>: ${registro.detalle || "-"}
            `);
        });        
    }
    async listarAcumulado(){

        let disciplinas = await window.electronAPI.executeQuery(`SELECT * FROM disciplina WHERE eliminado != 1`);
        let cantidadPorDisciplina = await window.electronAPI.executeQuery(`SELECT COUNT(*) as cantidad, disciplinaNombre FROM turno WHERE createdAt >= ? AND createdAt < ? AND eliminado != 1 AND cancelado != 1 GROUP BY disciplinaNombre`, [this.desde, this.hasta]);
        let tbody = [];
               
        disciplinas.splice(0, 0, { id: -1, nombre: "fierros" });
        disciplinas.forEach(d=>{
            let monto = this.accMontoDisciplina[d.nombre] || 0;
            let cant = cantidadPorDisciplina.find(c=>c.disciplinaNombre == d.nombre)?.cantidad || 0;
            tbody.push(`
                <tr>
                    <td>${d.nombre}</td>
                    <td class='text-right'>${utils.formatNumber(cant)}</td>
                    <td class='text-right font-weight-bold'>$${utils.formatNumber(monto)}</td>
                </tr>
            `)
        });
        $("table:eq(1) tbody").html(tbody.join(""));
    }
    exportarExcel(){
        try{
            const wb = XLSX.utils.book_new();
    
            const ws1 = XLSX.utils.table_to_sheet($("table:eq(0)")[0]);
            const ws2 = XLSX.utils.table_to_sheet($("table:eq(1)")[0]);
    
            XLSX.utils.book_append_sheet(wb, ws1, "Resumen");
            XLSX.utils.book_append_sheet(wb, ws2, "Acumulado");
    
            XLSX.writeFile(wb, "reporte.xlsx");
        }catch(err){
            console.error(err);
            modal.message("Ocurrió un error al exportar el archivo. Revise la consola para más información");
        }
    }
    agregarRegistro(){
        modal.show({
            title: "Agregar registro",
            body: $("#modal-agregar-registro").html(),
            buttons: "back"
        })


        $("#modal #fecha").val(new Date().toISOString().slice(0, 10));

        $("#modal #acreditar").on("click", async ev=>{
            let usuarioLogeado = await window.electronAPI.getUsuarioLogeado();
            let ele = $(ev.currentTarget);
            try{
                let data = {
                    accion: $("#modal #accion").val(),
                    caja: $("#modal #caja").val(),
                    monto: Number($("#modal #monto").val()),
                    detalle: $("#modal #detalle").val(),
                };

                if(!data.monto || data.monto <= 0) throw new Error("El monto debe ser mayor a cero");
                
                let auxCaja = {};
                auxCaja[data.caja] = data.monto;

                await window.electronAPI.executeQuery(
                    `INSERT INTO cobropago SET 
                        accion = ?, 
                        multicaja = ?, 
                        monto = ?, 
                        detalle = ?, 
                        usuarioCobrador= ?,
                        usuarioCobradorId= ?,
                        createdAt= NOW()`,
                    [data.accion, JSON.stringify(auxCaja), data.monto, data.detalle, usuarioLogeado.nombre, usuarioLogeado.id]
                );
                this.listarResumen();
                this.listarAcumulado();
                modal.hide(false, ()=>{
                    modal.message("Registro agregado correctamente");
                });
            }catch(err){
                console.error(err);
                modal.addPopover({querySelector: ele, message: err.toString()})
            }
        });
    }
}