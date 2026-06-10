/* ============================================================
   PictureGPS Map – Application Logic
   ============================================================
   ไลบรารีที่ใช้ (โหลดผ่าน CDN):
   - Leaflet 1.9.4  : แสดงแผนที่
   - exifr 7.1.3    : อ่าน EXIF / GPS จากรูปภาพ
   - html2canvas    : บันทึกแผนที่เป็นไฟล์รูป
   ============================================================ */

"use strict";

/* ─────────────────────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────────────────────── */
// ── tile layers ──────────────────────────────────────────
const TILE_LAYERS = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    label: "\ud83d\udee3\ufe0f \u0e16\u0e19\u0e19",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles \u00a9 Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
    label:
      "\ud83d\udef0\ufe0f \u0e14\u0e32\u0e27\u0e40\u0e17\u0e35\u0e22\u0e21",
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
    label:
      "\ud83c\udfd4\ufe0f \u0e20\u0e39\u0e21\u0e34\u0e1b\u0e23\u0e30\u0e40\u0e17\u0e28",
  },
};

const LAYER_ORDER = ["street", "satellite", "terrain"];

const State = {
  photos: [], // PhotoData[]
  map: null, // L.Map instance
  markers: [], // L.Marker[]
  polyline: null, // L.Polyline
  tileLayer: null, // L.TileLayer
  currentLayer: "street", // 'street' | 'satellite' | 'terrain'
  selectedId: null, // currently selected photo ID
  nextId: 1,
  timelineIndex: 0,
};

/* ─────────────────────────────────────────────────────────────
   DOM REFERENCES
   ───────────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const DOM = {
  uploadZone: $("upload-zone"),
  dropArea: $("drop-area"),
  fileInput: $("file-input"),
  btnUpload: $("btn-upload"),
  btnAddMore: $("btn-add-more"),
  btnClear: $("btn-clear"),
  btnSaveMap: $("btn-save-map"),
  btnFitBounds: $("btn-fit-bounds"),
  btnLayerToggle: $("btn-layer-toggle"),
  appContent: $("app-content"),
  photoList: $("photo-list"),
  photoCount: $("photo-count-badge"),
  routeStats: $("route-stats"),
  routeDistance: $("route-distance"),
  routeTimerange: $("route-timerange"),
  alertNoGps: $("alert-no-gps"),
  alertNoGpsTxt: $("alert-no-gps-text"),
  loadingOverlay: $("loading-overlay"),
  loadingText: $("loading-text"),
  headerStats: $("header-stats"),
  timelineBar: $("timeline-bar"),
  timelineSlider: $("timeline-slider"),
  tlThumb: $("tl-thumb"),
  tlBadge: $("tl-badge"),
  tlInfo: $("tl-info"),
  tlCounter: $("tl-counter"),
  btnTlPrev: $("btn-tl-prev"),
  btnTlNext: $("btn-tl-next"),
  btnExportGpx: $("btn-export-gpx"),
  btnExportKml: $("btn-export-kml"),
};

/* ─────────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
});

/* ─────────────────────────────────────────────────────────────
   EVENT LISTENERS
   ───────────────────────────────────────────────────────────── */
function setupEventListeners() {
  DOM.btnUpload.addEventListener("click", () => DOM.fileInput.click());
  DOM.btnAddMore.addEventListener("click", () => DOM.fileInput.click());
  DOM.fileInput.addEventListener("change", onFileInputChange);
  DOM.btnClear.addEventListener("click", clearAll);
  DOM.btnSaveMap.addEventListener("click", saveMapAsImage);
  DOM.btnFitBounds.addEventListener("click", fitMapToMarkers);
  $("btn-layer-toggle").addEventListener("click", toggleLayer);

  DOM.timelineSlider.addEventListener("input", onTimelineSlide);
  DOM.btnTlPrev.addEventListener("click", () => moveTimeline(-1));
  DOM.btnTlNext.addEventListener("click", () => moveTimeline(1));
  DOM.btnExportGpx.addEventListener("click", exportGPX);
  DOM.btnExportKml.addEventListener("click", exportKML);

  // Drag-and-drop บน drop area
  const da = DOM.dropArea;
  da.addEventListener("dragenter", (e) => {
    e.preventDefault();
    da.classList.add("drag-over");
  });
  da.addEventListener("dragover", (e) => {
    e.preventDefault();
    da.classList.add("drag-over");
  });
  da.addEventListener("dragleave", () => {
    da.classList.remove("drag-over");
  });
  da.addEventListener("drop", (e) => {
    e.preventDefault();
    da.classList.remove("drag-over");
    handleDroppedFiles(e.dataTransfer.files);
  });

  // Drag-and-drop ทั่วทั้งหน้าเมื่อแอปเปิดแล้ว
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!DOM.appContent.classList.contains("hidden")) {
      handleDroppedFiles(e.dataTransfer.files);
    }
  });

  // resize window → แจ้ง Leaflet ปรับขนาด
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      State.map?.invalidateSize();
    }, 150);
  });
}

