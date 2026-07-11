class Menu{
    constructor(){
        this.animations = (localStorage.getItem("animations") === "true");
        this.setAnimations(this.animations);
        $("#toggle-animations").click(ev=>{
            this.setAnimations()
            this.toast({level: "info", title: `Animaciones`, message: this.animations ? "Animaciones activadas" : "Animaciones desactivadas", time:4000})
        });
        
        this.THEAD_MODES = ["normal", "sticky", "dynamic"];
        this.sounds = (localStorage.getItem("sounds") === null || localStorage.getItem("sounds") === "true");
        this.setSounds(this.sounds);
        $("#toggle-sounds").click(ev=>{ 
            this.setSounds() 
            this.toast({level: "info", title: `Sonidos`, message: this.sounds ? "Sonidos activados" : "Modo SILENCIOSO activado", time:4000})
        });
        
        this.darkMode = (localStorage.getItem("darkMode") === "true");
        this.setDarkMode(this.darkMode);
        $("#toggle-dark-mode").click(ev=>{
            this.setDarkMode()
            this.toast({level: "info", title: `Modo oscuro`, message: this.darkMode ? "Modo OSCURO activado" : "Modo CLARO activado", time:4000})
        });

        this.upperCase = (localStorage.getItem("upperCase") === "true");
        this.setUpperCase(this.upperCase);
        $("#toggle-upper-lower-case").click(ev=>{
            this.setUpperCase()
            this.toast({level: "info", title: `Tablas en mayusculas`, message: `Las tablas mostrarán los datos ${this.upperCase ? "en MAYUSCULAS" : "de igual forma que se han guardado"}`, time:4000})
        });

        this.theadMode = Number(localStorage.getItem("theadMode")) || 0;
        this.setTheadMode(this.theadMode);
        $("#toggle-thead-mode").click(ev=>{
            this.setTheadMode()
            if(this.theadMode === 0){//normal
                this.toast({level: "info", title: `Encabezado tablas`, message: `Encabezados normal/fijos al principio de las tablas`, time:4000})
            }else if(this.theadMode === 1){
                this.toast({level: "info", title: `Encabezado tablas`, message: `Encabezados SIEMPRE VISIBLES`, time:4000})
            }else if(this.theadMode === 2){
                this.toast({level: "info", title: `Encabezado tablas`, message: `Encabezados DINÁMICOS. Se muestran al pasar el mouse sobre la tabla`, time:4000})
            }
        });

        $('.main-header [data-toggle="tooltip"]').tooltip();

        let menuSelectedItem = $("[href='" + window.location.pathname + "']");
        if(menuSelectedItem.length == 1) menuSelectedItem.addClass("active");
        $("#pageName").html(menuSelectedItem.text());

        $(".nav-logout").click(async()=>{
            let resp = await modal.yesno(`¿Confirma <b>cerrar sesión</b>?`);
            if(!resp) return;
            window.location.href = "/logout";
        })
    }
    setPageName(title, name=null){
        document.title = title;
        $("#pageName").html(name || title);
    }
    hideCortina(){
        $("body, .content-wrapper").scrollTop(0);

        $("#cortina").animate({
            opacity: 0
        },"fast", ()=>{
            $("body, .content-wrapper").removeClass("overflow-hidden");
            $(".wrapper").removeClass("d-none");
            $("#cortina").remove();
            $(".content-wrapper>.content").removeClass("d-none");
            $(".content-wrapper>.content").animate({
                opacity: 1
            }, "fast")

            //verifico el modo dinamico una vez mas
            this.setTheadDynamic();
        })
    }
    showLeftMenu(show=null){
        let isOpen = $("body").hasClass("sidebar-collapse");
        if(show === true){
            if(isOpen) return;
            $("[data-widget='pushmenu']").click();
        }else if(show === false){
            if(isOpen == false) return;
            $("[data-widget='pushmenu']").click();
        }else{
            $("[data-widget='pushmenu']").click();
        }
    }
    showRightMenu(show=null){
        let isOpen = $("body").hasClass("control-sidebar-slide-open");
        if(show === true){
            if(isOpen) return;
            $("[data-widget='control-sidebar']").click();
        }else if(show === false){
            if(isOpen == false) return;
            $("[data-widget='control-sidebar']").click();
        }else{
            $("[data-widget='control-sidebar']").click();
        }
    }
    setPermissions(permissions=[]){
        if(primordial.usuario.esAdministrador){

        }else{
            $("#toggle-animations").parent().addClass("d-none");
            $("#toggle-thead-mode").parent().addClass("d-none");
            $("#toggle-upper-lower-case").parent().addClass("d-none");
            $("#toggle-sounds").parent().addClass("d-none");
            $(".sidebar [admin]").addClass("d-none");
        }
        /* $(".main-sidebar .sidebar .nav-sidebar li").each((ind, ev)=>{
            let ele = $(ev);
            let permission = $(ev).attr("permission");
            if(!permission) return; //salteo el menú en caso de no necesitar permisos
            
            //aqui se pueden usar 2 estrategias: 
            //1-mostrar los menues para los que se tiene permisos
            //2-ocultar los menues de los que no se tiene permisos
            if( ele.hasClass("d-none")){
                //muestro menues ocultos
                if(permissions.includes("*") || permissions.includes(permission)) ele.removeClass("d-none");
            }else{
                //oculto los permisos no concedidos
                if(permissions.includes("*") == false && permissions.includes(permission) == false) ele.addClass("d-none");
            }
        }) */
    }
    setAnimations(enable=null){
        if(enable === true) this.animations = true;
        else if(enable === false) this.animations = false;
        else this.animations = !this.animations;
        if(modal?.setAnimation) modal.setAnimation(this.animations); //verifico ya que quizas no esta instanciado aun
        
        localStorage.setItem("animations", (this.animations).toString());
        if(this.animations){
            $("#toggle-animations").removeClass("btn-light").addClass("btn-primary");
            $("#toggle-animations i").removeClass("fa-pause").addClass("fa-play");
        }else{
            $("#toggle-animations").removeClass("btn-primary").addClass("btn-light");
            $("#toggle-animations i").removeClass("fa-play").addClass("fa-pause");
        }
    }
    setUpperCase(enable=null){
        if(enable === true) this.upperCase = true;
        else if(enable === false) this.upperCase = false;
        else this.upperCase = !this.upperCase;
        
        localStorage.setItem("upperCase", (this.upperCase).toString());
        if(this.upperCase){
            $("#toggle-upper-lower-case").removeClass("btn-light").addClass("btn-primary").html("A");
            $("body").addClass("table-uppercase");
        }else{
            $("#toggle-upper-lower-case").removeClass("btn-primary").addClass("btn-light").html("Aa");
            $("body").removeClass("table-uppercase");
        }
    }
    setSounds(enable=null){
        if(enable === true) this.sounds = true;
        else if(enable === false) this.sounds = false;
        else this.sounds = !this.sounds;
        
        localStorage.setItem("sounds", (this.sounds).toString());
        if(this.sounds){
            $("#toggle-sounds").removeClass("btn-light").addClass("btn-primary");
            $("#toggle-sounds i").removeClass("fa-volume-xmark").addClass("fa-volume-high");
        }else{
            $("#toggle-sounds").removeClass("btn-primary").addClass("btn-light");
            $("#toggle-sounds i").removeClass("fa-volume-high").addClass("fa-volume-xmark");
        }
    }
    setDarkMode(enable=null){

        if(enable === true) this.darkMode = true;
        else if(enable === false) this.darkMode = false;
        else this.darkMode = !this.darkMode;
        
        localStorage.setItem("darkMode", (this.darkMode).toString());
        if(this.darkMode){
            $("#toggle-dark-mode").removeClass("btn-outline-warning").addClass("btn-secondary");
            $("#toggle-dark-mode i").removeClass("fa-sun").addClass("fa-moon");
            $("body").addClass("dark-mode");
            $(".main-header").addClass("navbar-dark").removeClass("navbar-white");
        }else{
            $("#toggle-dark-mode").removeClass("btn-secondary").addClass("btn-outline-warning");
            $("#toggle-dark-mode i").removeClass("fa-moon").addClass("fa-sun");
            $("body").removeClass("dark-mode");
            $(".main-header").addClass("navbar-white").removeClass("navbar-dark");
        }
    }
    setTheadMode(v=null){

        if(v === null){
            this.theadMode += 1;
            if(this.theadMode == 3) this.theadMode = 0;
        }else{
            this.theadMode = v;
        }
        
        localStorage.setItem("theadMode", (this.theadMode).toString());
        if(this.theadMode == 0){
            $("#toggle-thead-mode").removeClass("btn-primary").removeClass("btn-warning").addClass("btn-light");
            $("#toggle-thead-mode i").removeClass("fa-table-cells-row-lock").addClass("fa-table");
            $("body").removeClass("thead-mode-sticky").removeClass("thead-mode-dynamic");
        }else if(this.theadMode == 1){
            $("#toggle-thead-mode").addClass("btn-primary").removeClass("btn-warning").removeClass("btn-light");
            $("#toggle-thead-mode i").addClass("fa-table-cells-row-lock").removeClass("fa-table");
            $("body").addClass("thead-mode-sticky").removeClass("thead-mode-dynamic");
        }else if(this.theadMode == 2){
            $("#toggle-thead-mode").removeClass("btn-primary").addClass("btn-warning").removeClass("btn-light");
            $("#toggle-thead-mode i").addClass("fa-table-cells-row-lock").removeClass("fa-table");
            $("body").removeClass("thead-mode-sticky").addClass("thead-mode-dynamic");
        }
        this.setTheadDynamic();
    }
    playSound(audioName, force=false){
        if(!this.sounds && force == false) return;
        audioName = audioName.replace(".mp3", "");

        const audioPlayer = document.getElementById('audioPlayer');
        const sources = audioPlayer.querySelectorAll('#audioPlayer source');

        // Buscar la fuente que coincida con el data-audio especificado
        const source = Array.from(sources).find(src => src.dataset.audio === audioName);
        
        audioPlayer.src = source.src;
        audioPlayer.play();
    }
    toast({level, title, message, time=2500, sound=true}){
        let _level = level;
        if(_level == "danger") _level = "error";
        if(_level == "primary") _level = "success";

        Swal.fire({
            icon: _level,
            title: title,
            text: message,
            toast: true,
            position: 'top',
            showConfirmButton: false,
            timer: time
        }) 
        if(sound) this.playSound(level);
    }
    setExpiration(expirationDate=null){
        let days = fechas.diff_days(new Date(), expirationDate);
        if(days <= 0){
            let fox = `<b>Suscripción vencida</b> renuevala hacienco clic en `;
            $("#expiration [name='text']").html(fox);
            $("#expiration").removeClass("d-none").addClass("bg-danger").addClass("text-white");
            return true;
        }else if(days < 7){
            let fox = `Tu suscripción vence en <b>${days}</b> días renuevala hacienco clic en `;
            $("#expiration [name='text']").html(fox);
            $("#expiration").removeClass("d-none").addClass("bg-warning").addClass("text-black");
        }else{
            $("#expiration").addClass("d-none")
        }
        return false;
    }
    //se debe llamar a esta funcion cada vez q se agrega una tabla al DOM
    setTheadDynamic(){
        $("table").each((ind, el)=>{
            let table = $(el);
            table.off("mouseenter mouseleave");
            table.removeAttr("thead-mode-dynamic");
            
            if(this.theadMode == 2){
                table.attr("thead-mode-dynamic", true);
                table.on("mouseenter", ()=>{
                    table.find("th").addClass("thead-mode-dynamic");
                }).on("mouseleave", ()=>{
                    table.find("th").removeClass("thead-mode-dynamic");
                });
            }
        })
    }
}