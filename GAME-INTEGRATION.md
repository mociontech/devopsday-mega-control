# Integración de registros e ID

`player-service.js` es el único adaptador que debe reemplazarse para conectar el sistema de jugadores. Actualmente no hace solicitudes, no guarda datos y no autentica usuarios. `register` devuelve siempre el ID de demostración `321-321`; `lookup` acepta cualquier ID con formato `000-000`. No usar este adaptador para registro real.

## Contrato asíncrono

```js
window.PlayerService = {
  async register({ name, email }) {
    // Registrar en el servicio compartido y devolver su ID real.
    return { id: '123-456', name, email };
  },
  async lookup(id) {
    // Consultar y validar el ID en el servicio compartido.
    // Lanzar Error si no existe o si falla la consulta.
    return { id: '123-456' };
  }
};
```

El formato de seis dígitos en dos grupos refleja las imágenes actuales. Si el servicio usa otro formato, adaptar los campos, validaciones y salida en `index.html` y `journey.js`. No incluir credenciales del servidor en estos archivos públicos.

`journey.js` controla la validación básica del formulario, bloquea envíos duplicados, muestra los errores del adaptador y descarta respuestas de una pantalla que se abandonó. Los botones de volver siguen disponibles. El participante permanece solo en memoria y se entrega mediante `event.detail.player` en el evento `megacontrol:start`. Su propiedad `mode: 'demo'` identifica respuestas del adaptador provisional.

Al volver desde GraciasPorParticipar se limpian el participante, los formularios y la partida. No hay envío de puntuaciones implementado. Las cifras impresas en Pantalla_Final y GraciasPorParticipar siguen siendo parte de los PNG originales.

Para integrar, implementar ambos métodos y probar: registro correcto, ID existente, ID inexistente, fallo de red, doble clic, volver mientras espera una respuesta y segundo participante después del agradecimiento.