function onFileInputChange(e) {
  const files = Array.from(e.target.files);
  if (files.length) processFiles(files);
  e.target.value = ""; // reset เพื่อให้เลือกไฟล์เดิมซ้ำได้
}

function handleDroppedFiles(fileList) {
  const images = Array.from(fileList).filter((f) =>
    f.type.startsWith("image/"),
  );
  if (images.length) processFiles(images);
}

/* ─────────────────────────────────────────────────────────────
   CORE PIPELINE
   ───────────────────────────────────────────────────────────── */
async function processFiles(files) {
  showLoading(`กำลังอ่าน metadata จาก ${files.length} รูปภาพ...`);

  try {
    // อ่าน EXIF ทุกรูปพร้อมกัน
    const parsed = await Promise.all(files.map(parsePhoto));
    parsed.forEach((p) => State.photos.push(p));

    // เรียงลำดับตามเวลาถ่าย และตั้งเลขลำดับ
    sortAndReindex();

    // ── แสดง content ก่อน เพื่อให้ #map มีขนาดจริง ──
    const isFirstLoad = DOM.appContent.classList.contains("hidden");
    if (isFirstLoad) {
      DOM.uploadZone.classList.add("hidden");
      DOM.appContent.classList.remove("hidden");
      DOM.btnClear.classList.remove("hidden");
      // รอให้ browser paint layout จริง ก่อน Leaflet อ่านขนาด container
      // ต้องรอ 2 frames: frame แรก = schedule repaint, frame สอง = painted
      await waitForPaint();
    }

    // อัปเดต sidebar ก่อน (ไม่ขึ้นกับแผนที่)
    renderSidebar();
    renderHeaderStats();

    // สร้าง map ครั้งแรก (ต้อง init หลัง container มี height)
    if (!State.map) {
      initMap();
    } else {
      State.map.invalidateSize();
    }

    // วาง markers + routing line
    refreshMap();
    initTimeline();

    // รอให้ tile โหลดแล้วค่อย fit bounds
    setTimeout(fitMapToMarkers, 400);
  } catch (err) {
    console.error("[processFiles]", err);
    alert("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ กรุณาลองใหม่อีกครั้ง");
  } finally {
    hideLoading();
  }
}

/** รอให้ browser paint 2 frames (ใช้แก้ Leaflet init บน hidden container) */
function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/* ─────────────────────────────────────────────────────────────
   EXIF PARSING
   ───────────────────────────────────────────────────────────── */
