// api.js — Lógica de llamadas. Separa la capa gratis (C) de la pro (B).
// Se importa como módulo ES desde popup.js.

// ---------------------------------------------------------------------------
// CAPA C (gratis, sin key): IP pública + geolocalización + ISP
// Fuente: ipapi.co (sin registro). Devuelve país, ciudad, región e ISP/org.
// ipapi.co limita las peticiones gratuitas; si falla, se recurre a ipify
// (la fuente original del proyecto) para al menos mostrar la IP.
// ---------------------------------------------------------------------------
export async function fetchBasic() {
  try {
    return await fetchIpapi();
  } catch (err) {
    console.warn("ipapi falló, usando ipify:", err.message);
    return { ip: await fetchIpify() };
  }
}

async function fetchIpapi() {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error(`ipapi HTTP ${res.status}`);

  const d = await res.json();
  // ipapi marca error con la propiedad "error": true
  if (d.error) throw new Error(d.reason || "ipapi error");

  return {
    ip: d.ip,
    city: d.city,
    region: d.region,
    country: d.country_name,
    countryCode: d.country_code,
    isp: d.org, // nombre de la red / operador
  };
}

async function fetchIpify() {
  const res = await fetch("https://api.ipify.org/?format=json");
  if (!res.ok) throw new Error(`ipify HTTP ${res.status}`);

  const data = await res.json();
  return data.ip;
}

// Heurística LOCAL y gratuita: ¿el ISP parece un datacenter/hosting?
// NO es detección de VPN de verdad — es solo una pista basada en el nombre
// del operador. Un datacenter suele indicar servidor/VPN/proxy, pero da
// falsos positivos. Se muestra etiquetada como "pista", no como veredicto.
const DATACENTER_HINTS = [
  "ovh", "digitalocean", "digital ocean", "amazon", "aws", "google cloud",
  "gcp", "microsoft", "azure", "hetzner", "linode", "vultr", "contabo",
  "oracle", "cloudflare", "leaseweb", "m247", "datacamp", "choopa",
  "hosting", "datacenter", "data center", "server", "vps",
];

export function datacenterHint(isp) {
  if (!isp) return false;
  const lower = isp.toLowerCase();
  return DATACENTER_HINTS.some((h) => lower.includes(h));
}

// ---------------------------------------------------------------------------
// CAPA B (pro, con key del usuario): score de fraude vía Scamalytics
// Endpoint documentado: https://apiXX.scamalytics.com/v3/{usuario}?key=...&ip=...
// El host (api11, api12, …) y el formato EXACTO dependen de la cuenta, así que
// el parseo es defensivo: busca el score en varias rutas posibles.
// ---------------------------------------------------------------------------
export const DEFAULT_SCAMALYTICS_HOST = "api11.scamalytics.com";

// Solo se aceptan subdominios de scamalytics.com: es lo único que cubre
// host_permissions, y evita enviar la API key a un servidor cualquiera.
export function isValidScamalyticsHost(host) {
  return /^[a-z0-9-]+\.scamalytics\.com$/i.test(host);
}

export async function fetchScamalytics({ username, apiKey, host, ip }) {
  if (!username || !apiKey) throw new Error("Faltan credenciales");

  const base = host && host.trim() ? host.trim() : DEFAULT_SCAMALYTICS_HOST;
  if (!isValidScamalyticsHost(base)) {
    throw new Error("Host no válido (debe ser *.scamalytics.com)");
  }

  const url =
    `https://${base}/v3/${encodeURIComponent(username)}` +
    `?key=${encodeURIComponent(apiKey)}&ip=${encodeURIComponent(ip)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Scamalytics HTTP ${res.status}`);

  const raw = await res.json();

  // Parseo tolerante: el JSON suele venir anidado bajo "scamalytics".
  const s = raw.scamalytics || raw;

  // La API responde 200 con status "error" ante key/usuario incorrectos.
  if (s.status === "error") {
    throw new Error(s.error || "Scamalytics devolvió un error");
  }

  const score =
    firstDefined(s.scamalytics_score, s.score, raw.score);
  const risk =
    firstDefined(s.scamalytics_risk, s.risk, raw.risk);

  if (score === undefined) {
    // Si llega aquí, el formato de TU cuenta no coincide con lo esperado.
    // Revisa 'raw' en la consola y ajusta las rutas de arriba.
    console.warn("Scamalytics: respuesta no reconocida", raw);
    throw new Error("Formato de respuesta no reconocido");
  }

  return { score: Number(score), risk: risk || null, raw };
}

function firstDefined(...vals) {
  return vals.find((v) => v !== undefined && v !== null);
}
