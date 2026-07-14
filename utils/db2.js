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
    try{
        const [rows] = await connection.query("SELECT * FROM registro WHERE clave = ?", [clave]);
        if(rows.length === 1) return rows[0].valor;
        else return null;
    }catch(err){
        logger.log("Error al obtener registro:", err);
        return null;
    }
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
const getMysqldumpPath = async () => {
    let p = await getRegistro("mysqldump-path");
    if(!p){
        const mysqlPath = await getRegistro("mysql-path");
        p = mysqlPath
            ? path.join(path.dirname(mysqlPath), "mysqldump.exe")
            : "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe";
        await setRegistro("mysqldump-path", p);
    }
    return p;
}

const makeBackup = async (output) => {
    let mysqlPath = await getMysqlPath();
    let mysqDumpPath = path.join(mysqlPath, "mysqldump.exe");
    if(!fs.existsSync(mysqDumpPath)) throw new Error(`No se encontró mysqldump.exe en: ${mysqDumpPath}`);
    
    return new Promise((resolve, reject) => {

        const dump = spawn(mysqDumpPath, [
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
const getMysqlPath = async () => {
    try{
        let p = await getRegistro("mysql-tools-path");
        if(!p) await setRegistro("mysql-tools-path", "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\");
        return p || "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\";
    }catch(err){
        logger.log("Error al obtener mysql-path:", err);
    }
    return null;
}

const restoreBackup = async (input) => {
    let mysqlPath = await getMysqlPath();
    let mysqRestorePath = path.join(mysqlPath, "mysql.exe");
    if(!fs.existsSync(mysqRestorePath)) throw new Error(`No se encontró mysql.exe en: ${mysqRestorePath}`);

    return new Promise((resolve, reject) => {
    let terminado = false;
    const finalizarConError = err => {
        if(terminado) return;
        terminado = true;
        logger.log(err, "restoreBackup");
        reject(err);
    };
    const restore = spawn(mysqRestorePath, [
        "-u", conf.user,
        `-p${conf.password}`,
        conf.database
    ]);
    const backup = fs.createReadStream(input);
    let error = "";

    restore.stderr.on("data", data => error += data.toString());
    restore.on("error", err => {
        finalizarConError(err);
    });
    backup.on("error", err => {
        restore.kill();
        finalizarConError(err);
    });
    restore.on("close", code => {
        if(terminado) return;
        if(code === 0){
            terminado = true;
            return resolve(true);
        }
        const err = new Error(error || `mysql finalizó con código ${code}.`);
        finalizarConError(err);
    });

    backup.pipe(restore.stdin);
    });
}

module.exports = { 
    connect, 
    executeQuery, 
    getRegistro, 
    setRegistro, 
    makeBackup, 
    restoreBackup 
};
