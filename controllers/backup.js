const path = require('path');
const fs = require('fs');

const Turno = require('../models/turno');
const Usuario = require('../models/usuario');
const CobroPago = require('../models/cobro-pago');

module.exports = {
    backup: async function(req, res){
        let turnos = await Turno.find().lean();
        let usuarios = await Usuario.find().lean();
        let cobrosPagos = await CobroPago.find().lean();
        fs.writeFileSync(path.join(__dirname, "..", "backup", "turnos.json"), JSON.stringify(turnos, null, 2));
        fs.writeFileSync(path.join(__dirname, "..", "backup", "usuarios.json"), JSON.stringify(usuarios, null, 2));
        fs.writeFileSync(path.join(__dirname, "..", "backup", "cobros-pagos.json"), JSON.stringify(cobrosPagos, null, 2));
        return res.send("ok");
    }
}