async function parsePhoto(file) {
  const id = State.nextId++;
  const objectUrl = URL.createObjectURL(file);
  let displayUrl = objectUrl; // สำหรับแสดงผล (อาจถูกแทนด้วย JPEG thumbnail สำหรับ HEIC)
  let exif = null;
  let gps = null;
  let dateTime = null;

  try {
    if (typeof exifr === "undefined") {
      throw new Error("ไลบรารี exifr ยังไม่ได้โหลด");
    }

    exif = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      ifd1: true, // ต้องใช้ ifd1 เพื่ออ่าน thumbnail
      xmp: false,
      icc: false,
      iptc: false,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
      sanitize: true,
      mergeOutput: true,
    });

    if (exif) {
      // ──── GPS ────
      if (exif.latitude != null && exif.longitude != null) {
        gps = {
          latitude: exif.latitude,
          longitude: exif.longitude,
          altitude: exif.GPSAltitude ?? null,
        };
      }

      // ──── DateTime ────
      const rawDt =
        exif.DateTimeOriginal ?? exif.DateTime ?? exif.DateTimeDigitized;
      if (rawDt) {
        const d = rawDt instanceof Date ? rawDt : new Date(rawDt);
        if (!isNaN(d.getTime())) dateTime = d;
      }
    }

    // ──── HEIC/HEIF: แปลงเป็น JPEG เพื่อให้ browser แสดงได้ ────
    // Chrome/Firefox ไม่รองรับ HEIC natively
    const isHeic =
      /\.(heic|heif)$/i.test(file.name) ||
      file.type === "image/heic" ||
      file.type === "image/heif";

    if (isHeic) {
      let converted = false;

      // วิธี 1 (เร็ว): ดึง embedded JPEG thumbnail จาก EXIF IFD1
      try {
        const thumbBuf = await exifr.thumbnail(file);
        if (thumbBuf && thumbBuf.length > 0) {
          displayUrl = URL.createObjectURL(
            new Blob([thumbBuf], { type: "image/jpeg" }),
          );
          converted = true;
        }
      } catch (_) {
        /* silent */
      }

      // วิธี 2 (fallback): ใช้ heic2any แปลงเต็มไฟล์ (ช้ากว่าแต่ต้องการ internet)
      if (!converted && typeof heic2any !== "undefined") {
        try {
          const result = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.75,
          });
          const blob = Array.isArray(result) ? result[0] : result;
          displayUrl = URL.createObjectURL(blob);
        } catch (e) {
          console.warn(`[heic2any] ${file.name}:`, e.message);
        }
      }
    }
  } catch (err) {
    console.warn(`[EXIF] ${file.name}:`, err.message);
  }

  return {
    id,
    file,
    objectUrl,
    displayUrl, // ใช้อันนี้ในทุก <img src> (JPEG thumbnail สำหรับ HEIC, เหมือน objectUrl สำหรับสกุลอื่น)
    exif,
    gps,
    dateTime,
    orderIndex: null,
    marker: null,
    hasGPS: gps !== null,
  };
}

/* ─────────────────────────────────────────────────────────────
   SORTING
   ───────────────────────────────────────────────────────────── */
function sortAndReindex() {
  State.photos.sort((a, b) => {
    if (a.dateTime && b.dateTime) return a.dateTime - b.dateTime;
    if (a.dateTime) return -1;
    if (b.dateTime) return 1;
    return a.file.name.localeCompare(b.file.name);
  });
  State.photos.forEach((p, i) => {
    p.orderIndex = i + 1;
  });
}

/* ─────────────────────────────────────────────────────────────
   MAP
   ───────────────────────────────────────────────────────────── */
function initMap() {
  State.map = L.map("map", {
    zoomControl: true,
    preferCanvas: false,
  }).setView([13.7563, 100.5018], 10); // default: กรุงเทพ

  const cfg = TILE_LAYERS[State.currentLayer];
  State.tileLayer = L.tileLayer(cfg.url, {
    attribution: cfg.attribution,
    maxZoom: cfg.maxZoom,
    crossOrigin: "anonymous",
  }).addTo(State.map);
}

function toggleLayer() {
  if (!State.map) return;
  const idx = LAYER_ORDER.indexOf(State.currentLayer);
  State.currentLayer = LAYER_ORDER[(idx + 1) % LAYER_ORDER.length];
  const cfg = TILE_LAYERS[State.currentLayer];

  if (State.tileLayer) State.map.removeLayer(State.tileLayer);
  State.tileLayer = L.tileLayer(cfg.url, {
    attribution: cfg.attribution,
    maxZoom: cfg.maxZoom,
    crossOrigin: "anonymous",
  }).addTo(State.map);
  State.tileLayer.bringToBack();

  // ปุ่มแสดง layer ถัดไปในวงจร
  const nextLayer =
    LAYER_ORDER[
      (LAYER_ORDER.indexOf(State.currentLayer) + 1) % LAYER_ORDER.length
    ];
  DOM.btnLayerToggle.textContent = TILE_LAYERS[nextLayer].label;
}

