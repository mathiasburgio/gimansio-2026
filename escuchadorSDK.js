const express = require('express');
const app = express();
const logger = require("./utils/logger.js");
app.use(express.json());

let isListening = false;
let callback = null;

//ruta donde recibe los datos del SDK
app.post("/escucha", (req, res)=>{
    try{
        if(callback) callback(req.body);
        res.status(200).send("ok");
    }catch(e){
        res.status(500).send(e.message);
    }
})

//inicia express en el puerto 4000 para escuchar los eventos del SDK
function startListener(cb=null){
    try{
        if(!cb) throw "Falta callback";
        if(isListening) return true; // ya esta escuchando
        app.listen(4000, ()=>{
            console.log("Iniciado escuchador SDK en puerto 4000. POST /escucha");
            isListening = true;
            cb({status: "ok", message: "Iniciado escuchador SDK en puerto 4000. POST /escucha"});
        })
    }catch(e){
        console.log("Error al iniciar el escuchador SDK: " + e.message, "error");
        logger.log("Error al iniciar el escuchador SDK: " + e.message, "error");
        cb({status: "error", message: e.message});
    }
};

module.exports = {
    startListener,
    isListening: () =>{
        return isListening;
    },
    setCallback: (cb)=>{
        callback = cb;
    }
}