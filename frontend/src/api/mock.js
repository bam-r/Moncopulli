import { request } from './client'

// La base de datos temporal en memoria/localStorage fue deshabilitada.
// Todas las peticiones ahora se dirigen directamente al backend de Django.
export async function mockRequest(method, path, body) {
  return request(method, path, body)
}
