// Initialize application header and elements
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Initialize the app
const initializeApp = (title: string) => {
  const app: HTMLDivElement = document.querySelector("#app")!;
  document.title = title;
  const headerElement = document.createElement("h1");
  headerElement.innerHTML = title;
  app.prepend(headerElement);
};
const movementHistory: leaflet.LatLng[] = [];
let movementPolyline: leaflet.Polyline | null = null;

function addToMovementHistory(position: leaflet.LatLng) {
  movementHistory.push(position);

  if (movementPolyline) {
    movementPolyline.setLatLngs(movementHistory); // Update polyline
  } else {
    movementPolyline = leaflet
      .polyline(movementHistory, {
        color: "blue",
        weight: 3,
      })
      .addTo(map); // Add the polyline to the map
  }
}

initializeApp("Geocoin Carrier");

// Constants for map setup, player state, etc.
const CLASSROOM_LOCATION = leaflet.latLng(
  36.98949379578401,
  -122.06277128548504,
);
const INITIAL_ZOOM_LEVEL = 19;
const TILE_UNIT = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_ODDS = 0.1;

// Leaflet map setup
const createMap = (center: leaflet.LatLng) =>
  leaflet.map(document.getElementById("map")!, {
    center,
    zoom: INITIAL_ZOOM_LEVEL,
    minZoom: INITIAL_ZOOM_LEVEL,
    maxZoom: INITIAL_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false,
  });

const map = createMap(CLASSROOM_LOCATION);

// Add tiles to map
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Status panel
const setupStatusPanel = () => {
  const statusPanel: HTMLDivElement = document.querySelector("#statusPanel")!;
  statusPanel.innerHTML = "Player has no coins";
  return statusPanel;
};

const statusPanel = setupStatusPanel();

// Interface definitions
interface CacheDefinition {
  icon: leaflet.Icon;
  template: (coordinates: leaflet.LatLng, treasures: Coin[]) => string;
}

interface GameCache {
  treasures: Coin[];
  markerInstance: leaflet.Marker;
}

interface Coin {
  id: number;
  originalLat: number;
  originalLng: number;
}

interface UserTreasure {
  id: number;
  coordinates: leaflet.LatLng;
  originalLat: number;
  originalLng: number;
}

// Cache and player data
const caches: Map<string, GameCache> = new Map();
const playerTreasures: UserTreasure[] = [];

// Cache manager to save/restore state
class CacheMemento {
  treasures: Coin[];

  constructor(treasures: Coin[]) {
    this.treasures = treasures.map((t) => ({ ...t })); // Deep copy for immutability
  }
}

class CacheManager {
  private cacheStates: Map<string, CacheMemento> = new Map();

  saveCacheState(key: string, cache: GameCache): void {
    this.cacheStates.set(key, new CacheMemento(cache.treasures));
  }

  restoreCacheState(key: string): Coin[] {
    const state = this.cacheStates.get(key);
    return state ? state.treasures : [];
  }
}

const cacheManager = new CacheManager();

// Factory class for creating cache types
class CacheDesign {
  private static types: Map<string, CacheDefinition> = new Map();

  // Create or fetch an existing cache type
  public static fetchCacheType(url: string): CacheDefinition {
    let foundType = CacheDesign.types.get(url);

    if (!foundType) {
      const generatedIcon = CacheDesign.createIcon(url);
      const template = CacheDesign.createTemplate;
      foundType = { icon: generatedIcon, template };

      CacheDesign.types.set(url, foundType);
    }

    return foundType;
  }

  // Centralize icon creation logic
  private static createIcon(url: string): leaflet.Icon {
    return leaflet.icon({
      iconUrl: url,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
    });
  }

  // Centralized template builder for cache popups
  private static createTemplate(
    coordinates: leaflet.LatLng,
    treasures: Coin[],
  ): string {
    // Build treasures list dynamically
    const treasureList = treasures
      .map(
        (coin) =>
          `<li>
            <a href="#" 
               onclick="centerOnHomeCache(${coin.originalLat}, ${coin.originalLng}); return false;">
               ID: ${coin.id}
            </a> - Location: (${
            coin.originalLat.toFixed(
              5,
            )
          }, ${coin.originalLng.toFixed(5)})
          </li>`,
      )
      .join("");

    // Popup HTML template
    return `
      <div id="popup-${coordinates.lat},${coordinates.lng}">
        <p>Cache at (${coordinates.lat.toFixed(5)}, ${
      coordinates.lng.toFixed(
        5,
      )
    })</p>
        <p>Coins: <span id="coin-count-${coordinates.lat},${coordinates.lng}">${treasures.length}</span></p>
        <ul>${treasureList}</ul>
        <button id="add-coin-${coordinates.lat},${coordinates.lng}">Collect Coin</button>
        <button id="remove-coin-${coordinates.lat},${coordinates.lng}">Deposit Coin</button>
      </div>
    `;
  }
}

