document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("materias-container");

    let materias = [];

    const estadoMaterias = JSON.parse(localStorage.getItem("estadoMaterias")) || {};

    async function cargarMaterias() {
        try {
            const res = await fetch("/api/materias");
            const data = await res.json();

            materias = data;

            console.log("Materias cargadas:", materias);
            console.log(
                "Materia con opciones:",
                materias.find(m => Array.isArray(m.opciones) && m.opciones.length > 0)
            );

            renderMaterias();
        } catch (err) {
            console.error("Error cargando materias:", err);
        }
    }

    function materiaHabilitada(materia) {
        const correlativas = materia.correlativas || {};

        for (const id in correlativas) {
            const estadoNecesario = correlativas[id].cursada;
            const estadoActual = estadoMaterias[id];

            if (estadoNecesario === "Cursada" && !estadoActual) return false;
            if (estadoNecesario === "Aprobada" && estadoActual !== "aprobada") return false;
        }

        return true;
    }

    function correlativasFaltantes(materia) {
        const faltantes = [];
        const correlativas = materia.correlativas || {};

        for (const id in correlativas) {
            const req = correlativas[id].cursada;
            const estado = estadoMaterias[id];

            if (req === "Cursada" && !estado) faltantes.push(id);
            if (req === "Aprobada" && estado !== "aprobada") faltantes.push(id);
        }

        return faltantes;
    }

    function crearCardMateria(materia, esOpcion = false) {
    const div = document.createElement("div");
    div.className = "materia";

    if (esOpcion) div.classList.add("optativa-opcion");

    const estado = estadoMaterias[materia.id];

    if (estado === "cursada") div.classList.add("cursada");
    if (estado === "aprobada") div.classList.add("aprobada");

    div.textContent = materia.horas
        ? `${materia.nombre} (${materia.horas} hs)`
        : materia.nombre;

    const habilitada = materiaHabilitada(materia);

    if (!habilitada) {
        div.classList.add("bloqueada");
        const faltan = correlativasFaltantes(materia);
        div.title = "Faltan correlativas: " + faltan.join(", ");
    } else {
        if (!estado) div.classList.add("disponible");
        div.addEventListener("click", () => toggleEstado(materia.id));
    }

    return div;
}


    function renderSeccion(titulo, subtitulo, lista) {
    if (!lista || lista.length === 0) return;

    const seccion = document.createElement("div");
    seccion.className = "año";

    const h2 = document.createElement("h2");
    h2.textContent = titulo;
    h2.style.color = "black";
    seccion.appendChild(h2);

    if (subtitulo) {
        const h3 = document.createElement("h3");
        h3.textContent = subtitulo;
        h3.style.color = "black";
        seccion.appendChild(h3);
    }

    const grid = document.createElement("div");
    grid.className = "grid";

    lista.forEach(materia => {
        const div = crearCardMateria(materia, true);
        grid.appendChild(div);
    });

    seccion.appendChild(grid);
    container.appendChild(seccion);

}

    function renderMaterias() {
        container.innerHTML = "";

        const años = {};
        const materiaConOpciones = materias.find(
            m => Array.isArray(m.opciones) && m.opciones.length > 0
        );

        const optativas = materiaConOpciones?.opciones || [];

        // Render normal: excluimos el bloque "Optativas"
        materias.forEach(m => {
            if (m.año === "Optativas") return;

            const año = m.año || "Sin año";
            const cuatri = m.cuatrimestre || "Sin cuatrimestre";

            if (!años[año]) años[año] = {};
            if (!años[año][cuatri]) años[año][cuatri] = [];

            años[año][cuatri].push(m);
        });

        for (const año in años) {
            const añoDiv = document.createElement("div");
            añoDiv.className = "año";

            const tituloAño = document.createElement("h2");
            tituloAño.textContent = año;
            añoDiv.appendChild(tituloAño);

            for (const cuatri in años[año]) {
                const cuatriDiv = document.createElement("div");
                cuatriDiv.className = "cuatrimestre";

                const tituloC = document.createElement("h3");
                tituloC.textContent = cuatri;
                cuatriDiv.appendChild(tituloC);

                const grid = document.createElement("div");
                grid.className = "grid";

                años[año][cuatri].forEach(materia => {
                    grid.appendChild(crearCardMateria(materia));
                });

                cuatriDiv.appendChild(grid);
                añoDiv.appendChild(cuatriDiv);
            }

            container.appendChild(añoDiv);
        }

        renderSeccion(
            "Materias Optativas",
            materiaConOpciones ? materiaConOpciones.nombre : "",
            optativas
        );

        console.log("Optativas renderizadas:", optativas.length);
    }

    function toggleEstado(id) {
        const estado = estadoMaterias[id];

        if (!estado) estadoMaterias[id] = "cursada";
        else if (estado === "cursada") estadoMaterias[id] = "aprobada";
        else delete estadoMaterias[id];

        localStorage.setItem("estadoMaterias", JSON.stringify(estadoMaterias));
        renderMaterias();
    }

    document.getElementById("reset-btn").addEventListener("click", () => {
        localStorage.removeItem("estadoMaterias");

        for (const key in estadoMaterias) {
            delete estadoMaterias[key];
        }

        renderMaterias();
    });

    cargarMaterias();
});