function refreshMap() {
  // ลบ markers เดิม
  State.markers.forEach((m) => State.map.removeLayer(m));
  State.markers = [];
  State.photos.forEach((p) => {
    p.marker = null;
  });

  // ลบ polyline เดิม
  if (State.polyline) {
    State.map.removeLayer(State.polyline);
    State.polyline = null;
  }

  const gpsPhotos = State.photos.filter((p) => p.hasGPS);
  if (!gpsPhotos.length) return;

  // วาง markers
  gpsPhotos.forEach((photo) => {
    const m = buildMarker(photo);
    m.addTo(State.map);
    State.markers.push(m);
    photo.marker = m;
  });

  // วาด routing polyline ถ้ามี >= 2 จุด
  if (gpsPhotos.length >= 2) {
    const coords = gpsPhotos.map((p) => [p.gps.latitude, p.gps.longitude]);
    State.polyline = L.polyline(coords, {
      color: "#E50914",
      weight: 3,
      opacity: 0.9,
      dashArray: "6 9",
      lineCap: "round",
      lineJoin: "round",
    }).addTo(State.map);
  }
}

function buildMarker(photo) {
  const isSelected = State.selectedId === photo.id;
  const icon = makeNumberIcon(photo.orderIndex, isSelected);

  const m = L.marker([photo.gps.latitude, photo.gps.longitude], { icon }).on(
    "click",
    () => selectPhoto(photo.id),
  );

  m.bindPopup(buildPopupHTML(photo), {
    maxWidth: 290,
    className: "dark-popup",
  });

  return m;
}