// Player class for movement logic
class Player {
  position: leaflet.LatLng;
  marker: leaflet.Marker;
  map: leaflet.Map;

  constructor(initialPosition: leaflet.LatLng, mapInstance: leaflet.Map) {
    this.position = initialPosition; // Initialize position
    this.map = mapInstance;

    this.marker = leaflet.marker(this.position).addTo(this.map);
    this.marker.bindTooltip("That's you!");
    addToMovementHistory(this.position); // Log initial spawn position
  }

  move(
    direction: "north" | "south" | "east" | "west",
    granularity: number,
  ): void {
    switch (direction) {
      case "north":
        this.position = leaflet.latLng(
          this.position.lat + granularity,
          this.position.lng,
        );
        break;
      case "south":
        this.position = leaflet.latLng(
          this.position.lat - granularity,
          this.position.lng,
        );
        break;
      case "east":
        this.position = leaflet.latLng(
          this.position.lat,
          this.position.lng + granularity,
        );
        break;
      case "west":
        this.position = leaflet.latLng(
          this.position.lat,
          this.position.lng - granularity,
        );
        break;
    }

    this.marker.setLatLng(this.position);
    this.map.setView(this.position);
    addToMovementHistory(this.position); // Log position
    console.info("Player moved to:", this.position);
  }
}

// Cache regeneration logic
function regenerateCaches(
  playerPosition: leaflet.LatLng,
  vicinity: number,
  tileSize: number,
) {
  caches.forEach((_, cacheKey) => {
    const [lat, lng] = cacheKey.split(",").map(Number);
    const cacheLatLng = leaflet.latLng(lat, lng);
    const distance = calculateDistance(playerPosition, cacheLatLng);

    if (distance > vicinity * tileSize) {
      const cacheToSave = caches.get(cacheKey);
      if (cacheToSave) {
        cacheManager.saveCacheState(cacheKey, cacheToSave);
        map.removeLayer(cacheToSave.markerInstance);
        caches.delete(cacheKey);
      }
    }
  });

  initiateCaches(playerPosition, vicinity, tileSize);
}

function initiateCaches(
  origin: leaflet.LatLng,
  vicinity: number,
  tileSize: number,
) {
  for (let dx = -vicinity; dx <= vicinity; dx++) {
    for (let dy = -vicinity; dy <= vicinity; dy++) {
      const adjustedLat = origin.lat + dx * tileSize;
      const adjustedLng = origin.lng + dy * tileSize;
      const cacheKey = `${adjustedLat},${adjustedLng}`;

      if (!caches.has(cacheKey)) {
        const treasures = cacheManager.restoreCacheState(cacheKey);
        if (treasures.length === 0 && luck(cacheKey) < CACHE_ODDS) {
          const numCoins = Math.floor(luck(cacheKey) * 100) + 1;
          treasures.push(
            ...Array.from({ length: numCoins }, (_, id) => ({
              id,
              originalLat: adjustedLat,
              originalLng: adjustedLng,
            })),
          );
        }

        if (treasures.length > 0) {
          const cacheType = CacheDesign.fetchCacheType(
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
          );

          const marker = leaflet
            .marker(leaflet.latLng(adjustedLat, adjustedLng), {
              icon: cacheType.icon,
            })
            .addTo(map);

          marker.bindPopup(
            cacheType.template(
              leaflet.latLng(adjustedLat, adjustedLng),
              treasures,
            ),
          );
          marker.on(
            "popupopen",
            () => setupPopupListeners(adjustedLat, adjustedLng),
          );

          caches.set(cacheKey, { treasures, markerInstance: marker });
        }
      }
    }
  }
}

// Helper for setting up listeners on cache popups
function setupPopupListeners(lat: number, lng: number) {
  const collectButton = document.getElementById(`add-coin-${lat},${lng}`);
  const depositButton = document.getElementById(`remove-coin-${lat},${lng}`);

  collectButton?.addEventListener("click", () => pickUpCoins(lat, lng));
  depositButton?.addEventListener("click", () => returnCoin(lat, lng));
}

// Function to calculate distance between two points
function calculateDistance(coord1: leaflet.LatLng, coord2: leaflet.LatLng) {
  return coord1.distanceTo(coord2);
}

