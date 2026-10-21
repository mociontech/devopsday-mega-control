# MegaControl — prototipo de plataformas

Abre `index.html` con Chrome, Edge o Firefox. No necesita instalación ni servidor; conserva la carpeta `Public/Images` junto a los archivos del juego.

## Recorrido de pantallas

Bienvenida ? Registro. Hay dos rutas:

- Nuevo participante: completar nombre y correo ? Tu_ID ? Instrucciones ? Juego.
- Participante con ID: pulsar Digitar ID código ? Ingresar_ID ? Instrucciones ? Juego.

Al terminar: Ganaste o Perdiste (3 segundos) ? Pantalla_Final (3 segundos) ? GraciasPorParticipar. Cualquier nueva tecla o toque en el agradecimiento devuelve a Bienvenida y limpia los datos y la partida.

Los registros son provisionales: no se guardan ni verifican contra un servidor. El ID mostrado para nuevos participantes es siempre 321-321 como ejemplo. El formulario de ID acepta seis dígitos en dos grupos; la validación real queda pendiente. Ver [INTEGRATION.md](INTEGRATION.md) para reemplazar el adaptador de player-service.js. Los campos mantienen el autocompletado desactivado y no tienen contornos azules.

Las imágenes se muestran completas, con su proporción original y controles transparentes alineados. Las cifras de las pantallas finales son parte de sus imágenes originales.

La imagen de instrucciones se conserva tal como fue entregada; menciona juego en pareja y recolección de objetivos, mecánicas que aún no se han agregado a este prototipo.

## Controles

La meta es un robot rojo sobre la última plataforma. Al llegar, el reloj se detiene y una animación de 5 segundos lo hace girar tres vueltas sobre su centro. Se encoge hasta el 4% de su tamaño, cambia a robot bueno cuando está muy pequeño y vuelve a crecer mientras gira, sin desvanecimiento. Termina saludando antes de mostrar Ganaste. Este personaje no ataca ni requiere combate.

Durante el juego hay 13 objetos distribuidos en las plataformas: Pincel, Control, Camara, Balon y Cerebro. Cada contacto recoge el objeto una sola vez y suma 10 puntos (máximo 130). El marcador muestra puntos y objetos recogidos. No es obligatorio recogerlos todos para llegar a la meta.

La imagen Cronometro muestra una cuenta regresiva real de 60 segundos. Empieza al entrar al juego y termina con derrota al llegar a cero; cambiar de pestaña no concede tiempo adicional. R restablece el tiempo, los objetos y los puntos. `CONFIG.duration` y `CONFIG.itemPoints` permiten ajustar estas cantidades. Los puntos se muestran solo durante el juego; Pantalla_Final conserva los 130 puntos impresos en la imagen original.

- Flechas izquierda/derecha o A/D: desplazamiento.
- Espacio, flecha arriba o W: salto (una pulsación por salto).
- R o botón Reiniciar: volver al inicio.
- F: activar o salir de pantalla completa (Esc también permite salir).
- Botones en pantalla: movimiento y salto táctil simultáneos.

El escenario ocupa toda la ventana, sin marco ni instrucciones visibles, y adapta el campo de visión sin deformar las imágenes. En móvil conviene girar el dispositivo; los controles táctiles aparecen sobre el escenario. La cámara sigue al robot hacia ambos lados, las caídas terminan la partida y la última base completa el nivel.

## Organización

- `physics.js`: gravedad, movimiento, colisiones y posiciones de plataformas. `CONFIG` permite ajustar velocidad, fuerza del salto y tamaño del robot. Las coordenadas `y` crecen hacia abajo; cada plataforma define `x`, `y` (superficie), `w` (ancho sólido) y `sprite`.
- `game.js`: imágenes, teclado, controles táctiles, cámara dibujada y animación. `art` alinea las superficies de las imágenes con las colisiones sin modificar los originales. Salto_1 se usa al subir y Salto_2 al bajar.
- `styles.css`: presentación adaptable de la pantalla.
- `tests/physics.test.cjs`: comprobaciones de colisiones, reinicio y recorrido alcanzable. Ejecutar con `node --test tests/physics.test.cjs`.

Las plataformas son unidireccionales: se atraviesan al subir y sostienen al robot al bajar. Es una base funcional, sin enemigos, sonido ni guardado de partida.
