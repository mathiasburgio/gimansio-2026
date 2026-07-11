const express = require("express");
const router = express.Router();
const usuarios = require("../controllers/usuarios");

router.post("/usuarios/iniciar-sesion", 
    usuarios.iniciarSesion);

router.get("/usuarios/cerrar-sesion",
    usuarios.cerrarSesion);

router.get("/usuarios",
    usuarios.vista);

router.post("/usuarios/listado",
    usuarios.listadoUsuarios);

router.post("/usuarios/guardar/:usuarioId",
    usuarios.guardarUsuario);

router.post("/usuarios/eliminar/:usuarioId",
    usuarios.eliminarUsuario);

router.get("/usuarios/usuario/:usuarioId",
    usuarios.obtenerUsuario);

router.get("/usuarios/descargar-para-molinete",
    usuarios.descargarParaMolinete);

module.exports = router;