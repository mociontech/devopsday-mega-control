/** Ruta de un archivo de public/assets, respetando la base del despliegue. */
export const asset = (nombre: string) => `${import.meta.env.BASE_URL}assets/${nombre}`;
