import type { BinPoint, RouteStop } from "../../types/bin";

export function createMarkerPopupHtml(data: BinPoint): string {
  return `
    <div class="marker-popup">
      <div class="marker-popup-title">${data.title}</div>
      <div class="marker-popup-details">
        <div class="marker-popup-row">
          <span class="marker-popup-label">Latitude:</span>
          <span class="marker-popup-value">${data.lat.toFixed(5)}</span>
        </div>
        <div class="marker-popup-row">
          <span class="marker-popup-label">Longitude:</span>
          <span class="marker-popup-value">${data.lng.toFixed(5)}</span>
        </div>
        <div class="marker-popup-row">
          <span class="marker-popup-label">Dolu:</span>
          <span class="marker-popup-value">%${data.fill.toFixed(2)}</span>
        </div>
      </div>
      <button id="del-${data.id}" class="marker-delete-btn">
        Sil
      </button>
    </div>
  `;
}

export function createAddMarkerPopupHtml(lat: number, lng: number): string {
  return `
    <div class="popup-container">
      <div class="popup-coords">
        ${lat.toFixed(5)}, ${lng.toFixed(5)}
      </div>
      <div class="popup-field">
        <label class="popup-label">Marker İsmi</label>
        <input 
          id="addTitle" 
          type="text" 
          placeholder="Başlık girin..."
          class="popup-input"
        />
      </div>
      <button id="addMarkerBtn" class="popup-button">
        ✓ Marker Ekle
      </button>
    </div>
  `;
}

export function createRouteStopPopupHtml(stop: RouteStop): string {
  if (stop.type === 'start' || stop.type === 'end') {
    return `<b>Depot (Start/End)</b><br>${stop.title}`;
  }
  return `<b>Stop #${stop.sequence}</b><br>${stop.title}<br>Fill: ${stop.fill_level}%`;
}