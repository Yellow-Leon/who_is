import { DEFAULT_SCAMALYTICS_HOST, isValidScamalyticsHost } from "./api.js";

const usernameEl = document.getElementById("username");
const apiKeyEl = document.getElementById("apiKey");
const hostEl = document.getElementById("host");
const statusEl = document.getElementById("status");

hostEl.placeholder = DEFAULT_SCAMALYTICS_HOST;

chrome.storage.local.get(["username", "apiKey", "host"], (d) => {
  usernameEl.value = d.username || "";
  apiKeyEl.value = d.apiKey || "";
  hostEl.value = d.host || "";
});

document.getElementById("save").addEventListener("click", () => {
  const host = hostEl.value.trim();
  if (host && !isValidScamalyticsHost(host)) {
    flash("El host debe ser del tipo apiXX.scamalytics.com", true);
    return;
  }

  chrome.storage.local.set(
    {
      username: usernameEl.value.trim(),
      apiKey: apiKeyEl.value.trim(),
      host,
    },
    () => flash("Guardado"),
  );
});

document.getElementById("clear").addEventListener("click", () => {
  chrome.storage.local.remove(["username", "apiKey", "host"], () => {
    usernameEl.value = "";
    apiKeyEl.value = "";
    hostEl.value = "";
    flash("Credenciales borradas");
  });
});

function flash(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
  setTimeout(() => (statusEl.textContent = ""), 1800);
}
