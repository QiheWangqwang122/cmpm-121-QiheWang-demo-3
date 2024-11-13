// Import necessary modules
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Define interfaces for Cell and Coin
interface Cell {
  readonly i: number;
  readonly j: number;
}

interface Coin {
  cell: Cell;
  serial: string;
}

// Cell storage using Flyweight pattern
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
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Initialize map
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Add background tile layer
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

// Status panel setup
let playerPoints = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

// Player inventory to store collected coins
const playerInventory: Coin[] = [];

// Cache storage
const caches: { cell: Cell; coins: Coin[]; pointValue: number }[] = [];

// Function to collect a coin from a cache
function collect(cell: Cell, coinId: string) {
  // Find the cache at the given cell
  const cache = caches.find((c) => c.cell.i === cell.i && c.cell.j === cell.j);
  if (cache && cache.pointValue > 0) {
    const coin: Coin = { cell, serial: coinId };
    playerInventory.push(coin);
    playerPoints = playerInventory.length;
    statusPanel.innerHTML = `${playerPoints} points accumulated`;

    // Decrease the cache's value
    cache.pointValue -= 1;
    updateCachePopup(cache);
  } else {
    console.log("No coins to collect or cache value is zero");
  }
}

// Function to deposit a coin into a cache
function deposit(cell: Cell) {
  if (playerInventory.length > 0) {
    const coin = playerInventory.pop();
    if (coin) {
      playerPoints = playerInventory.length;
      statusPanel.innerHTML = `${playerPoints} points accumulated`;

      // Find the cache at the given cell and add the coin to its inventory
      const cache = caches.find(
        (c) => c.cell.i === cell.i && c.cell.j === cell.j,
      );
      if (cache) {
        cache.coins.push(coin);
        cache.pointValue += 1; // Increment the cache's value
        updateCachePopup(cache);
        console.log(
          `Deposited coin ${coin.serial} into cache at cell ${cell.i},${cell.j}`,
        );
      }
    }
  } else {
    console.log("No coins to deposit");
  }
}

// Function to update the cache popup with the current value
function updateCachePopup(cache: {
  cell: Cell;
  coins: Coin[];
  pointValue: number;
}) {
  const popupDiv = document.querySelector<HTMLDivElement>(
    `#popup-${cache.cell.i}-${cache.cell.j}`,
  );
  if (popupDiv) {
    const valueSpan = popupDiv.querySelector<HTMLSpanElement>("#value");
    if (valueSpan) {
      valueSpan.innerHTML = cache.pointValue.toString();
    }
  }
}
// Function to spawn a cache at a specific location
function spawnCache(i: number, j: number) {
  const cell = getCell(i, j);
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

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  let coinCount = 0;
  const pointValue = Math.floor(
    luck([cell.i, cell.j, "initialValue"].toString()) * 100,
  );

  const cache = { cell, coins: [], pointValue };
  caches.push(cache);

  rect.bindPopup(() => {
    const coinId = `${cell.i}:${cell.j}#${coinCount}`;
    const popupDiv = document.createElement("div");
    popupDiv.id = `popup-${cell.i}-${cell.j}`;
    popupDiv.innerHTML = `
      <div>Cache at "${cell.i},${cell.j}". Value: <span id="value">${pointValue}</span></div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>`;

    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        collect(cell, coinId);
        coinCount++;
      });

    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        deposit(cell);
      });

    return popupDiv;
  });
}

// Look around the player's neighborhood for caches to spawn
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
