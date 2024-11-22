// Initialize application header and elements
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

const initializeApp = (title: string) => {
  const app: HTMLDivElement = document.querySelector("#app")!;
  document.title = title;
  const headerElement = document.createElement("h1");
  headerElement.innerHTML = title;
  app.prepend(headerElement);
};

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

// Map creation using Leaflet
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

// Layer addition for the map
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Player marker
// Initialize player position (saved or default)
const playerPosition = leaflet.latLng(
  Number(localStorage.getItem("playerLat")) || CLASSROOM_LOCATION.lat,
  Number(localStorage.getItem("playerLng")) || CLASSROOM_LOCATION.lng,
);

// Player marker
const initPlayerMarker = (position: leaflet.LatLng) => {
  const marker = leaflet.marker(position);
  marker.bindTooltip("That's you!");
  marker.addTo(map);
  return marker; // Return the marker reference
};

const playerMarker = initPlayerMarker(playerPosition);

// Status feedback panel for players
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

// Manage and maintain caches and player inventory
const caches: Map<string, GameCache> = new Map();
const playerTreasures: UserTreasure[] = [];

// Factory class for creating cache definitions
class CacheDesign {
  private static types: Map<string, CacheDefinition> = new Map();

  public static fetchCacheType(url: string): CacheDefinition {
    let foundType = CacheDesign.types.get(url);
    if (!foundType) {
      const generatedIcon = leaflet.icon({
        iconUrl: url,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
      });

      const template = (coordinates: leaflet.LatLng, treasures: Coin[]) => `
        <div id="popup-${coordinates.lat},${coordinates.lng}">
          <p>Cache at (${coordinates.lat.toFixed(5)}, ${
        coordinates.lng.toFixed(
          5,
        )
      })</p>
          <p>Coins: <span id="coin-count-${coordinates.lat},${coordinates.lng}">${treasures.length}</span></p>
          <div class="scroll-container">
            <ul>${
        treasures
          .map(
            (coin) =>
              `<li>ID: ${coin.id} - Location: (${
                coin.originalLat.toFixed(
                  5,
                )
              }, ${coin.originalLng.toFixed(5)})</li>`,
          )
          .join("")
      }</ul>
          </div>
          <button id="add-coin-${coordinates.lat},${coordinates.lng}">Collect Coin</button>
          <button id="remove-coin-${coordinates.lat},${coordinates.lng}">Deposit Coin</button>
        </div>
      `;

      foundType = { icon: generatedIcon, template };
      CacheDesign.types.set(url, foundType);
    }

    return foundType;
  }
}

// Cache generation process
const initiateCaches = (
  origin: leaflet.LatLng,
  vicinity: number,
  tileSize: number,
) => {
  for (let dx = -vicinity; dx <= vicinity; dx++) {
    for (let dy = -vicinity; dy <= vicinity; dy++) {
      const adjustedLat = origin.lat + dx * tileSize;
      const adjustedLng = origin.lng + dy * tileSize;
      const cachePosition = `${adjustedLat},${adjustedLng}`;

      if (!caches.has(cachePosition)) {
        const probability = luck(cachePosition);
        if (probability < CACHE_ODDS) {
          const numOfCoins = Math.floor(
            luck([adjustedLat, adjustedLng, "init"].toString()) * 100,
          ) + 1;
          const coins: Coin[] = Array.from(
            { length: numOfCoins },
            (_, idx) => ({
              id: idx,
              originalLat: adjustedLat,
              originalLng: adjustedLng,
            }),
          );

          const cacheDef = CacheDesign.fetchCacheType(
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
          );
          const newMarker = leaflet
            .marker(leaflet.latLng(adjustedLat, adjustedLng), {
              icon: cacheDef.icon,
            })
            .addTo(map);

          newMarker.bindPopup(
            cacheDef.template(leaflet.latLng(adjustedLat, adjustedLng), coins),
          );

          newMarker.on("popupopen", () => {
            const collectButton = document.getElementById(
              `add-coin-${adjustedLat},${adjustedLng}`,
            );
            const depositButton = document.getElementById(
              `remove-coin-${adjustedLat},${adjustedLng}`,
            );

            collectButton?.addEventListener("click", () => {
              pickUpCoins(adjustedLat, adjustedLng);
            });

            depositButton?.addEventListener("click", () => {
              if (playerTreasures.length > 0) {
                returnCoin(adjustedLat, adjustedLng);
              }
            });
          });

          caches.set(cachePosition, {
            treasures: coins,
            markerInstance: newMarker,
          });
        }
      }
    }
  }
};

// Function to refresh cache popup content
function updatePopup(lat: number, lng: number) {
  const cacheKey = `${lat},${lng}`;
  const activeCache = caches.get(cacheKey);

  if (activeCache) {
    const newPopup = `
      <p>Cache located at (${lat.toFixed(5)}, ${lng.toFixed(5)})</p>
      <p>Coins: <span id="coin-count-${lat},${lng}">${activeCache.treasures.length}</span></p>
      <div class="scroll-container">
        <ul>${
      activeCache.treasures
        .map(
          (coin) =>
            `<li>ID: ${coin.id} - Location: (${
              coin.originalLat.toFixed(
                5,
              )
            }, ${coin.originalLng.toFixed(5)})</li>`,
        )
        .join("")
    }</ul>
      </div>
      <button id="add-coin-${lat},${lng}">Collect Coin</button>
      <button id="remove-coin-${lat},${lng}">Deposit Coin</button>
    `;
    const currentPop = activeCache.markerInstance.getPopup();
    if (!currentPop) {
      activeCache.markerInstance.bindPopup(newPopup).openPopup();
    } else {
      currentPop.setContent(newPopup);
    }
  }
}

