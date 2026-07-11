const mysql = require("mysql2/promise");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const logger = require("./logger.js");
let connection = null;

const conf = {
    host: "localhost",
    user: "root",
    password: "servidor",
    database: "gimnasio2026",
    waitForConnections: true,
    connectionLimit: 10
};

async function connect(preConf=null){
    if(preConf) Object.assign(conf, preConf);
    try{
        connection = await mysql.createConnection(conf);
        if(connection) console.log("Conexión a la base de datos establecida");
    }catch(err){
        console.error("Error al conectar a la base de datos:", err);
        logger.log("Error al conectar a la base de datos:", err);
        throw err;
    }
}

const executeQuery = async (query, params) => {
    try {
        const [rows] = await connection.query(query, params);
        return rows;
    } catch (err) {
        logger.log("Error al ejecutar la consulta:", err);
        throw err;
    }
};
const getRegistro = async (clave) => {
    const [rows] = await connection.query("SELECT * FROM registro WHERE clave = ?", [clave]);
    if(rows.length === 1) return rows[0].valor;
    else return null;
}
const setRegistro = async (clave, valor) => {
    const existe = await getRegistro(clave);
    if(existe){
        await connection.query("UPDATE registro SET valor = ? WHERE clave = ?", [valor, clave]);
    }else{
        await connection.query("INSERT INTO registro (clave, valor) VALUES (?, ?)", [clave, valor]);
    }
    return true;
}
const makeBackup = async (output) => {
    let p = await getRegistro("mysqldump-path");
    if(!p){
        p = `C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe`;
        await this.setRegistro("mysqldump-path", p);
    }
    
    return new Promise((resolve, reject) => {

        const dump = spawn(p, [
            "-u", conf.user,
            `-p${conf.password}`,
            conf.database
        ]);

        const file = fs.createWriteStream(output);

        dump.stdout.pipe(file);

        let error = "";

        dump.stderr.on("data", data => {
            error += data.toString();
        });

        dump.on("close", code => {
            file.close();

            if (code === 0) {
                console.log("Backup terminado");
                resolve();
            } else {
                reject(new Error(error || `mysqldump terminó con código ${code}`));
            }
        });

        dump.on("error", reject);
    });

}
const restoreBackup = async (input) => {
    try{
        const restore = spawn("mysql", [
            "-u", conf.user,
            `-p${conf.password}`,
            conf.database
        ]);

        restore.stdin.pipe(fs.createReadStream(input));

        restore.on("close", () => {
            console.log("Restauración terminada");
        });
    }catch(err){
        logger.log("Error al restaurar el backup:", err);
    }
}

module.exports = { 
    connect, 
    executeQuery, 
    getRegistro, 
    setRegistro, 
    makeBackup, 
    restoreBackup 
};