function makeNumberIcon(num, selected = false) {
  return L.divIcon({
    className: "custom-marker-container",
    html: `<div class="marker-pin${selected ? " selected" : ""}"><span class="marker-number">${num}</span></div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -44],
  });
}

function buildPopupHTML(photo) {
  const date = photo.dateTime
    ? fmtDateTime(photo.dateTime)
    : "ไม่มีข้อมูลวันที่";
  const lat = photo.gps?.latitude.toFixed(6) ?? "-";
  const lng = photo.gps?.longitude.toFixed(6) ?? "-";
  const alt =
    photo.gps?.altitude != null
      ? `${photo.gps.altitude.toFixed(1)} เมตร`
      : null;
  const cam =
    [photo.exif?.Make, photo.exif?.Model].filter(Boolean).join(" ") || null;

  return `
    <div class="popup-content">
      <div class="popup-thumb-wrap">
        <img src="${photo.displayUrl}" class="popup-thumb" alt=""
             onerror="this.parentElement.style.display='none'">
        <div class="popup-badge">${photo.orderIndex}</div>
      </div>
      <div class="popup-info">
        <div class="popup-filename">${escHtml(photo.file.name)}</div>
        <div class="popup-row"><span>📅</span><span>${date}</span></div>
        <div class="popup-row"><span>📍</span><span>${lat}, ${lng}</span></div>
        ${alt ? `<div class="popup-row"><span>⛰️</span><span>${alt}</span></div>` : ""}
        ${cam ? `<div class="popup-row"><span>📷</span><span>${escHtml(cam)}</span></div>` : ""}
      </div>
    </div>`;
}

function fitMapToMarkers() {
  const pts = State.photos.filter((p) => p.hasGPS);
  if (!pts.length || !State.map) return;

  if (pts.length === 1) {
    State.map.setView([pts[0].gps.latitude, pts[0].gps.longitude], 16, {
      animate: true,
    });
  } else {
    const bounds = L.latLngBounds(
      pts.map((p) => [p.gps.latitude, p.gps.longitude]),
    );
    State.map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 17,
      animate: true,
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   SELECTION
   ───────────────────────────────────────────────────────────── */
function selectPhoto(photoId) {
  State.selectedId = photoId;

  // อัปเดต icon ของ markers
  State.photos.forEach((p) => {
    if (p.marker) {
      p.marker.setIcon(makeNumberIcon(p.orderIndex, p.id === photoId));
    }
  });

  // highlight card ใน sidebar
  document
    .querySelectorAll(".photo-card")
    .forEach((c) => c.classList.remove("selected"));
  const card = document.getElementById(`pc-${photoId}`);
  if (card) {
    card.classList.add("selected");
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // pan แผนที่ไปที่รูป
  const photo = State.photos.find((p) => p.id === photoId);
  if (photo?.gps) {
    State.map.panTo([photo.gps.latitude, photo.gps.longitude], {
      animate: true,
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   ACTIONS
   ───────────────────────────────────────────────────────────── */
function focusPhoto(photoId) {
  const photo = State.photos.find((p) => p.id === photoId);
  if (!photo?.gps) return;
  selectPhoto(photoId);
  State.map.setView([photo.gps.latitude, photo.gps.longitude], 17, {
    animate: true,
  });
  photo.marker?.openPopup();
}

function removePhoto(photoId) {
  const photo = State.photos.find((p) => p.id === photoId);
  if (!photo) return;

  // ลบ marker จากแผนที่
  if (photo.marker) State.map.removeLayer(photo.marker);

  // คืน memory
  URL.revokeObjectURL(photo.objectUrl);
  if (photo.displayUrl !== photo.objectUrl)
    URL.revokeObjectURL(photo.displayUrl);

  // ลบออกจาก state
  State.photos = State.photos.filter((p) => p.id !== photoId);
  if (State.selectedId === photoId) State.selectedId = null;

  if (State.photos.length === 0) {
    clearAll();
    return;
  }

  sortAndReindex();
  refreshMap();
  initTimeline();
  renderSidebar();
  renderHeaderStats();
}

function clearAll() {
  // ลบ layers
  State.markers.forEach((m) => State.map?.removeLayer(m));
  State.markers = [];
  if (State.polyline) {
    State.map?.removeLayer(State.polyline);
    State.polyline = null;
  }

  // คืน object URLs
  State.photos.forEach((p) => {
    URL.revokeObjectURL(p.objectUrl);
    if (p.displayUrl !== p.objectUrl) URL.revokeObjectURL(p.displayUrl);
  });
  State.photos = [];
  State.selectedId = null;
  State.nextId = 1;

  // ทำลาย map instance
  if (State.map) {
    State.map.remove();
    State.map = null;
  }

  // reset UI
  DOM.appContent.classList.add("hidden");
  DOM.uploadZone.classList.remove("hidden");
  DOM.btnClear.classList.add("hidden");
  DOM.headerStats.textContent = "";
  DOM.photoList.innerHTML = "";
  DOM.routeStats.classList.add("hidden");
  DOM.btnLayerToggle.textContent = TILE_LAYERS["satellite"].label; // next after street
  State.currentLayer = "street";
  State.tileLayer = null;
  DOM.timelineBar.classList.add("hidden");
  State.timelineIndex = 0;
  DOM.fileInput.value = "";
}

async function saveMapAsImage() {
  if (!State.map) return;

  showLoading("กำลังบันทึกแผนที่เป็นรูปภาพ...");

  try {
    if (typeof html2canvas === "undefined") {
      throw new Error("html2canvas ยังไม่ได้โหลด");
    }

    const mapEl = document.getElementById("map");
    const canvas = await html2canvas(mapEl, {
      useCORS: true,
      allowTaint: true,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      backgroundColor: "#141414",
      logging: false,
    });

    const link = document.createElement("a");
    link.download = `picturegps-map-${fmtFilenameDate(new Date())}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.error("[saveMapAsImage]", err);
    alert(
      "ไม่สามารถบันทึกแผนที่โดยอัตโนมัติได้\n" +
        "กรุณาใช้ Snipping Tool (Windows) หรือ ⌘+Shift+4 (Mac) แทน",
    );
  } finally {
    hideLoading();
  }
}

/* ─────────────────────────────────────────────────────────────
   SIDEBAR / UI RENDERING
   ───────────────────────────────────────────────────────────── */
function renderSidebar() {
  DOM.photoList.innerHTML = "";
  State.photos.forEach((p) => DOM.photoList.appendChild(buildPhotoCard(p)));

  DOM.photoCount.textContent = State.photos.length;

  // route stats (distance + time range)
  renderRouteStats();

  const noGps = State.photos.filter((p) => !p.hasGPS);
  if (noGps.length) {
    DOM.alertNoGps.classList.remove("hidden");
    DOM.alertNoGpsTxt.textContent = `${noGps.length} รูปไม่มีข้อมูล GPS (ไม่แสดงบนแผนที่)`;
  } else {
    DOM.alertNoGps.classList.add("hidden");
  }
}

function buildPhotoCard(photo) {
  const card = document.createElement("div");
  card.className = `photo-card${State.selectedId === photo.id ? " selected" : ""}`;
  card.id = `pc-${photo.id}`;

  // ──── ดึงค่า metadata ────
  const date = photo.dateTime ? fmtDateTime(photo.dateTime) : "—";
  const cam = [photo.exif?.Make, photo.exif?.Model].filter(Boolean).join(" ");
  const iso = photo.exif?.ISO ?? photo.exif?.ISOSpeedRatings;
  const fnum = photo.exif?.FNumber;
  const expT = photo.exif?.ExposureTime;
  const focal = photo.exif?.FocalLength;
  const imgW = photo.exif?.ImageWidth ?? photo.exif?.PixelXDimension;
  const imgH = photo.exif?.ImageHeight ?? photo.exif?.PixelYDimension;
  const flash = photo.exif?.Flash;
  const wb = photo.exif?.WhiteBalance;
  const expMode = photo.exif?.ExposureMode;
  const expProg = photo.exif?.ExposureProgram;

  // ──── สร้าง meta items ────
  const metaItems = [];

  if (cam) {
    metaItems.push({ k: "กล้อง", v: cam, full: true });
  }
  if (photo.hasGPS) {
    metaItems.push({
      k: "พิกัด GPS",
      v: `${photo.gps.latitude.toFixed(6)}, ${photo.gps.longitude.toFixed(6)}`,
      full: true,
    });
  }
  if (photo.gps?.altitude != null) {
    metaItems.push({ k: "ความสูง", v: `${photo.gps.altitude.toFixed(1)} ม.` });
  }
  if (fnum != null) {
    metaItems.push({
      k: "รูรับแสง",
      v: `f/${typeof fnum === "number" ? fnum.toFixed(1) : fnum}`,
    });
  }
  if (expT != null) {
    const ss = expT < 1 ? `1/${Math.round(1 / expT)}s` : `${expT}s`;
    metaItems.push({ k: "ชัตเตอร์", v: ss });
  }
  if (iso != null) {
    metaItems.push({ k: "ISO", v: String(iso) });
  }
  if (focal != null) {
    metaItems.push({
      k: "โฟกัส",
      v: `${typeof focal === "number" ? focal.toFixed(0) : focal} mm`,
    });
  }
  if (imgW && imgH) {
    metaItems.push({ k: "ขนาดภาพ", v: `${imgW} × ${imgH}` });
  }
  if (flash != null) {
    metaItems.push({
      k: "Flash",
      v: typeof flash === "boolean" ? (flash ? "เปิด" : "ปิด") : String(flash),
    });
  }
  if (wb != null) {
    metaItems.push({ k: "White Balance", v: String(wb) });
  }
  if (expMode != null) {
    metaItems.push({ k: "Exp. Mode", v: String(expMode) });
  }
  if (expProg != null) {
    metaItems.push({ k: "Exp. Program", v: String(expProg) });
  }

  const metaHTML = metaItems
    .map(
      (m) => `
    <div class="meta-item${m.full ? " full" : ""}">
      <span class="meta-key">${m.k}</span>
      <span class="meta-val" title="${escHtml(String(m.v))}">${escHtml(String(m.v))}</span>
    </div>
  `,
    )
    .join("");

  card.innerHTML = `
    <div class="card-top">
      <div class="card-thumb-wrap">
        <img src="${photo.displayUrl}" class="card-thumb" alt="" loading="lazy"
             onerror="this.style.opacity='0.3'">
        <div class="card-order-badge">${photo.orderIndex}</div>
        ${!photo.hasGPS ? '<div class="card-no-gps-bar">ไม่มี GPS</div>' : ""}
      </div>
      <div class="card-info">
        <div class="card-filename" title="${escHtml(photo.file.name)}">
          ${escHtml(truncate(photo.file.name, 22))}
        </div>
        <div class="card-date">📅 ${date}</div>
        ${
          photo.hasGPS
            ? `<div class="card-gps">${photo.gps.latitude.toFixed(5)}, ${photo.gps.longitude.toFixed(5)}</div>`
            : '<span class="card-no-gps-tag">⚠️ ไม่มี GPS</span>'
        }
      </div>
      <button class="card-remove-btn" data-remove="${photo.id}" title="ลบรูปนี้">✕</button>
    </div>

    ${metaItems.length ? `<div class="card-meta">${metaHTML}</div>` : ""}

    ${
      photo.hasGPS
        ? `
      <div class="card-actions">
        <button class="btn-focus-map" data-focus="${photo.id}">🗺️ แสดงบนแผนที่</button>
      </div>
    `
        : ""
    }
  `;

  // ──── Event listeners ────
  card.querySelector("[data-remove]").addEventListener("click", (e) => {
    e.stopPropagation();
    removePhoto(photo.id);
  });

  card.querySelector("[data-focus]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    focusPhoto(photo.id);
  });

  card.addEventListener("click", () => {
    if (photo.hasGPS) {
      selectPhoto(photo.id);
      photo.marker?.openPopup();
    }
  });

  return card;
}

