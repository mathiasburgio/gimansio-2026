const Usuario = require("../models/usuario");
const Turno = require("../models/turno");
const utils = require("../utils/utils");
const FechasTemporal = require("../utils/FechasTemporal");
const fs = require("fs");
const path = require("path");
const conf = require("./configuracion").getConfig();

async function vista(req, res){
    res.status(200).render( "../views/layouts/dashboard.ejs", { page: "../pages/usuarios.ejs" });
}
async function listadoUsuarios(req, res){
    let listado = await Usuario.find({eliminado: false}).lean();
    res.status(200).json(listado);
}
//crear/modificar desde usuarios (admin)
async function guardarUsuario(req, res){
    try{
        let { usuarioId } = req.params;
        let data = {
            nombre: utils.safeString(req.body.nombre),
            apellido: utils.safeString(req.body.apellido),
            email: req.body.email,
            dni: req.body.dni,
            direccion: utils.safeString(req.body.direccion),
            telefono: utils.safeString(req.body.telefono),
            detalleCorto: utils.safeString(req.body.detalleCorto).replaceAll("\n", ". "),
            detalleLargo: utils.safeString(req.body.detalleLargo).replaceAll("\n", ". "),
            esProfesor: utils.getBoolean(req.body.esProfesor),
            esAdministrador: utils.getBoolean(req.body.esAdministrador),
            bloqueado: utils.getBoolean(req.body.bloqueado),
            accesoRapido: utils.getBoolean(req.body.accesoRapido),
            usuarioVerificado: utils.getBoolean(req.body.usuarioVerificado),
            fotoPerfil: req.body.fotoPerfil,
            eliminado: false,
            paseLibre: utils.getBoolean(req.body.paseLibre),
            enrollNumber: utils.getNumber(req.body.enrollNumber, -1),
        }
        
        let usuario = null;
        if(usuarioId){
            usuario = await Usuario.findOne({_id: usuarioId});
            Object.assign(usuario, data);
            await usuario.save();
        }else{
            data.contrasena = await utils.getPasswordHash("123456789");
            usuario = await Usuario.create(data);
        }
        res.status(201).json(usuario);
    }catch(err){
        res.status(400).end(err.toString());
    }
}
async function eliminarUsuario(req, res){
    try{
        let { usuarioId } = req.params;
        let usuario = await Usuario.findOne({_id: usuarioId});
        if(!usuario) throw "Usuario no encontrado";
        usuario.eliminado = true;
        await usuario.save();
        res.status(200).end("ok");
    }catch(err){
        res.status(400).end(err.toString());
    }
}
async function iniciarSesion(req, res){
    try{
        let {email, contrasena} = req.body;
        email = (email || "").toString().toLowerCase();

        //antes de iniciar sesión, verifico si existe el super admin, sino lo creo
        let verificoSuperAdmin = await crearAdmin();

        let usuario = await Usuario.findOne({ email: email, eliminado: { $ne: true } });
        console.log(usuario);
        if(!usuario) throw "Usuario no encontrado";
        if( await utils.comparePasswordHash(contrasena, usuario.contrasena) == false ) throw "Combinación email/contraseña no válida";
        
        
        req.session.data = { usuarioId: usuario._id };

        //verifica si es super admin
        if(email == conf.EMAIL_SUPER_ADMIN){
            req.session.data.permisos = ["*"];
            req.session.data.esAdministrador = true;
        }
        
        req.session.save();

        usuario.ultimoAcceso = new Date();
        usuario.save();
        res.status(200).end("ok");

    }catch(err){
        console.log(err);
        res.status(400).end( err.toString() );
    }
}
async function cerrarSesion(req, res){
    req.session.destroy();
    if(req.method === 'GET'){
        res.redirect("/");
    }else{
        res.status(200).end("ok");
    }
}
async function descargarParaMolinete(req, res){
    try{
        let usuarioId = req.query.usuarioId || null; //si viene usuarioId, solo descargo para ese usuario, sino para todos los usuarios con fierro activo
        if(clavePrivada != CLAVE_PRIVADA_MOLINETE) throw "clave privada no válida.";

        //obtengo todos los usuarios
        let usuarios = await Usuario.find({eliminado: false});
        if(usuarioId) usuarios = usuarios.filter(u => u._id.toString() == usuarioId.toString());

        const ahora = FechasTemporal.toString();
        const manana = FechasTemporal.add(ahora, { days: 1 });
        
        //Obtengo los registros de fierros que están activos
        let turnos = await Turno.find({
            fechaInicio: { $lte: ahora }, // Registros que hayan comenzado
            fechaFin: { $gt: manana }, // Registros que no hayan expirado
            eliminado: { $ne: true },
            cancelado: { $ne: true }
        }).sort({_id: -1 }); // Ordenar por fecha de creación descendente

        //asigno los que tienen molinete
        let mapeado = usuarios.map(u => {
            let pasesPorSemana = turnos.find(f => f.usuarioId.toString() == u._id.toString())?.fierros || 0;
            return {
                _id: u._id,
                nombre: u.nombre + " " + u.apellido,
                enrollNumber: u.enrollNumber || "",
                pases: pasesPorSemana,
                paseLibre: u?.paseLibre || false,
            }
        });

        res.status(200).json(mapeado);
    }catch(err){
        console.log(err);
        res.status(400).end("ERROR");
    }
}
async function obtenerUsuario(req, res){
    try{
        let usuarioId = req.params.usuarioId;
        let usuario = await Usuario.findOne({_id: usuarioId, eliminado: false});
        if(!usuario) throw "Usuario no encontrado";
        res.status(200).json(usuario);
    }catch(err){
        console.log(err);
        res.status(400).end("ERROR");
    }
}

async function crearAdmin(){
    try{
        //creo super admin si no existe
        const existe = await Usuario.findOne({email: conf.EMAIL_SUPER_ADMIN});
        if(existe) return console.log(`Super admin ${conf.EMAIL_SUPER_ADMIN} ya existe`);
        await Usuario.create({
            nombre: "Super",
            apellido: "Admin",
            email: conf.EMAIL_SUPER_ADMIN,
            contrasena: await utils.getPasswordHash("123456789"),
            esAdministrador: true,
            permisos: ["*"],
        });
        console.log(`Super admin ${conf.EMAIL_SUPER_ADMIN} creado con contraseña "123456789"`);
    }catch(err){
        console.log("crearAdmin ERROR:", err);
    }

}

module.exports = {
    vista,
    listadoUsuarios,
    guardarUsuario,
    eliminarUsuario,
    iniciarSesion,
    cerrarSesion,
    descargarParaMolinete,
    obtenerUsuario
}