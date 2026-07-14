var modal = new Modal();

let bufferKeys = "";
$("body").on("keydown", async ev=>{
    bufferKeys += ev.key;
    if(bufferKeys.length > 100) bufferKeys = "";
    if(bufferKeys.includes("devtools")){
        await window.electronAPI.openDevTools();
        bufferKeys = "";
    }
});

$("#respaldar").on("click", ev=>{
    respaldar();
});

$("#restaurar").on("click", ev=>{
    restaurar();
});

async function respaldar(){
    let ok = false;
    try{
        await modal.waiting("Realizando respaldo...");
        await window.electronAPI.makeBackup();
        ok = true;
    }catch(err){
        console.error(err);
    }finally{
        modal.hide(false, ()=>{
            if(ok) modal.message("Respaldo realizado correctamente. Se aconseja guardarlo en un dispositivo externo para mayor seguridad.");
            else modal.message("Ocurrió un error al realizar el respaldo. Revise la consola para más información");
        });
    }
    
}

function restaurar(){
    let f = document.createElement("input");
    f.type = "file";
    f.accept = ".sql";
    f.style.display = "none";
    document.body.appendChild(f);
    f.onchange = async ev=>{
        f.remove();
        try{
            let file = ev.currentTarget.files[0];
            if(!file) return;
            await modal.waiting("Restaurando respaldo...");
            await window.electronAPI.restoreBackup(file);
            modal.hide(false, ()=>modal.message("Restauración completada. Reinicie la aplicación para usar los datos restaurados."));
        }catch(err){
            console.error(err);
            modal.hide(false, ()=>modal.message(`No se pudo restaurar el respaldo: ${err.message || err}`));
        }
    }
    f.click();
}
