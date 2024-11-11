// Import necessary modules
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Cell interface
interface Cell {
  readonly i: number;
  readonly j: number;
}

// Cell storage using Flyweight pattern (without a class)
const cellCache: Map<string, Cell> = new Map();

// Function to retrieve or create a unique cell
function getCell(i: number, j: number): Cell {
  const key = `${i}:${j}`;
  if (!cellCache.has(key)) {
    cellCache.set(key, { i, j });
  }
  return cellCache.get(key)!;
}

// Set initial parameters
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Initialize map
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Add a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Player setup
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let playerPoints = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

// Function to spawn a cache at a specific location
function spawnCache(i: number, j: number) {
  const cell = getCell(i, j); // Use Flyweight pattern for unique cells
  const bounds = leaflet.latLngBounds([
    [
      OAKES_CLASSROOM.lat + cell.i * TILE_DEGREES,
      OAKES_CLASSROOM.lng + cell.j * TILE_DEGREES,
    ],
    [
      OAKES_CLASSROOM.lat + (cell.i + 1) * TILE_DEGREES,
      OAKES_CLASSROOM.lng + (cell.j + 1) * TILE_DEGREES,
    ],
  ]);

  // Add cache rectangle to the map
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Track each coin's unique identifier
  let coinCount = 0;

  rect.bindPopup(() => {
    const coinId = `${cell.i}:${cell.j}#${coinCount}`;
    let pointValue = Math.floor(
      luck([cell.i, cell.j, "initialValue"].toString()) * 100,
    );

    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
        <div>Cache at "${cell.i},${cell.j}" with value: <span id="value">${pointValue}</span></div>
        <div>Coin ID: ${coinId}</div>
        <button id="poke">poke</button>`;

    popupDiv
      .querySelector<HTMLButtonElement>("#poke")!
      .addEventListener("click", () => {
        pointValue--;
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          pointValue.toString();
        playerPoints++;
        statusPanel.innerHTML = `${playerPoints} points accumulated`;
        coinCount++;
      });

    return popupDiv;
  });
}

// Generate nearby caches based on probability
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