// Function to collect a coin from a cache
function pickUpCoins(lat: number, lng: number) {
  const cacheKey = `${lat},${lng}`;
  const cache = caches.get(cacheKey);

  if (cache && cache.treasures.length > 0) {
    const coin = cache.treasures.pop(); // Remove a coin from the cache
    if (coin) {
      const userTreasure: UserTreasure = {
        id: coin.id,
        coordinates: leaflet.latLng(lat, lng), // Add coordinates
        originalLat: coin.originalLat,
        originalLng: coin.originalLng,
      };

      playerTreasures.push(userTreasure); // Push to player inventory
      updatePopup(lat, lng);
      statusPanel.innerHTML = `Collected coin #${coin.id} from (${
        lat.toFixed(
          5,
        )
      }, ${lng.toFixed(5)})`;
    }
  }
}

// Function to deposit a coin back into a cache
function returnCoin(lat: number, lng: number) {
  const cacheKey = `${lat},${lng}`;
  const cache = caches.get(cacheKey);

  if (cache && playerTreasures.length > 0) {
    const treasure = playerTreasures.pop(); // Remove the last user treasure
    if (treasure) {
      const coin: Coin = {
        id: treasure.id,
        originalLat: treasure.originalLat,
        originalLng: treasure.originalLng,
      };

      cache.treasures.push(coin); // Add back to the cache
      updatePopup(lat, lng);
      statusPanel.innerHTML = `Deposited coin #${treasure.id} into cache (${
        lat.toFixed(5)
      }, ${lng.toFixed(5)})`;
    }
  }
}
function resetGameState() {
  const confirmed = confirm(
    "Are you sure you want to reset your game state? This action cannot be undone.",
  );
  if (confirmed) {
    localStorage.removeItem("geocoinGameState"); // Clear saved data
    movementHistory.length = 0; // Clear movement history
    if (movementPolyline) {
      movementPolyline.remove(); // Remove the polyline from the map
      movementPolyline = null;
    }
    caches.clear(); // Clear caches
    initiateCaches(CLASSROOM_LOCATION, NEIGHBORHOOD_SIZE, TILE_UNIT); // Reset caches
    playerTreasures.length = 0; // Reset treasures
    player.position = CLASSROOM_LOCATION; // Reset player position
    player.marker.setLatLng(CLASSROOM_LOCATION);
    map.setView(CLASSROOM_LOCATION);

    alert("Game state has been reset.");
  }
}
// Helper for updating cache popups
function updatePopup(lat: number, lng: number) {
  const cacheKey = `${lat},${lng}`;
  const cache = caches.get(cacheKey);

  if (cache) {
    const updatedContent = `
      <p>Cache at (${lat.toFixed(5)}, ${lng.toFixed(5)})</p>
      <p>Coins: <span id="coin-count-${lat},${lng}">${cache.treasures.length}</span></p>
    `;
    const popup = cache.markerInstance.getPopup();
    if (popup) popup.setContent(updatedContent);
  }
}

// Initialize map, player, and caches
const player = new Player(CLASSROOM_LOCATION, map);
initiateCaches(CLASSROOM_LOCATION, NEIGHBORHOOD_SIZE, TILE_UNIT);
let geoWatchId: number | null = null;

// Start geolocation tracking
function startGeolocationTracking() {
  if (geoWatchId !== null) return; // Prevent duplicate tracking
  if ("geolocation" in navigator) {
    geoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        const newLocation = leaflet.latLng(lat, lng);
        player.position = newLocation;
        player.marker.setLatLng(player.position);
        map.setView(player.position); // Center on the player's position
        regenerateCaches(player.position, NEIGHBORHOOD_SIZE, TILE_UNIT); // Regenerate caches for new location
        addToMovementHistory(newLocation); // Add to movement log
      },
      (error) => console.warn("Geolocation error:", error.message),
      { enableHighAccuracy: true },
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
}

// Stop geolocation tracking
function stopGeolocationTracking() {
  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
}
// Keyboard listener for player movement
document.addEventListener("keydown", (e) => {
  const MOVEMENT_UNIT = TILE_UNIT;
  switch (e.key) {
    case "ArrowUp":
      player.move("north", MOVEMENT_UNIT);

      break;
    case "ArrowDown":
      player.move("south", MOVEMENT_UNIT);
      break;
    case "ArrowLeft":
      player.move("west", MOVEMENT_UNIT);
      break;
    case "ArrowRight":
      player.move("east", MOVEMENT_UNIT);
      break;
  }
  regenerateCaches(player.position, NEIGHBORHOOD_SIZE, TILE_UNIT);
});
document.getElementById("geoButton")?.addEventListener("click", () => {
  if (geoWatchId === null) {
    startGeolocationTracking();
    alert("Geolocation tracking started.");
  } else {
    stopGeolocationTracking();
    alert("Geolocation tracking stopped.");
  }
});
document
  .getElementById("resetButton")
  ?.addEventListener("click", resetGameState);
