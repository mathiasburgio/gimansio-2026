var modal = new Modal();
var utils = new Utils();

window.onload = () => {
    let recordar = localStorage.getItem("recordar-credenciales");
    if(recordar){
        recordar = JSON.parse(recordar);
        $("#email").val(recordar.email);
        $("#contrasena").val(recordar.contrasena);
        $("#recordar").prop("checked", true);
    }

    $("#iniciar-sesion").on("click", async ev=>{
        $(ev.currentTarget).attr("disabled", true);
        await iniciarSesion();
        $(ev.currentTarget).attr("disabled", false);
    });
}
async function iniciarSesion(){
    try{
        const email = $("#email").val();
        const contrasena = $("#contrasena").val();

        //intento iniciar
        let resp = await window.electronAPI.executeQuery("SELECT * FROM usuario WHERE email = ? AND contrasena = ?", [email, contrasena]);
        console.log(resp);

        //grabo credenciales localmente
        if($("#recordar").is(":checked")){
            localStorage.setItem("recordar-credenciales", JSON.stringify({ email, contrasena }));
        }else{
            localStorage.removeItem("recordar-credenciales");
        }

        if(resp.length !== 1) return modal.message("Credenciales incorrectas");
        else{
            await window.electronAPI.setUsuarioLogeado(resp[0]);
            window.location.href = "inicio.html";
        }

    }catch(err){
        modal.message(err?.responseText || err.toString());
    }
}