function renderHeaderStats() {
  const total = State.photos.length;
  const withGPS = State.photos.filter((p) => p.hasGPS).length;
  DOM.headerStats.textContent = total
    ? `${total} รูป  ·  GPS ${withGPS}/${total}`
    : "";
}

/* ─────────────────────────────────────────────────────────────
   LOADING HELPERS
   ───────────────────────────────────────────────────────────── */
function showLoading(msg = "กำลังประมวลผล...") {
  DOM.loadingText.textContent = msg;
  DOM.loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  DOM.loadingOverlay.classList.add("hidden");
}

/* ────────────────────────────────────────────────────────────
   TIMELINE SLIDER
   ─────────────────────────────────────────────────────────── */

function initTimeline() {
  const gpsPhotos = State.photos.filter((p) => p.hasGPS);
  if (gpsPhotos.length < 2) {
    DOM.timelineBar.classList.add("hidden");
    return;
  }
  DOM.timelineBar.classList.remove("hidden");
  DOM.timelineSlider.min = 1;
  DOM.timelineSlider.max = gpsPhotos.length;
  DOM.timelineSlider.value = 1;
  State.timelineIndex = 0;
  renderTimelineStep(0);
}

function renderTimelineStep(index) {
  const gpsPhotos = State.photos.filter((p) => p.hasGPS);
  if (!gpsPhotos.length) return;

  const photo = gpsPhotos[index];
  State.timelineIndex = index;

  DOM.timelineSlider.value = index + 1;
  DOM.tlThumb.src = photo.displayUrl;
  DOM.tlBadge.textContent = photo.orderIndex;

  const date = photo.dateTime ? fmtDateTime(photo.dateTime) : "—";
  DOM.tlInfo.textContent = `${truncate(photo.file.name, 22)}  ·  ${date}`;
  DOM.tlCounter.textContent = `${index + 1} / ${gpsPhotos.length}`;

  // disable prev/next buttons at boundaries
  DOM.btnTlPrev.disabled = index === 0;
  DOM.btnTlNext.disabled = index === gpsPhotos.length - 1;

  // highlight marker + pan map
  selectPhoto(photo.id);
  if (photo.marker) {
    State.map.panTo([photo.gps.latitude, photo.gps.longitude], {
      animate: true,
    });
    photo.marker.openPopup();
  }
}

