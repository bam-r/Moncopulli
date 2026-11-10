export const USE_MOCK = false
const BASE = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'moncopulli.token'

try { localStorage.removeItem('moncopulli.mock.v2') } catch {}

export class NetworkError extends Error {
  constructor() { super('Sin conexión con el servidor') }
}
export class ApiError extends Error {
  constructor(status, data) {
    super(mensajeDeError(status, data))
    this.status = status
    this.data = data
  }
}

function mensajeDeError(status, data) {
  if (data && typeof data === 'object') {
    if (data.detail) return String(data.detail)
    const partes = Object.entries(data).map(([k, v]) => `${k}: ${[].concat(v).join(' ')}`)
    if (partes.length) return partes.join(' · ')
  }
  return `Error ${status}`
}

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch {}
}

async function http(method, path, body) {
  const token = getToken()
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new NetworkError()
  }
  if (!res.ok) {
    let data = null
    try { data = await res.json() } catch {}
    throw new ApiError(res.status, data)
  }
  return res.status === 204 ? null : res.json()
}

export async function request(method, path, body) {
  return http(method, path, body)
}
