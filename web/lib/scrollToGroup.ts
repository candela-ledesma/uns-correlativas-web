export function scrollToGroup(groupId: string) {
    const targetId = `grupo-${groupId}`;
    const el = document.getElementById(targetId);

    console.log("scrollToGroup", {
    groupId,
    targetId,
    found: !!el,
    element: el,
    });

    if (!el) return;

    el.scrollIntoView({
    behavior: "smooth",
    block: "start",
    });
}