function onTimelineSlide(e) {
  renderTimelineStep(parseInt(e.target.value) - 1);
}

function moveTimeline(delta) {
  const gpsPhotos = State.photos.filter((p) => p.hasGPS);
  if (!gpsPhotos.length) return;
  const newIdx = Math.max(
    0,
    Math.min(gpsPhotos.length - 1, State.timelineIndex + delta),
  );
  renderTimelineStep(newIdx);
}

/* ────────────────────────────────────────────────────────────
   EXPORT GPX / KML
   ─────────────────────────────────────────────────────────── */

function exportGPX() {
  const pts = State.photos.filter((p) => p.hasGPS);
  if (!pts.length) return;

  const trkpts = pts
    .map((p) => {
      const ele =
        p.gps.altitude != null
          ? `\n        <ele>${p.gps.altitude.toFixed(1)}</ele>`
          : "";
      const time = p.dateTime
        ? `\n        <time>${p.dateTime.toISOString()}</time>`
        : "";
      const name = `\n        <name>${escXml(p.orderIndex + " - " + p.file.name)}</name>`;
      return `      <trkpt lat="${p.gps.latitude}" lon="${p.gps.longitude}">${ele}${time}${name}\n      </trkpt>`;
    })
    .join("\n");

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PictureGPS Map" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>PictureGPS Route</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>PictureGPS Route</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  downloadBlob(
    content,
    `picturegps-${fmtFilenameDate(new Date())}.gpx`,
    "application/gpx+xml",
  );
}

