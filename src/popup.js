import { fetchBasic, datacenterHint, fetchScamalytics } from "./api.js";

const ipEl = document.getElementById("ip");
const copyBtn = document.getElementById("copy");
const geoEl = document.getElementById("geo");
const hintEl = document.getElementById("hint");
const riskBody = document.getElementById("risk-body");
const lastEl = document.getElementById("last");
const openOptions = document.getElementById("open-options");

let currentIp = null;

init();

async function init() {
  showLastSeen();

  try {
    const basic = await fetchBasic();
    currentIp = basic.ip;

    ipEl.textContent = currentIp;
    ipEl.classList.remove("error");
    copyBtn.disabled = false;

    const place = [basic.city, basic.region, basic.country]
      .filter(Boolean)
      .join(", ");
    geoEl.textContent = [place, basic.isp].filter(Boolean).join(" · ");

    if (datacenterHint(basic.isp)) {
      hintEl.textContent =
        "⚠ Pista: el operador parece un datacenter (posible VPN/proxy/servidor).";
    }

    chrome.storage.local.set({
      lastIp: currentIp,
      lastSeen: Date.now(),
    });
  } catch (err) {
    ipEl.textContent = "No se pudo obtener la IP";
    ipEl.classList.add("error");
    copyBtn.disabled = true;
    return; 
  }

  const creds = await getCreds();
  if (creds.apiKey && creds.username) {
    await loadRisk(creds, currentIp);
  }
}


async function loadRisk(creds, ip) {
  riskBody.replaceChildren(el("span", "loading", "Consultando…"));
  try {
    const { score, risk } = await fetchScamalytics({ ...creds, ip });
    riskBody.replaceChildren(
      el("div", `score score-${bucket(score)}`, `${score}/100`),
      ...(risk ? [el("div", "risk-label", risk)] : []),
    );
  } catch (err) {
    riskBody.replaceChildren(el("span", "error-inline", `Error: ${err.message}`));
  }
}

function bucket(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

copyBtn.addEventListener("click", async () => {
  if (!currentIp) return;
  await navigator.clipboard.writeText(currentIp);

  const original = copyBtn.textContent;
  copyBtn.textContent = "¡Copiado!";
  setTimeout(() => (copyBtn.textContent = original), 1200);
});

openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

function showLastSeen() {
  chrome.storage.local.get(["lastIp", "lastSeen"], (data) => {
    if (!data.lastIp) return;
    const fecha = new Date(data.lastSeen).toLocaleString("es-ES");
    lastEl.textContent = `Anterior: ${data.lastIp} (${fecha})`;
  });
}

function getCreds() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["username", "apiKey", "host"], (d) => {
      resolve({
        username: d.username || "",
        apiKey: d.apiKey || "",
        host: d.host || "",
      });
    });
  });
}