// Player interaction functions
function pickUpCoins(lat: number, lng: number) {
  const cacheKey = `${lat},${lng}`;
  const activeCache = caches.get(cacheKey);

  if (activeCache && activeCache.treasures.length > 0) {
    const coin = activeCache.treasures.pop(); // Retrieve a coin from the cache

    if (coin) {
      playerTreasures.push({
        id: coin.id,
        coordinates: leaflet.latLng(lat, lng),
        originalLat: coin.originalLat,
        originalLng: coin.originalLng,
      });

      updatePopup(lat, lng); // Update popup content dynamically
      statusPanel.innerHTML = `Collected coin #${coin.id} from (${
        lat.toFixed(
          5,
        )
      }, ${lng.toFixed(5)})`;

      console.info(
        `Coins left in cache (${lat}, ${lng}):`,
        activeCache.treasures,
      );
      console.info("Player's Coin Inventory:", playerTreasures);

      const countDisplay = document.getElementById(`coin-count-${lat},${lng}`);
      if (countDisplay) {
        countDisplay.textContent = `${activeCache.treasures.length}`;
      }
    }
  }
}

// Function to deposit a coin from the user's inventory into the designated cache
function returnCoin(lat: number, lng: number) {
  const positionKey = `${lat},${lng}`;
  const currentCache = caches.get(positionKey);

  if (!currentCache || playerTreasures.length === 0) {
    statusPanel.innerHTML = "No coins available for deposit!";
    return;
  }

  // Extract the last coin from the user's inventory
  const userCoinIndex = playerTreasures.length - 1;
  const coinToDeposit = playerTreasures.splice(userCoinIndex, 1)[0];

  // Adding the extracted user coin back into the cache
  const { treasures: cacheCoins, markerInstance: marker } = currentCache;
  cacheCoins.push({
    id: coinToDeposit.id,
    originalLat: coinToDeposit.originalLat,
    originalLng: coinToDeposit.originalLng,
  });

  // Update UI elements and status
  refreshPopupUI(lat, lng, marker.getPopup(), cacheCoins);
  statusPanel.innerHTML = `Deposited coin #${coinToDeposit.id} into cache at (${
    lat.toFixed(5)
  }, ${lng.toFixed(5)})`;

  // Console log for debugging
  console.info(
    `Cache (${lat}, ${lng}) updated with deposited coin. Current cache:`,
    cacheCoins,
  );
  console.info("Updated User Coins:", playerTreasures);

  // Update coin count in DOM
  updateCoinCountDisplay(lat, lng, cacheCoins.length);
}

// Helper function to refresh popup UI content
function refreshPopupUI(
  lat: number,
  lng: number,
  popup: leaflet.Popup,
  cacheCoins: Coin[],
) {
  const refreshedContent = `
    <p>Cache at (${lat.toFixed(5)}, ${lng.toFixed(5)})</p>
    <p>Coins: <span id="coin-count-${lat},${lng}">${cacheCoins.length}</span></p>
    <div class="scroll-container">
      <ul>${
    cacheCoins
      .map(
        (coin) =>
          `<li>Serial: ${coin.id} - Location: (${
            coin.originalLat.toFixed(
              5,
            )
          }, ${coin.originalLng.toFixed(5)})</li>`,
      )
      .join("")
  }</ul>
    </div>
    <button id="add-coin-${lat},${lng}">Collect Coin</button>
    <button id="remove-coin-${lat},${lng}">Deposit Coin</button>
  `;

  popup.setContent(refreshedContent);
}

// Helper function to update the coin count display in DOM
function updateCoinCountDisplay(lat: number, lng: number, coinCount: number) {
  const coinCountElem = document.getElementById(`coin-count-${lat},${lng}`);
  if (coinCountElem) {
    coinCountElem.textContent = `${coinCount}`;
  }
}
// Movement mechanics: Add discrete player movements using arrow keys
// Initialize player position (saved or default)

// Movement mechanics: Add discrete player movements using arrow keys
document.addEventListener("keydown", (event) => {
  const MOVE_STEP = TILE_UNIT; // Step size for movement
  let newLat = playerPosition.lat;
  let newLng = playerPosition.lng;

  switch (event.key) {
    case "ArrowUp":
      newLat += MOVE_STEP;
      break;
    case "ArrowDown":
      newLat -= MOVE_STEP;
      break;
    case "ArrowLeft":
      newLng -= MOVE_STEP;
      break;
    case "ArrowRight":
      newLng += MOVE_STEP;
      break;
    default:
      return; // Exit if any other key is pressed
  }

  // Update player position
  playerPosition.lat = newLat;
  playerPosition.lng = newLng;
  playerMarker.setLatLng(playerPosition);
  map.panTo(playerPosition);

  // Save player position to localStorage for persistence
  localStorage.setItem("playerLat", String(newLat));
  localStorage.setItem("playerLng", String(newLng));

  // Update status panel
  statusPanel.innerHTML = `Player moved to (${
    newLat.toFixed(
      5,
    )
  }, ${newLng.toFixed(5)})`;
});
// Begin the cache generation process
initiateCaches(CLASSROOM_LOCATION, NEIGHBORHOOD_SIZE, TILE_UNIT);