function exportKML() {
  const pts = State.photos.filter((p) => p.hasGPS);
  if (!pts.length) return;

  const placemarks = pts
    .map((p) => {
      const alt = p.gps.altitude != null ? p.gps.altitude.toFixed(1) : "0";
      const desc = p.dateTime
        ? `\n      <description>${fmtDateTime(p.dateTime)}</description>`
        : "";
      return `    <Placemark>
      <name>${escXml(p.orderIndex + " - " + p.file.name)}</name>${desc}
      <Point><coordinates>${p.gps.longitude},${p.gps.latitude},${alt}</coordinates></Point>
    </Placemark>`;
    })
    .join("\n");

  const lineCoords = pts
    .map((p) => {
      const alt = p.gps.altitude != null ? p.gps.altitude.toFixed(1) : "0";
      return `          ${p.gps.longitude},${p.gps.latitude},${alt}`;
    })
    .join("\n");

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>PictureGPS Route</name>
    <Style id="route">
      <LineStyle><color>ff1409E5</color><width>3</width></LineStyle>
    </Style>
${placemarks}
    <Placemark>
      <name>เส้นทาง</name>
      <styleUrl>#route</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
${lineCoords}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

  downloadBlob(
    content,
    `picturegps-${fmtFilenameDate(new Date())}.kml`,
    "application/vnd.google-earth.kml+xml",
  );
}

/** Download string content as a file */
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Escape XML special characters */
function escXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* ────────────────────────────────────────────────────────────
   FORMATTERS & UTILITIES
   ─────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────
   DISTANCE & ROUTE STATS
   ─────────────────────────────────────────────────────────── */

/** คำนวณระยะทางระหว่างสองจุด GPS (เมตร) – Haversine formula */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** ระยะทางรวมทั้งเส้น (เมตร) */
function calcTotalDistance() {
  const pts = State.photos.filter((p) => p.hasGPS);
  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += haversine(
      pts[i - 1].gps.latitude,
      pts[i - 1].gps.longitude,
      pts[i].gps.latitude,
      pts[i].gps.longitude,
    );
  }
  return total;
}

/** แปลงเมตร → สตริงอ่านง่าย */
function fmtDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} ม.`;
  return `${(meters / 1000).toFixed(2)} กม.`;
}

/** แสดง/ซ่อน route stats ใน sidebar header */
function renderRouteStats() {
  const pts = State.photos.filter((p) => p.hasGPS);

  if (pts.length < 2) {
    DOM.routeStats.classList.add("hidden");
    return;
  }

  DOM.routeStats.classList.remove("hidden");

  // ระยะทาง
  const dist = calcTotalDistance();
  DOM.routeDistance.textContent = `📐 ระยะทาง: ${fmtDistance(dist)}`;

  // ช่วงเวลา
  const withDt = State.photos.filter((p) => p.dateTime);
  if (withDt.length >= 2) {
    const first = withDt[0].dateTime;
    const last = withDt[withDt.length - 1].dateTime;
    const diffMs = last - first;
    const diffMin = Math.round(diffMs / 60_000);
    let diffStr;
    if (diffMin < 60) diffStr = `${diffMin} นาที`;
    else if (diffMin < 1440) diffStr = `${(diffMin / 60).toFixed(1)} ชม.`;
    else diffStr = `${(diffMin / 1440).toFixed(1)} วัน`;
    DOM.routeTimerange.textContent = `⏱ ช่วงเวลา: ${diffStr}`;
  } else {
    DOM.routeTimerange.textContent = "";
  }
}

/** แปลง Date เป็น string ภาษาไทย */
function fmtDateTime(date) {
  try {
    return date.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return date.toISOString().replace("T", " ").slice(0, 19);
  }
}

/** แปลง Date เป็น string สำหรับชื่อไฟล์ */
function fmtFilenameDate(date) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}`
  );
}

/** ตัดชื่อไฟล์ยาวเกินไป รักษา extension */
function truncate(str, max) {
  if (str.length <= max) return str;
  const dot = str.lastIndexOf(".");
  if (dot > 0) {
    const ext = str.slice(dot);
    return str.slice(0, max - ext.length - 1) + "…" + ext;
  }
  return str.slice(0, max - 1) + "…";
}

/** Escape HTML entities */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
