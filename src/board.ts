import leaflet from "leaflet";

// Define interfaces for Cell and Coin
interface Cell {
  readonly i: number;
  readonly j: number;
}

interface Coin {
  cell: Cell;
  serial: string;
}

interface Cache {
  cell: Cell;
  coins: Coin[];
  pointValue: number;
}

const caches: Cache[] = [];

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;
  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = `${i},${j}`;
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, { i, j });
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor(point.lat * 1e4);
    const j = Math.floor(point.lng * 1e4);
    return this.getCanonicalCell({ i, j });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const lat = cell.i / 1e4;
    const lng = cell.j / 1e4;
    return leaflet.latLngBounds([
      [lat, lng],
      [lat + this.tileWidth, lng + this.tileWidth],
    ]);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);
    const { i, j } = originCell;

    for (
      let di = -this.tileVisibilityRadius;
      di <= this.tileVisibilityRadius;
      di++
    ) {
      for (
        let dj = -this.tileVisibilityRadius;
        dj <= this.tileVisibilityRadius;
        dj++
      ) {
        const nearbyCell = this.getCanonicalCell({
          i: i + di,
          j: j + dj,
        });
        resultCells.push(nearbyCell);
      }
    }

    return resultCells;
  }

  // Function to create a unique coin
  createCoin(cell: Cell, serial: number): Coin {
    return {
      cell,
      serial: `${cell.i},${cell.j}-${serial}`,
    };
  }

  // Function to spawn a cache at a specific location
  spawnCache(map: leaflet.Map, cell: Cell, coins: Coin[]) {
    const bounds = this.getCellBounds(cell);
    const rect = leaflet.rectangle(bounds);
    rect.addTo(map);

    const pointValue = coins.length;
    const cache = { cell, coins, pointValue };
    caches.push(cache);

    rect.bindPopup(() => {
      const popupDiv = document.createElement("div");
      popupDiv.id = `popup-${cell.i}-${cell.j}`;
      popupDiv.innerHTML = `
        <div>Cache at "${cell.i},${cell.j}". Value: <span id="value">${pointValue}</span></div>
        <button id="collect">Collect</button>
        <button id="deposit">Deposit</button>`;

      popupDiv
        .querySelector<HTMLButtonElement>("#collect")!
        .addEventListener("click", () => {
          collect(cell, coins.length);
        });

      popupDiv
        .querySelector<HTMLButtonElement>("#deposit")!
        .addEventListener("click", () => {
          deposit(cell);
        });

      return popupDiv;
    });
  }
}

// Define the collect function
function collect(cell: Cell, coinCount: number) {
  console.log(`Collected ${coinCount} coins from cell at ${cell.i},${cell.j}`);
}

// Define the deposit function
function deposit(cell: Cell) {
  console.log(`Deposited items at cell ${cell.i},${cell.j}`);
}

// Export interfaces
export type { Cell, Coin };
