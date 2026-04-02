export function scrollToGroup(idGrupo: string) {
    const elemento = document.getElementById(`grupo-${idGrupo}`);

    if (!elemento) return;

    elemento.scrollIntoView({
    behavior: "smooth",
    block: "start",
    });
}