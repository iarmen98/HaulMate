# Haulmate

**Rutas de transporte de carga a partir de tu `Game.log` de Star Citizen.**

Haulmate lee tu `Game.log` en directo mientras juegas, detecta los contratos de carga que aceptas y calcula el orden más rápido para cargar y entregar sin pasarte de la capacidad de tu nave. Es una app de escritorio para Windows que funciona junto al juego: sin cuenta, y el log nunca sale de tu PC.

[Read in English](README.md)

> **Proyecto fan no oficial.** Haulmate no está afiliado ni respaldado por Cloud Imperium Games ni Roberts Space Industries. Star Citizen®, Roberts Space Industries® y Cloud Imperium® son marcas de Cloud Imperium Rights LLC.

![Maqueta del planificador](docs/design/main.png)

## Funciones

- **Lectura del log en directo** — sigue `Game.log` mientras el juego escribe y detecta un log nuevo al reiniciar el juego.
- **Contratos y objetivos** — contratos aceptados, completados, fallidos y retirados, con sus objetivos de recogida y entrega.
- **Mejor ruta** — solver exacto hasta 16 paradas y heurística a partir de ahí; respeta recoger antes de entregar y los SCU de tu nave.
- **Confirmación de carga** — marca la carga cuando está en tu bodega.
- **Ganancias de la sesión** — lo ganado en esta sesión y en total.
- Interfaz en **inglés y español**.

## Estado

Desarrollo temprano (`0.x`). El formato del log no está documentado y cambia entre parches. Consulta [el plan del proyecto](docs/PLAN.md).

## Instalar

Descarga `Haulmate-Setup-<versión>.exe` de [Releases](https://github.com/iarmen98/HaulMate/releases) y ejecútalo. Aún no está firmado, así que Windows SmartScreen mostrará un aviso: elige **Más información → Ejecutar de todas formas**. La firma con SignPath Foundation está prevista (ver [ADR 3](docs/adr/0003-desktop-app-with-electron.md)).

## Compilar desde el código

Requisitos: [Node.js](https://nodejs.org/) 20 o superior y pnpm (`corepack enable` o `npm install -g pnpm`).

```bash
git clone https://github.com/iarmen98/HaulMate.git
cd HaulMate
pnpm install
pnpm desktop     # compila y abre la app de escritorio
pnpm package     # genera el instalador en release/
pnpm dev         # versión web en Chrome o Edge, para desarrollo
```

## Cómo se usa

1. Abre Haulmate. Encuentra `StarCitizen\LIVE` en cualquier unidad por sí sola; si no, pulsa **Abrir carpeta del juego** y elígela, por ejemplo `C:\Program Files\Roberts Space Industries\StarCitizen\LIVE`.
2. Acepta contratos de carga en el juego. Aparecen en Haulmate según llegan al log.
3. Elige tu nave en **Ajustes** si Haulmate no la ha detectado y sigue la ruta.
4. Confirma la carga cuando esté en la bodega y copia la siguiente parada en el buscador del mapa estelar.

El juego no registra los SCU de todos los contratos. Cuando una tarjeta te los pida, cópialos de tu mobiGlas. Las recompensas son opcionales; añádelas para ver el pago de la ruta y tus ganancias, ya que las versiones recientes del juego no registran los pagos.

En la versión web, **Probar la demo** carga una sesión de ejemplo y **Abrir archivo Game.log** lee un log una vez cuando el navegador no puede abrir la carpeta.

## Overlay en el juego

La app de escritorio puede mostrar un panel transparente sobre el juego, abajo a la izquierda: siguiente parada, carga que subir o entregar, las paradas siguientes y tus ganancias. No captura clics del ratón, así que el juego sigue funcionando debajo.

- **Mayús+F8** lo muestra u oculta (o el botón de la app).
- **F8** confirma como cargada la carga de la siguiente parada.
- Pon Star Citizen en modo **Ventana sin bordes**; la pantalla completa exclusiva tapa cualquier otra ventana.

## Limitaciones

- De momento solo Windows. La versión web necesita Chrome o Edge para la lectura en directo.
- De momento solo se reconoce el texto del juego en inglés.
- Los contratos aceptados antes del arranque actual del juego están en logs anteriores y no se detectan.
- Las recogidas se nombran a partir de lugares ya vistos; los nuevos aparecen como "Recogida desconocida".
- Los tiempos son estimaciones por tipo de salto (mismo cuerpo, viaje cuántico, salto), no distancias reales. Ajústalos en **Ajustes**.

## Privacidad y juego limpio

Haulmate solo lee `Game.log`. Nunca lee la memoria del juego, no inyecta nada, no captura la pantalla ni envía pulsaciones al juego. Consulta [PRIVACY.md](PRIVACY.md).

## Licencia

[MIT](LICENSE). Las fuentes (Unbounded, Hanken Grotesk, Martian Mono) están bajo SIL Open Font License 1.1.
