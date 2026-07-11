const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const documentsPath = app.getPath('documents');

//copio la configuracion default si no existe
if(fs.existsSync(path.join(documentsPath, "molinete-v3", "configuracion.json")) == false){
    fs.copyFileSync(
        path.join(__dirname, "..", "configuracion.json"),
        path.join(documentsPath, "molinete-v3", "configuracion.json")
    );
}

//leo la configuracion default
var conf = fs.readFileSync(path.join(documentsPath, "molinete-v3", "configuracion.json"));
conf = JSON.parse(conf);


module.exports = {
    getConfig: function(){
        return conf;
    }
}