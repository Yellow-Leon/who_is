
const ipEl = document.getElementById("ip");
const copyBtn = document.getElementById("copy");
const lastEl = document.getElementById("last");

let currentIp = null;


init();

async function init() {
  showLastSeen();
  await fetchIp();
}

async function fetchIp() {
  try {
    const res = await fetch("https://api.ipify.org/?format=json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    currentIp = data.ip;

    ipEl.textContent = currentIp;
    ipEl.classList.remove("error");
    copyBtn.disabled = false;

    
    chrome.storage.local.set({
      lastIp: currentIp,
      lastSeen: Date.now(),
    });
  } catch (err) {
    ipEl.textContent = "No se pudo obtener la IP";
    ipEl.classList.add("error");
    copyBtn.disabled = true;
  }
}

 copyBtn.addEventListener("click", async () => {
  if (!currentIp) return;
  await navigator.clipboard.writeText(currentIp);

  const original = copyBtn.textContent;
  copyBtn.textContent = "¡Copiado!";
  setTimeout(() => (copyBtn.textContent = original), 1200);
});

function showLastSeen() {
  chrome.storage.local.get(["lastIp", "lastSeen"], (data) => {
    if (!data.lastIp) return;
    const fecha = new Date(data.lastSeen).toLocaleString("es-ES");
    lastEl.textContent = `Anterior: ${data.lastIp} (${fecha})`;
  });
}