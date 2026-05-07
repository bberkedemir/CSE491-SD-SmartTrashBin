import type { BinPoint, RoadAnomaly, RouteStop } from "../../types/bin";

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
      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button id="collect-${data.id}" class="marker-collect-btn" style="flex: 1; background: #2ed573; color: white; border: none; border-radius: 4px; padding: 6px; cursor: pointer; font-weight: bold;">
          Topla
        </button>
        <button id="throw-${data.id}" class="marker-throw-btn" style="flex: 1; background: #ffa502; color: white; border: none; border-radius: 4px; padding: 6px; cursor: pointer; font-weight: bold;">
          At
        </button>
        <button id="del-${data.id}" class="marker-delete-btn" style="flex: 1;">
          Sil
        </button>
      </div>
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

export function createRoadAnomalyPopupHtml(anomaly: RoadAnomaly): string {
  const imageHtml = anomaly.image_url
    ? `<img class="road-anomaly-popup-image" src="${anomaly.image_url}" alt="Road anomaly crop" />`
    : `<div class="road-anomaly-popup-empty">No image available</div>`;

  return `
    <div class="road-anomaly-popup">
      <div class="road-anomaly-popup-title">Road Anomaly</div>
      ${imageHtml}
      <div class="marker-popup-details">
        <div class="marker-popup-row">
          <span class="marker-popup-label">Class:</span>
          <span class="marker-popup-value">${anomaly.class_name}</span>
        </div>
        <div class="marker-popup-row">
          <span class="marker-popup-label">Confidence:</span>
          <span class="marker-popup-value">${Math.round(anomaly.confidence * 100)}%</span>
        </div>
        <div class="marker-popup-row">
          <span class="marker-popup-label">Video time:</span>
          <span class="marker-popup-value">${anomaly.timestamp_seconds.toFixed(1)}s</span>
        </div>
        <div class="marker-popup-row">
          <span class="marker-popup-label">Latitude:</span>
          <span class="marker-popup-value">${anomaly.latitude?.toFixed(5) ?? '-'}</span>
        </div>
        <div class="marker-popup-row">
          <span class="marker-popup-label">Longitude:</span>
          <span class="marker-popup-value">${anomaly.longitude?.toFixed(5) ?? '-'}</span>
        </div>
      </div>
    </div>
  `;
}
