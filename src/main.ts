import "@fontsource/figtree/latin-500.css";
import "@fontsource/figtree/latin-800.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/roboto/latin-400.css";
import "./styles.css";
import { initOutboxFlush } from "./lib/outbox";
import { instalarPlayerService } from "./player-service";

// El juego (public/game/*.js, scripts clásicos) solo usa window.PlayerService y los eventos megacontrol:*.
instalarPlayerService();
initOutboxFlush();
