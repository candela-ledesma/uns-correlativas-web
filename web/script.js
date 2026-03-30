document.addEventListener("DOMContentLoaded", () => {

const container = document.getElementById("materias-container");

let materias = [];

const estadoMaterias = JSON.parse(localStorage.getItem("estadoMaterias")) || {};


async function cargarMaterias(){

    try{

        const res = await fetch("/api/materias");
        const data = await res.json();

        materias = data;

        renderMaterias();

    }catch(err){

        console.error("Error cargando materias:", err);

    }

}

function materiaHabilitada(materia){

    const correlativas = materia.correlativas || {};

    for(const id in correlativas){

        const estadoNecesario = correlativas[id].cursada;

        const estadoActual = estadoMaterias[id];

        if(estadoNecesario === "Cursada" && !estadoActual)
            return false;

        if(estadoNecesario === "Aprobada" && estadoActual !== "aprobada")
            return false;

    }

    return true;

}

function correlativasFaltantes(materia){

    const faltantes = [];

    const correlativas = materia.correlativas || {};

    for(const id in correlativas){

        const req = correlativas[id].cursada;
        const estado = estadoMaterias[id];

        if(req === "Cursada" && !estado)
            faltantes.push(id);

        if(req === "Aprobada" && estado !== "aprobada")
            faltantes.push(id);

    }

    return faltantes;

}


function renderMaterias(){

    container.innerHTML = "";

    const años = {};

    materias.forEach(m => {

        if(!años[m.año])
            años[m.año] = {};

        if(!años[m.año][m.cuatrimestre])
            años[m.año][m.cuatrimestre] = [];

        años[m.año][m.cuatrimestre].push(m);

    });

    for(const año in años){

        const añoDiv = document.createElement("div");
        añoDiv.className = "año";

        const tituloAño = document.createElement("h2");
        tituloAño.textContent = año;
        añoDiv.appendChild(tituloAño);

        for(const cuatri in años[año]){

            const cuatriDiv = document.createElement("div");
            cuatriDiv.className = "cuatrimestre";

            const tituloC = document.createElement("h3");
            tituloC.textContent = cuatri;

            const grid = document.createElement("div");
            grid.className = "grid";

            años[año][cuatri].forEach(materia => {

            const div = document.createElement("div");
            div.className = "materia";

            const estado = estadoMaterias[materia.id];

            if(estado === "cursada") div.classList.add("cursada");
            if(estado === "aprobada") div.classList.add("aprobada");

            div.textContent = `${materia.nombre}`;

            const habilitada = materiaHabilitada(materia);

            if(!habilitada){

                div.classList.add("bloqueada");

                const faltan = correlativasFaltantes(materia);

                div.title = "Faltan correlativas: " + faltan.join(", ");

            } else {

                div.addEventListener("click", () =>
                    toggleEstado(materia.id)
                );

            }

            grid.appendChild(div);

        });

            cuatriDiv.appendChild(tituloC);
            cuatriDiv.appendChild(grid);

            añoDiv.appendChild(cuatriDiv);

        }

        container.appendChild(añoDiv);

    }

}


function toggleEstado(id){

    const estado = estadoMaterias[id];

    if(!estado)
        estadoMaterias[id] = "cursada";

    else if(estado === "cursada")
        estadoMaterias[id] = "aprobada";

    else
        delete estadoMaterias[id];

    localStorage.setItem(
        "estadoMaterias",
        JSON.stringify(estadoMaterias)
    );

    renderMaterias();

}


document.getElementById("reset-btn").addEventListener("click", () => {

    localStorage.removeItem("estadoMaterias");

    for(const key in estadoMaterias){
        delete estadoMaterias[key];
    }

    renderMaterias();

});


cargarMaterias();

});