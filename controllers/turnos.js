const Turno = require('../models/turno');
const CobroPago = require('../models/cobro-pago');
const FechasTemporal = require('../utils/FechasTemporal');

async function vista(req, res){
    res.status(200).render( "../views/layouts/dashboard.ejs", { page: "../pages/turnos.ejs" });
}

async function obtenerTurnosUsuario(req, res){
    try{
        const usuarioId = req.params.usuarioId;
        const turnos = await Turno
            .find({ usuarioId: usuarioId, eliminado: { $ne: true } })
            .lean();
        
        res.status(200).json(turnos);
    }catch(err){
        console.error("Error al obtener turnos del usuario:", err);
        res.status(500).json({ error: "Error al obtener turnos del usuario" });
    }
}

async function proximosVencimientos(req, res){
    try{
        const ahora = FechasTemporal.toString();
        const haceUnaSemana = FechasTemporal.add(ahora, { days: -7 });
        const enUnaSemana = FechasTemporal.add(ahora, { days: 7 });

        const turnos = await Turno.find({ 
            eliminado: { $ne: true }, 
            cancelado: { $ne: true },
            hasta: { $gte: haceUnaSemana, $lte: enUnaSemana } 
        })
        .sort({ createdAt: -1 })
        .lean();

        res.status(200).json(turnos);
    }catch(err){
        console.error("Error al obtener próximos vencimientos:", err);
        res.status(500).json({ error: "Error al obtener próximos vencimientos" });
    }
}

async function guardarTurno(req, res){
    try{
        const { usuarioId, disciplina, registros, desde, hasta, fierros } = req.body;

        const turno = new Turno2({
            usuarioId,
            disciplina,
            registros,
            desde: FechasTemporal.toString(desde),
            hasta: FechasTemporal.toString(hasta),
            fierros,
            eliminado: false,
            cancelado: false,
            cobrado: false
        });
        await turno.save();
        
        res.status(201).json(turno);
    }catch(err){
        console.error("Error al guardar turno:", err);
        res.status(500).json({ error: "Error al guardar turno" });
    }
}

async function obtenerOcupacionTurno(req, res){
    try{
        let ahora = FechasTemporal.toString();
        let manana = FechasTemporal.add(ahora, { days: 1 });  

        let turnos = await Turno.find({
            fechaInicio: { $lte: ahora }, // Registros que hayan comenzado
            fechaFin: { $gt: manana }, // Registros que no hayan expirado
            eliminado: { $ne: true },
            cancelado: { $ne: true }
        }).lean();

        const ocupacion = {};
        turnos.forEach(turno => {
            turno.registros.forEach(registro => {
                let key = `${turno.disciplina}.${registro.dia}.${registro.horario}`;
                if(ocupacion[key]){
                    if(!ocupacion[key].includes(turno.usuarioId)) {
                        ocupacion[key].push(turno.usuarioId);
                    }
                }else{
                    ocupacion[key] = [turno.usuarioId];
                }
            });
        });
        res.status(200).json(ocupacion);
    }catch(err){
        console.error("Error al obtener ocupación del turno:", err);
        res.status(500).json({ error: "Error al obtener ocupación del turno" });
    }
}

async function obtenerAsistentes(req, res){
    try{
        const { disciplinaNombre } = req.params;
        if(!disciplinaNombre) throw "Parámetros inválidos";

        const ahora = FechasTemporal.toString();
        const manana = FechasTemporal.add(ahora, { days: 1 });
        const asistentes = await Turno.find({
            disciplina: disciplinaNombre,
            desde: { $lte: ahora },
            hasta: { $gt: manana },
            eliminado: {$ne: true},
            cancelado: {$ne: true},
        });
        
        res.status(200).json(asistentes);
    }catch(err){
        console.error("Error al obtener asistentes del turno:", err);
        res.status(500).json({ error: "Error al obtener asistentes del turno" });
    }
}

async function cobrarTurno(req, res){
    try{
        const { turnoId, cajas } = req.body;

        let arCajas = [];
        for(let prop in cajas){
            arCajas.push({
                caja: prop,
                monto: cajas[prop]
            });
        }

        let turno = await Fierro.findOne({ _id: turnoId, eliminado: {$ne: true} });
        if(!turno) throw "Turno no encontrado o eliminado";
        if(turno.cobrado) throw "Turno ya cobrado";

        let cobro = await CobroPago.create({
            accion: "cobro",
            usuarioAbonador: { usuarioId: turno.usuarioId },
            usuarioCobrador: { usuarioId: req.session?.data?.usuarioId },
            multicaja: arCajas,
            turnoId: turno._id,
            grupo: turno?.fierros > 0 ? "fierros" : "disciplina",
            detalle: `Cobro de turno ${turnoId}`
        });

        turno.cobroId = cobro._id;
        turno.cobrado = true;
        await turno.save();
        res.status(200).json({ message: "Turno cobrado exitosamente" });
    }catch(err){
        console.error("Error al cobrar turno:", err);
        res.status(500).json({ error: "Error al cobrar turno" });
    }
}

async function cancelarTurno(req, res){
    try{
        const { turnoId } = req.body;

        let turno = await Turno.findOne({ _id: turnoId, eliminado: {$ne: true} });
        if(!turno) throw "Turno no encontrado o eliminado";
        turno.cancelado = true;
        await turno.save();
        return res.status(200).json(turno);
    }catch(err){
        console.error("Error al cancelar turno:", err);
        res.status(500).json({ error: "Error al cancelar turno" });
    }
}

async function marcarCobrado(req, res){
    try{
        const { turnoId } = req.body;
        let turno = await Turno2.findOne({ _id: turnoId, eliminado: {$ne: true} });
        if(!turno) throw "Turno no encontrado o eliminado";
        turno.cobrado = true;
        await turno.save();
        return res.status(200).json(turno);   
    }catch(err){
        console.error("Error al marcar turno como cobrado:", err);
        res.status(500).json({ error: "Error al marcar turno como cobrado" });
    }
}

module.exports = {
    vista,
    obtenerTurnosUsuario,
    proximosVencimientos,
    guardarTurno,
    obtenerOcupacionTurno,
    obtenerAsistentes,
    cobrarTurno,
    cancelarTurno,
    marcarCobrado
};