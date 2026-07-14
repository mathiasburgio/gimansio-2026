//leo argumentos
const os = require('os');
const path = require('path');
const fs = require('fs');
const documentsPath = path.join(os.homedir(), "Documents");
const config = JSON.parse(fs.readFileSync(path.join(documentsPath, "fulltraining-2026", "config.json"), "utf-8"));
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

let sql = null;
let mongo = null;

async function sincronizar(){

    const PROCESAR_USUARIOS = false;
    const PROCESAR_FIERROS = false;
    const PROCESAR_TURNOS = false;
    const PROCESAR_COBROSPAGOS = true;
    const PROCESAR_PASES = false;
    const LIMPIEZA_FINAL = true;

    let aux = null;
    let params = null;
    try{
        //1- conecto ambas BD
        const confMysql = {
            host: "localhost",
            user: "root",
            password: "servidor",
            database: "gimnasio2026",
            waitForConnections: true,
            connectionLimit: 10
        };
        let sql = await mysql.createConnection(confMysql);
        console.log("Conexión a MySQL establecida", "test: ", await sql.execute("SELECT 1 + 1 AS solution"));
        let mongo = await mongoose.connect("mongodb://localhost:27017/fulltraining");
        console.log("Conexión a MongoDB establecida");

        const usuarios = await mongoose.connection.db.collection('usuarios').find({}).toArray();
        const cobropagos = await mongoose.connection.db.collection('cobropagos').find({}).toArray();
        //const disciplinas = await mongoose.connection.db.collection('disciplinas').find({}).toArray();
        const fierros = await mongoose.connection.db.collection('fierros').find({}).toArray();
        const turno2 = await mongoose.connection.db.collection('turno2').find({}).toArray();

        let oldId_usuario = {};
        let newId_usuario = {};
        let enrollNumber_usuario = {};
        
        if(PROCESAR_USUARIOS){
            await sql.execute("DELETE FROM usuario where id > 0");
            await sql.execute("ALTER TABLE usuario AUTO_INCREMENT = 1");

            for(let u of usuarios){
                let createdAt = new Date();
                if(u.createdAt) createdAt = new Date(u.createdAt);
                if(isNaN(Number(u.enrollNumber))) u.enrollNumber = 0;
                let resp = await sql.execute(`INSERT INTO usuario SET 
                    nombre = ?,
                    email = ?,
                    contrasena=?,
                    esAdmin=?,
                    esProfe=?,
                    dni=?,
                    telefono=?,
                    direccion=?,
                    enrollNumber=?,
                    paseLibre=?,
                    createdAt=?,
                    paseHabilitado=0,
                    eliminado=0,
                    bloqueado=0,
                    oldId=?`,
                [   u.nombre + " " + (u?.apellido || ""),
                    u?.email || "",
                    u?.esAdministrador ? "123456789" : "",
                    u?.esAdministrador ? 1 : 0, 
                    u?.esProfesor ? 1 : 0, 
                    u?.dni || "", 
                    u?.telefono || "", 
                    u?.direccion || "", 
                    u?.enrollNumber || 0, 
                    u.paseLibre ? 1 : 0, 
                    createdAt,
                    u._id.toString()
                ]);
            }
            let resp = await sql.execute("SELECT * FROM usuario");
            console.log("Usuarios migrados correctamente", resp[0].length);
        }

        let aux1 = await sql.execute("SELECT * FROM usuario");
        aux1[0].forEach(u=>{
            oldId_usuario[u.oldId] = u;
            newId_usuario[u.id] = u;
            enrollNumber_usuario[u.enrollNumber] = u;
        });


        let disciplinas = [
            {id: 10, nombre: "Pileta libre"},
            {id: 11, nombre: "Matronatación 0-3 años"},
            {id: 12, nombre: "Aquagym"},
            {id: 13, nombre: "Adolescentes y adultos"},
            {id: 14, nombre: "Clases pileta 7-11 años"},
            {id: 15, nombre: "Clases pileta 3-6 años"},
        ];
        await sql.execute("DELETE FROM disciplina where id > 0");
        await sql.execute("ALTER TABLE disciplina AUTO_INCREMENT = 1");
        for(let d of disciplinas){
            await sql.execute(`INSERT INTO disciplina SET 
                id=?,
                nombre=?,
                diasHorarios = '[[],[],[],[],[],[],[]]',
                habilitado=1,
                eliminado=0,
                createdAt=NOW()`,
            [d.id, d.nombre]);
        }
        console.log("Disciplinas creadas correctamente", disciplinas.length);


        let turno_id = {};
        if(PROCESAR_TURNOS){
            await sql.execute("DELETE FROM turno where id > 0");
            await sql.execute("ALTER TABLE turno AUTO_INCREMENT = 1");
            for(let t of turno2){
                aux = t;
                let dias = t.registros.length;
                let diasHorarios = [
                    [], //dom
                    [], //lun
                    [], //mar
                    [], //mie
                    [], //jue
                    [], //vie
                    [] //sab
                ];
    
                for(let r of t.registros){
                    diasHorarios[r.dia].push(r.horario);
                }
    
                params = [   
                    oldId_usuario[t.usuarioId]?.id || -1,
                    t?.usuarioNombre || "?",
                    null, //#######################################################completo luego
                    disciplinas.find(d => d.nombre === t.disciplina)?.id || -2,
                    t?.disciplina || "?", //nombre de la disciplina en version vieja
                    dias,
                    JSON.stringify(diasHorarios),
                    getDateTime(t.desde, true),
                    getDateTime(t.hasta, true),
                    t.eliminado ? 1 : 0,
                    t.cobrado ? 1 : 0,
                    t.cancelado ? 1 : 0,
                    new Date(t.createdAt),
                    t._id.toString()
                ];
                const r = await sql.execute(`INSERT INTO turno SET 
                    usuarioId = ?,
                    usuarioNombre = ?,
                    cobroId = ?,
                    disciplinaId = ?,
                    disciplinaNombre = ?,
                    dias = ?,
                    diasHorarios= ?,
                    desde = ?,
                    hasta = ?,
                    eliminado = ?,
                    cobrado = ?,
                    cancelado = ?,
                    createdAt = ?,
                    oldId= ?`
                , params);
                turno_id[t._id] = r[0].insertId;
            }
            let resp = await sql.execute("SELECT * FROM turno");
            console.log("Turnos migrados correctamente", resp[0].length);
        }

        if(PROCESAR_FIERROS){
            for(let f of fierros){
                aux = f;
                let diasHorarios = [
                    [], //dom
                    [], //lun
                    [], //mar
                    [], //mie
                    [], //jue
                    [], //vie
                    [] //sab
                ];
    
                const r = await sql.execute(`INSERT INTO turno SET 
                    usuarioId = ?,
                    usuarioNombre = ?,
                    cobroId = ?,
                    disciplinaId = ?,
                    disciplinaNombre = ?,
                    dias = ?,
                    diasHorarios= ?,
                    desde = ?,
                    hasta = ?,
                    eliminado = ?,
                    cobrado = ?,
                    cancelado = ?,
                    createdAt = ?,
                    oldId = ?`,
                [
                    oldId_usuario[f.usuario.usuarioId]?.id || -1,
                    f?.usuarioNombre || "?",
                    null, //#######################################################completo luego
                    -1,
                    "fierros", //nombre de la disciplina en version vieja
                    f.dias,
                    JSON.stringify(diasHorarios),
                    f.fechaInicio ? getDateTime(f.fechaInicio, true) : null,
                    f.fechaFin ? getDateTime(f.fechaFin, true) : null,
                    f.eliminado ? 1 : 0,
                    f.cobrado ? 1 : 0,
                    f.cancelado ? 1 : 0,
                    new Date(f.createdAt),
                    f._id.toString()
                ]);
                turno_id[f._id] = r[0].insertId;
            }
            let resp = await sql.execute("SELECT * FROM turno");
            console.log("Turnos migrados correctamente (fierros + disciplinas)", resp[0].length);
        }

        if(PROCESAR_COBROSPAGOS){
            await sql.execute("DELETE FROM cobropago where id > 0");
            await sql.execute("ALTER TABLE cobropago AUTO_INCREMENT = 1");

            for(let c of cobropagos){
                aux = c;    
                let disciplinaNombre = "?";
                if(c.detalle.startsWith("Turno fierros")) disciplinaNombre = "fierros / musculación";
                if(c.detalle.indexOf("Turno disciplina para") > -1) disciplinaNombre = c.detalle.split("-")[1].trim();
    
                let multicaja = {};
                if(c.multicaja && Object.keys(c.multicaja).length > 0){
                    for(let m of c.multicaja){
                        if(m.caja == "efectivo") multicaja["efectivo"] = m.monto;
                        else multicaja["transferencia"] = m.monto;
                    }
                }else if(c.caja){
                    if(c.caja == "efectivo") multicaja["efectivo"] = c.monto;
                    else multicaja["transferencia"] = c.monto;
                }

                let monto = 0;
                for(let aux in multicaja){
                    monto += multicaja[aux];
                }

                params = [
                    c.accion,
                    monto,
                    c.grupo,
                    c.detalle,
                    turno_id[c.turnoId] || null,
                    disciplinaNombre,
                    -1,
                    "Usuario general",
                    oldId_usuario[c.usuarioAbonador?.usuarioId]?.id || -1,
                    (c.usuarioAbonador?.nombre + " " + c.usuarioAbonador?.apellido) || "?",
                    JSON.stringify(multicaja),
                    new Date(c.createdAt),
                    c._id.toString()
                ];
    
                await sql.execute(`INSERT INTO cobropago SET
                    accion = ?,
                    monto = ?,
                    grupo = ?,
                    detalle = ?,
                    turnoId = ?,
                    disciplinaNombre = ?,
                    usuarioCobradorId = ?,
                    usuarioCobrador = ?,
                    usuarioAbonadorId = ?,
                    usuarioAbonador = ?,
                    multicaja = ?,
                    createdAt = ?,
                    oldId=?`,
                params);
            }
            console.log("Cobros migrados correctamente", cobropagos.length);         
        }

        //asocia dichas colecciones
        if(LIMPIEZA_FINAL){
            let cobrosLocales = await sql.execute("SELECT * FROM cobropago");
            let turnosLocales = await sql.execute("SELECT * FROM turno");
            let cobropagosMongo = cobropagos;
            console.log(cobropagosMongo.length);

            let cc = 0;
            for(let cp of cobropagosMongo){
                let ux = oldId_usuario[cp.usuarioAbonador?.usuarioId];
                if(cp.turnoId){
                    let t = turnosLocales[0].find(t=>t.oldId == cp.turnoId.toString());
                    let c = cobrosLocales[0].find(c=>c.oldId == cp._id.toString());
                    if(c && t){
                        await sql.execute("UPDATE turno SET cobroId = ?, usuarioNombre = ? WHERE id = ?", [c.id, ux?.nombre || "?", t.id]);
                        await sql.execute("UPDATE cobropago SET turnoId = ?, disciplinaNombre=?, usuarioAbonador=? WHERE id = ?", [t.id, t.disciplinaNombre, ux?.nombre || "?", c.id]);
                        cc++;
                    }
                    /* if(t){
                        
                    }
                    console.log(123);
                    let c = cobrosLocales[0].find(c=>c.oldId == cp.cobroId.toString());
                    if(c && t){
                        
                        cc++;
                    } */
                }
            }
            console.log("Limpieza final realizada correctamente. Registros: " + cc);
        }


        if(PROCESAR_PASES){
            await sql.execute("DELETE FROM pase where id > 0");
            //ruta con los pases
            let p = path.join(__dirname, "logs-viejos");
            let files = fs.readdirSync(p);
            console.log("Files:", files.length);
            let registrosTotales = 0;
            let cc = 0;
            for(let f of files){
                if(f.startsWith("logs-") && f.endsWith(".json")){
                    let data = JSON.parse(fs.readFileSync(path.join(p, f), "utf-8"));
                    console.log("Procesando archivo (" + cc + "):", f, "Registros:", data.length);
                    cc++;
                    let agrupadorParams = [];
                    for(let reg of data){
                        aux = reg;
                        params = [
                            enrollNumber_usuario[reg.enrollNumber]?.id || 0,
                            enrollNumber_usuario[reg.enrollNumber]?.nombre || "?",
                            reg.enrollNumber,
                            reg.date,
                            new Date(reg.date),
                        ];
                        agrupadorParams.push(params);
    
                        await sql.execute(`INSERT INTO pase (usuarioId, usuarioNombre, enrollNumber, fecha, createdAt) VALUES (?, ?, ?, ?, ?)`, params);
                        registrosTotales++;
                    }

                }
            }

            console.log("Pases migrados correctamente", registrosTotales);
        }
    }catch(e){
        console.log({objeto: aux, parametros: params});
        console.log(e);
    }finally{
        console.log("Sincronización finalizada");
    }
}

function getDateTime(reg=null, soloFecha = false) {
    let aux = (reg ? new Date(reg) : new Date());
    const ahora = aux.toLocaleString("sv-SE", {
        timeZone: "America/Argentina/Buenos_Aires"
    });
    if (soloFecha) return ahora.split(" ")[0];
    else return ahora;
}
sincronizar();


/*

descargar y sincronizar bd fulltraining con nueva versión:
1- ingresar al server
2- ir a www/fulltrainig/resources/
3- ejecutar "mongodump --db fulltraining --archive=backup.gz --gzip"
4- desde el navegador descargar fulltraining.ar/resources/backup.gz
5- localmente pegar el descargado en "C:\Program Files\MongoDB\Tools\100"
6- desde cmd ejecutar -> mongorestore --gzip --archive="backup-fulltraining.gz"
7- ejecutart el archivo restore-old.js

para restaurar pasadas:
-agregar pasadas a proyecto/logs-viejos/… logs-2025-10.json
-ejecutar el archivo restore-olds.js

*/