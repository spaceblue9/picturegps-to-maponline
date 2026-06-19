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
  clusterGroup: null, // L.markerClusterGroup
  polyline: null, // L.Polyline
  tileLayer: null, // L.TileLayer
  currentLayer: "street", // 'street' | 'satellite' | 'terrain'
  selectedId: null, // currently selected photo ID
  nextId: 1,
  timelineIndex: 0,
  expandedCards: new Set(), // จำ card ไหน expand อยู่
  importedTrack: null, // { name, points, polyline, wpMarkers }
  filter: "all", // 'all' | 'gps' | 'nogps'
  sortBy: "time", // 'time' | 'name'
  pinningPhotoId: null, // ID ของรูปที่กำลัง manual pin
  searchMarker: null, // marker ชั่วคราวจาก geocoding search
  undoTimer: null, // timer สำหรับ undo delete
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
  // GPX/KML load
  gpxKmlInput: $("gpx-kml-input"),         // hidden input ใน toolbar
  gpxKmlHomeInput: $("gpx-kml-home-input"), // hidden input ในหน้าแรก
  btnLoadGpxHome: $("btn-load-gpx-home"),
  btnLoadKmlHome: $("btn-load-kml-home"),
  gpxMenuLoad: $("gpx-menu-load"),
  kmlMenuLoad: $("kml-menu-load"),
  gpxArrow: $("btn-gpx-arrow"),
  kmlArrow: $("btn-kml-arrow"),
  gpxMenu: $("gpx-menu"),
  kmlMenu: $("kml-menu"),
  importedTrackInfo: $("imported-track-info"),
  importedTrackName: $("imported-track-name"),
  importedTrackPts: $("imported-track-pts"),
  importedTrackDist: $("imported-track-dist"),
  btnClearTrack: $("btn-clear-track"),
};

/* ─────────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  // A4: ตรวจสอบว่า CDN libraries โหลดได้
  if (typeof L === "undefined") {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
                  background:#141414;color:#fff;font-family:sans-serif;text-align:center;padding:32px;">
        <div>
          <div style="font-size:48px;margin-bottom:16px;">🌐</div>
          <h2 style="color:#E50914;margin-bottom:12px;">ต้องการการเชื่อมต่อ Internet</h2>
          <p style="color:#aaa;max-width:360px;line-height:1.6;">
            PictureGPS Map โหลด Leaflet.js และไลบรารีอื่นๆ จาก CDN<br>
            กรุณาเชื่อมต่อ Internet แล้วรีเฟรชหน้าเว็บ
          </p>
          <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;
            background:#E50914;color:#fff;border:none;border-radius:6px;
            font-size:15px;cursor:pointer;">🔄 ลองใหม่</button>
        </div>
      </div>`;
    return;
  }
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

  // D13: Save map — split button (map only / full page)
  const btnSaveMap = document.getElementById("btn-save-map");
  const btnSaveArrow = document.getElementById("btn-save-arrow");
  const saveMenu = document.getElementById("save-menu");
  if (btnSaveMap) btnSaveMap.addEventListener("click", saveMapAsImage);
  if (btnSaveArrow && saveMenu) {
    btnSaveArrow.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = saveMenu.classList.toggle("open");
      btnSaveArrow.setAttribute("aria-expanded", String(open));
    });
    document.getElementById("save-menu-map")?.addEventListener("click", () => {
      saveMenu.classList.remove("open");
      saveMapAsImage();
    });
    document.getElementById("save-menu-full")?.addEventListener("click", () => {
      saveMenu.classList.remove("open");
      saveFullPageAsImage();
    });
  }

  // D8: Export PDF
  document.getElementById("btn-export-pdf")?.addEventListener("click", exportPDF);

  DOM.btnFitBounds.addEventListener("click", fitMapToMarkers);
  $("btn-layer-toggle").addEventListener("click", toggleLayer);

  DOM.timelineSlider.addEventListener("input", onTimelineSlide);
  DOM.btnTlPrev.addEventListener("click", () => moveTimeline(-1));
  DOM.btnTlNext.addEventListener("click", () => moveTimeline(1));
  DOM.btnExportGpx.addEventListener("click", exportGPX);
  DOM.btnExportKml.addEventListener("click", exportKML);

  // B10: Filter pills
  document.querySelectorAll(".filter-pill").forEach((el) => {
    el.addEventListener("click", () => {
      State.filter = el.dataset.filter;
      renderSidebar();
    });
  });
  document.querySelectorAll(".sort-pill").forEach((el) => {
    el.addEventListener("click", () => {
      State.sortBy = el.dataset.sort;
      renderSidebar();
    });
  });

  // GPX/KML load
  setupGpxKmlButtons();

  // C6: Search
  setupSearch();

  // C7: Resizable sidebar
  setupSidebarResizer();

  // A1: Drag-and-drop บน drop area — ใช้ drag-over ทั่วไป
  const da = DOM.dropArea;
  da.addEventListener("dragenter", (e) => {
    e.preventDefault();
    da.classList.add("drag-over");
  });
  da.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  da.addEventListener("dragleave", (e) => {
    if (!da.contains(e.relatedTarget)) {
      da.classList.remove("drag-over");
    }
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

  // สำหรับ split menus GPX/KML
  document.addEventListener("click", () => {
    document.querySelectorAll(".btn-split-menu").forEach((m) => m.classList.remove("open"));
    if (saveMenu) saveMenu.classList.remove("open");
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
  const files = Array.from(fileList);

  // แยก GPX/KML ออกจากรูปภาพ
  const trackFiles = files.filter((f) => /\.(gpx|kml)$/i.test(f.name));
  const images = files.filter((f) => f.type.startsWith("image/"));

  // โหลด track ไฟล์แรกถ้ามี (รองรับ 1 ไฟล์ต่อครั้ง)
  if (trackFiles.length) {
    onGpxKmlFileSelected(trackFiles[0]);
  }
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
  const nextCfg = TILE_LAYERS[nextLayer];
  // แยก emoji กับ label text เพื่ออัปเดตเฉพาะ .btn-label span
  const parts = nextCfg.label.split(" ");
  const emoji = parts[0];
  const labelText = parts.slice(1).join(" ");
  const labelSpan = DOM.btnLayerToggle.querySelector(".btn-label");
  if (labelSpan) {
    // อัปเดต text node (emoji) + span
    DOM.btnLayerToggle.childNodes[0].textContent = emoji + " ";
    labelSpan.textContent = labelText;
  } else {
    DOM.btnLayerToggle.textContent = nextCfg.label;
  }
}

function refreshMap() {
  // D12: ลบ cluster group เดิม
  if (State.clusterGroup) {
    State.map?.removeLayer(State.clusterGroup);
    State.clusterGroup = null;
  }
  State.markers = [];
  State.photos.forEach((p) => { p.marker = null; });

  // ลบ polyline เดิม
  if (State.polyline) {
    State.map.removeLayer(State.polyline);
    State.polyline = null;
  }

  const gpsPhotos = State.photos.filter((p) => p.hasGPS);
  if (!gpsPhotos.length) return;

  // D12: สร้าง cluster group
  const useCluster = typeof L.markerClusterGroup === "function";
  if (useCluster) {
    State.clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="cluster-icon">${count}</div>`,
          className: "cluster-icon-container",
          iconSize: [40, 40],
        });
      },
    });
  }

  // วาง markers
  gpsPhotos.forEach((photo) => {
    const m = buildMarker(photo);
    State.markers.push(m);
    photo.marker = m;
    if (useCluster) State.clusterGroup.addLayer(m);
    else m.addTo(State.map);
  });

  if (useCluster) State.map.addLayer(State.clusterGroup);

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
  // C9: manual pin → เหลือง
  const icon = photo.manualPin
    ? makeManualPinIcon(photo.orderIndex, isSelected)
    : makeNumberIcon(photo.orderIndex, isSelected);

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

  const gmapsUrl = `https://www.google.com/maps?q=${photo.gps?.latitude},${photo.gps?.longitude}`;
  const coordStr = `${lat}, ${lng}`;

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
        <div class="popup-row">
          <span>📍</span>
          <span>${lat}, ${lng}</span>
          <button class="popup-copy-btn" title="Copy พิกัด" onclick="navigator.clipboard.writeText('${coordStr}').then(()=>{this.textContent='✓';this.style.color='#4caf50';setTimeout(()=>{this.textContent='📋';this.style.color=''},1500)})">&#x1F4CB;</button>
        </div>
        ${alt ? `<div class="popup-row"><span>⛰️</span><span>${alt}</span></div>` : ""}
        ${cam ? `<div class="popup-row"><span>📷</span><span>${escHtml(cam)}</span></div>` : ""}
        <a href="${gmapsUrl}" target="_blank" rel="noopener" class="popup-gmaps-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          นำทางใน Google Maps
        </a>
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
      const icon = p.manualPin
        ? makeManualPinIcon(p.orderIndex, p.id === photoId)
        : makeNumberIcon(p.orderIndex, p.id === photoId);
      p.marker.setIcon(icon);
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
    // D12: ถ้า marker อยู่ใน cluster ต้อง spiderfy ก่อน
    if (State.clusterGroup && photo.marker) {
      State.clusterGroup.zoomToShowLayer(photo.marker, () => {
        State.map.panTo([photo.gps.latitude, photo.gps.longitude], { animate: true });
      });
    } else {
      State.map.panTo([photo.gps.latitude, photo.gps.longitude], { animate: true });
    }
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

  // B14: Undo — ซ่อน marker ชั่วคราวก่อน
  if (photo.marker) {
    photo.marker.setOpacity(0.25);
    if (photo.marker.getElement) {
      const el = photo.marker.getElement();
      if (el) el.style.filter = "grayscale(1) opacity(0.35)";
    }
  }

  // ยกเลิก undo timer เดิม (ถ้ามี)
  if (State.undoTimer) {
    clearTimeout(State.undoTimer);
    State.undoTimer = null;
    // ลบ toast เก่าทันที
    document.querySelectorAll(".toast").forEach((t) => t.remove());
  }

  const shortName = truncate(photo.file.name, 24);

  showToast(
    `ลบ "${shortName}" แล้ว`,
    "ยกเลิก",
    () => {
      // Undo: คืน opacity
      if (photo.marker) {
        photo.marker.setOpacity(1);
        const el = photo.marker.getElement?.();
        if (el) el.style.filter = "";
      }
      clearTimeout(State.undoTimer);
      State.undoTimer = null;
    },
    5000,
    () => {
      // หมดเวลา: ลบจริง
      _doRemovePhoto(photoId);
    }
  );

  State.undoTimer = setTimeout(() => {
    State.undoTimer = null;
  }, 5200);
}

/** ลบรูปจริงและ re-render */
function _doRemovePhoto(photoId) {
  const photo = State.photos.find((p) => p.id === photoId);
  if (!photo) return;

  // ลบ marker จากแผนที่
  if (photo.marker) {
    if (State.clusterGroup) State.clusterGroup.removeLayer(photo.marker);
    else State.map?.removeLayer(photo.marker);
  }

  // คืน memory
  URL.revokeObjectURL(photo.objectUrl);
  if (photo.displayUrl !== photo.objectUrl)
    URL.revokeObjectURL(photo.displayUrl);

  // ลบออกจาก state
  State.photos = State.photos.filter((p) => p.id !== photoId);
  if (State.selectedId === photoId) State.selectedId = null;

  if (State.photos.length === 0 && !State.importedTrack) {
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
  // D12: ลบ cluster group
  if (State.clusterGroup) {
    State.map?.removeLayer(State.clusterGroup);
    State.clusterGroup = null;
  }
  State.markers.forEach((m) => State.map?.removeLayer(m));
  State.markers = [];
  if (State.polyline) {
    State.map?.removeLayer(State.polyline);
    State.polyline = null;
  }

  // C6: ลบ search marker
  if (State.searchMarker) {
    State.map?.removeLayer(State.searchMarker);
    State.searchMarker = null;
  }

  // ล้าง imported track
  if (State.importedTrack) {
    State.importedTrack.wpMarkers?.forEach((m) => State.map?.removeLayer(m));
    if (State.importedTrack.polyline) State.map?.removeLayer(State.importedTrack.polyline);
    State.importedTrack = null;
  }

  // คืน object URLs
  State.photos.forEach((p) => {
    URL.revokeObjectURL(p.objectUrl);
    if (p.displayUrl !== p.objectUrl) URL.revokeObjectURL(p.displayUrl);
  });
  State.photos = [];
  State.selectedId = null;
  State.nextId = 1;
  State.expandedCards.clear();
  State.filter = "all";
  State.sortBy = "time";
  State.pinningPhotoId = null;

  // ยกเลิก pin mode ถ้าเปิดอยู่
  cancelPinMode?.();

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
  DOM.importedTrackInfo.classList.add("hidden");
  // reset layer toggle button label
  const satLabel = TILE_LAYERS["satellite"].label.split(" ");
  const satEmoji = satLabel[0];
  const satText = satLabel.slice(1).join(" ");
  const layerLabelSpan = DOM.btnLayerToggle.querySelector(".btn-label");
  if (layerLabelSpan) {
    DOM.btnLayerToggle.childNodes[0].textContent = satEmoji + " ";
    layerLabelSpan.textContent = satText;
  } else {
    DOM.btnLayerToggle.textContent = TILE_LAYERS["satellite"].label;
  }
  State.currentLayer = "street";
  State.tileLayer = null;
  DOM.timelineBar.classList.add("hidden");
  State.timelineIndex = 0;
  DOM.fileInput.value = "";
}

async function saveMapAsImage() {
  if (!State.map) return;

  showLoading("กำลังบันทึกแผนที่เป็นรูปภาพ...");

  const mapEl = document.getElementById("map");
  let tmpCanvas = null; // canvas overlay ชั่วคราว

  try {
    if (typeof html2canvas === "undefined") {
      throw new Error("html2canvas ยังไม่ได้โหลด");
    }

    const scale = Math.min(window.devicePixelRatio || 1, 2);

    // ── ปิด popup และหยุด animation ก่อน capture ───────────────────
    State.map.closePopup();
    State.map.stop();
    await new Promise((resolve) => setTimeout(resolve, 150));

    // ── วาดเส้น routing ลงบน canvas overlay ใน DOM ก่อน capture ────
    // วิธีนี้บังคับ: เส้น routing เป็นส่วนหนึ่งของ DOM ที่ html2canvas capture
    // ไม่ต้องคำนวณ coordinate system หลัง capture → ตรงเสมอ
    const gpsPhotos = State.photos.filter((p) => p.hasGPS);

    if (gpsPhotos.length >= 2) {
      // สร้าง canvas ที่มีขนาดเท่ากับ #map ตีดไว้บนแผนที่
      tmpCanvas = document.createElement("canvas");
      tmpCanvas.width  = mapEl.offsetWidth;
      tmpCanvas.height = mapEl.offsetHeight;
      tmpCanvas.style.cssText =
        "position:absolute;top:0;left:0;width:100%;height:100%;"
        + "z-index:9999;pointer-events:none;";
      mapEl.appendChild(tmpCanvas);

      // วาดเส้นด้วย CSS pixel coordinates ตรง → ไม่ต้อง * scale
      // latLngToContainerPoint() ให้ค่า CSS pixel สัมพัทธ์กับ map container
      const ctx2 = tmpCanvas.getContext("2d");
      ctx2.strokeStyle = "#E50914";
      ctx2.lineWidth   = 3;
      ctx2.setLineDash([6, 9]);
      ctx2.lineCap     = "round";
      ctx2.lineJoin    = "round";
      ctx2.globalAlpha = 0.9;
      ctx2.beginPath();
      gpsPhotos.forEach((photo, i) => {
        const pt = State.map.latLngToContainerPoint([
          photo.gps.latitude,
          photo.gps.longitude,
        ]);
        if (i === 0) ctx2.moveTo(pt.x, pt.y);
        else         ctx2.lineTo(pt.x, pt.y);
      });
      ctx2.stroke();
    }

    // ── capture ──────────────────────────────────────────────
    const canvas = await html2canvas(mapEl, {
      useCORS: true,
      allowTaint: true,
      scale,
      backgroundColor: "#141414",
      logging: false,
      onclone: (_clonedDoc, clonedEl) => {
        // ซ่อน SVG overlay เป็นป้องกันไว้ (เส้น routing ของเราอยู่บน tmpCanvas แล้ว)
        const overlay = clonedEl.querySelector(".leaflet-overlay-pane");
        if (overlay) overlay.style.display = "none";
      },
    });

    // ── save ───────────────────────────────────────────────
    const link = document.createElement("a");
    link.download = `picturegps-map-${fmtFilenameDate(new Date())}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.error("[saveMapAsImage]", err);
    alert(
      "ไม่สามารถบันทึกแผนที่โดยอัตโนมัติได้\n"
        + "กรุณาใช้ Snipping Tool (Windows) หรือ ⧤+Shift+4 (Mac) แทน",
    );
  } finally {
    // ลบ canvas overlay ออกเสมอ ไม่ว่าจะสำเร็จหรือ error
    if (tmpCanvas && tmpCanvas.parentNode === mapEl) {
      mapEl.removeChild(tmpCanvas);
    }
    hideLoading();
  }
}

/* ─────────────────────────────────────────────────────────────
   SIDEBAR / UI RENDERING
   ───────────────────────────────────────────────────────────── */
function renderSidebar() {
  // B10: Filter + Sort
  let photos = [...State.photos];
  if (State.filter === "gps")   photos = photos.filter((p) => p.hasGPS);
  if (State.filter === "nogps") photos = photos.filter((p) => !p.hasGPS);
  if (State.sortBy === "name")  photos.sort((a, b) => a.file.name.localeCompare(b.file.name));

  DOM.photoList.innerHTML = "";
  photos.forEach((p) => DOM.photoList.appendChild(buildPhotoCard(p)));

  DOM.photoCount.textContent = State.photos.length;

  // route stats
  renderRouteStats();

  const noGps = State.photos.filter((p) => !p.hasGPS);
  if (noGps.length) {
    DOM.alertNoGps.classList.remove("hidden");
    DOM.alertNoGpsTxt.textContent = `${noGps.length} รูปไม่มีข้อมูล GPS (ไม่แสดงบนแผนที่)`;
  } else {
    DOM.alertNoGps.classList.add("hidden");
  }

  // B10: sync active pill state
  document.querySelectorAll(".filter-pill").forEach((el) => {
    el.classList.toggle("active", el.dataset.filter === State.filter);
  });
  document.querySelectorAll(".sort-pill").forEach((el) => {
    el.classList.toggle("active", el.dataset.sort === State.sortBy);
  });
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

  // chevron SVG icon
  const chevronSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  // ตรวจสอบ expanded state
  // card-body แสดงเสมอ: รูปมี GPS → แสดง actions / รูปไม่มี GPS → แสดงปุ่มปักหมุด
  const hasBody = true;
  const isExpanded = State.expandedCards.has(photo.id);
  if (isExpanded) card.classList.add("expanded");

  card.innerHTML = `
    <div class="card-top">
      <div class="card-thumb-wrap">
        <img src="${photo.displayUrl}" class="card-thumb" alt="" loading="lazy"
             onerror="this.style.opacity='0.3'">
        <div class="card-order-badge">${photo.orderIndex}</div>
        ${photo.manualPin ? '<div class="card-no-gps-bar card-manual-pin-bar">📍 Manual</div>' : (!photo.hasGPS ? '<div class="card-no-gps-bar">ไม่มี GPS</div>' : "")}
      </div>
      <div class="card-info">
        <div class="card-filename" title="${escHtml(photo.file.name)}">
          ${escHtml(truncate(photo.file.name, 22))}
        </div>
        <div class="card-date">📅 ${date}</div>
        ${
          photo.hasGPS
            ? `<div class="card-gps">${photo.gps.latitude.toFixed(5)}, ${photo.gps.longitude.toFixed(5)}</div>`
            : `<div class="card-no-gps-inline">
                <span class="card-no-gps-tag">⚠️ ไม่มี GPS</span>
                <button class="btn-pin-map btn-pin-inline" data-pin="${photo.id}">📍 ปักหมุด</button>
               </div>`
        }
      </div>
      <div class="card-top-actions">
        ${metaItems.length > 0 || photo.hasGPS ? `<button class="card-toggle" data-toggle="${photo.id}" title="ดูรายละเอียด">${chevronSVG}</button>` : ""}
        <button class="card-remove-btn" data-remove="${photo.id}" title="ลบรูปนี้">✕</button>
      </div>
    </div>

    ${metaItems.length > 0 || photo.hasGPS ? `
    <div class="card-body">
      ${metaItems.length ? `<div class="card-meta">${metaHTML}</div>` : ""}
      ${
        photo.hasGPS
          ? `
        <div class="card-actions">
          <button class="btn-focus-map" data-focus="${photo.id}">🗺️ แสดงบนแผนที่</button>
          <a href="https://www.google.com/maps?q=${photo.gps.latitude},${photo.gps.longitude}" target="_blank" rel="noopener" class="btn-gmaps">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            นำทางใน Google Maps
          </a>
        </div>
      `
          : ""
      }
    </div>
    ` : ""}
  `;

  // โ”€โ”€โ”€โ”€ Event listeners โ”€โ”€โ”€โ”€

  // Toggle expand/collapse
  card.querySelector("[data-toggle]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isNowExpanded = card.classList.toggle("expanded");
    if (isNowExpanded) {
      State.expandedCards.add(photo.id);
    } else {
      State.expandedCards.delete(photo.id);
    }
  });

  card.querySelector("[data-remove]").addEventListener("click", (e) => {
    e.stopPropagation();
    removePhoto(photo.id);
  });

  card.querySelector("[data-focus]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    focusPhoto(photo.id);
  });

  // C9: manual pin button(s) — ทั้ง inline (card-top) และ card-body
  card.querySelectorAll("[data-pin]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (State.map) startPinMode(photo.id);
      else showToast("ต้องโหลดรูปก่อนถึงปักหมุดได้", "", null, 3000);
    });
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
   GPX / KML LOAD
   ─────────────────────────────────────────────────────────── */

/** Setup event listeners สำหรับ GPX/KML buttons ทั้งหมด */
function setupGpxKmlButtons() {
  // ── ปุ่มในหน้าแรก ──────────────────────────────────────
  DOM.btnLoadGpxHome?.addEventListener("click", () => {
    DOM.gpxKmlHomeInput.accept = ".gpx";
    DOM.gpxKmlHomeInput.click();
  });
  DOM.btnLoadKmlHome?.addEventListener("click", () => {
    DOM.gpxKmlHomeInput.accept = ".kml";
    DOM.gpxKmlHomeInput.click();
  });
  DOM.gpxKmlHomeInput?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) onGpxKmlFileSelected(f);
    e.target.value = "";
  });

  // ── Split menu ใน Toolbar ──────────────────────────────
  // GPX arrow toggle
  DOM.gpxArrow?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = DOM.gpxMenu.classList.toggle("open");
    DOM.gpxArrow.setAttribute("aria-expanded", isOpen);
    if (isOpen) DOM.kmlMenu.classList.remove("open");
  });
  // KML arrow toggle
  DOM.kmlArrow?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = DOM.kmlMenu.classList.toggle("open");
    DOM.kmlArrow.setAttribute("aria-expanded", isOpen);
    if (isOpen) DOM.gpxMenu.classList.remove("open");
  });
  // ปิด menu เมื่อคลิกที่อื่น
  document.addEventListener("click", () => {
    DOM.gpxMenu?.classList.remove("open");
    DOM.kmlMenu?.classList.remove("open");
    DOM.gpxArrow?.setAttribute("aria-expanded", "false");
    DOM.kmlArrow?.setAttribute("aria-expanded", "false");
  });

  // Export จาก split menu
  $("gpx-menu-export")?.addEventListener("click", exportGPX);
  $("kml-menu-export")?.addEventListener("click", exportKML);

  // Load จาก split menu
  DOM.gpxMenuLoad?.addEventListener("click", () => {
    DOM.gpxKmlInput.accept = ".gpx";
    DOM.gpxKmlInput.click();
  });
  DOM.kmlMenuLoad?.addEventListener("click", () => {
    DOM.gpxKmlInput.accept = ".kml";
    DOM.gpxKmlInput.click();
  });
  DOM.gpxKmlInput?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) onGpxKmlFileSelected(f);
    e.target.value = "";
  });

  // ปุ่มลบ track
  DOM.btnClearTrack?.addEventListener("click", clearImportedTrack);
}

/** อ่านไฟล์ที่เลือก → parse → load ขึ้น map */
async function onGpxKmlFileSelected(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext !== "gpx" && ext !== "kml") {
    alert("รองรับเฉพาะไฟล์ .gpx และ .kml เท่านั้น");
    return;
  }
  showLoading(`กำลังโหลด ${file.name}...`);
  try {
    const text = await file.text();
    let points;
    if (ext === "gpx") {
      points = parseGPX(text);
    } else {
      points = parseKML(text);
    }
    if (!points.length) {
      alert("ไม่พบข้อมูลพิกัดในไฟล์นี้ กรุณาตรวจสอบไฟล์อีกครั้ง");
      return;
    }
    await loadTrackToMap(file.name, points);
  } catch (err) {
    console.error("[GPX/KML]", err);
    alert("เกิดข้อผิดพลาดในการอ่านไฟล์: " + err.message);
  } finally {
    hideLoading();
  }
}

/**
 * Parse GPX XML → array of { lat, lng, ele?, time?, name? }
 * รองรับทั้ง <trkpt> (track points) และ <wpt> (waypoints)
 */
function parseGPX(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const points = [];

  // Track segments
  doc.querySelectorAll("trkpt").forEach((pt) => {
    const lat = parseFloat(pt.getAttribute("lat"));
    const lon = parseFloat(pt.getAttribute("lon"));
    if (isNaN(lat) || isNaN(lon)) return;
    const ele = pt.querySelector("ele")?.textContent;
    const timeEl = pt.querySelector("time")?.textContent;
    const name = pt.querySelector("name")?.textContent || null;
    points.push({
      lat,
      lng: lon,
      ele: ele ? parseFloat(ele) : null,
      time: timeEl ? new Date(timeEl) : null,
      name,
      isWaypoint: false,
    });
  });

  // Waypoints (named points)
  doc.querySelectorAll("wpt").forEach((pt) => {
    const lat = parseFloat(pt.getAttribute("lat"));
    const lon = parseFloat(pt.getAttribute("lon"));
    if (isNaN(lat) || isNaN(lon)) return;
    const ele = pt.querySelector("ele")?.textContent;
    const timeEl = pt.querySelector("time")?.textContent;
    const name = pt.querySelector("name")?.textContent || null;
    points.push({
      lat,
      lng: lon,
      ele: ele ? parseFloat(ele) : null,
      time: timeEl ? new Date(timeEl) : null,
      name,
      isWaypoint: true,
    });
  });

  return points;
}

/**
 * Parse KML XML → array of { lat, lng, ele?, name? }
 * รองรับ <Placemark> (Point + LineString)
 */
function parseKML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const points = [];

  // Placemarks ที่เป็น Point (waypoints)
  doc.querySelectorAll("Placemark").forEach((pm) => {
    const name = pm.querySelector("name")?.textContent?.trim() || null;

    // Point
    const coordEl = pm.querySelector("Point > coordinates");
    if (coordEl) {
      const [lonStr, latStr, eleStr] = coordEl.textContent.trim().split(",");
      const lat = parseFloat(latStr);
      const lng = parseFloat(lonStr);
      if (!isNaN(lat) && !isNaN(lng)) {
        points.push({
          lat,
          lng,
          ele: eleStr ? parseFloat(eleStr) : null,
          time: null,
          name,
          isWaypoint: true,
        });
      }
      return;
    }

    // LineString / MultiGeometry
    const lineCoordEl = pm.querySelector("LineString > coordinates, MultiGeometry coordinates");
    if (lineCoordEl) {
      lineCoordEl.textContent
        .trim()
        .split(/\s+/)
        .forEach((coord, i) => {
          const parts = coord.split(",");
          const lat = parseFloat(parts[1]);
          const lng = parseFloat(parts[0]);
          const ele = parts[2] ? parseFloat(parts[2]) : null;
          if (!isNaN(lat) && !isNaN(lng)) {
            points.push({ lat, lng, ele, time: null, name: i === 0 ? name : null, isWaypoint: false });
          }
        });
    }
  });

  return points;
}

/**
 * โหลด track ขึ้นแผนที่:
 * - วาด polyline สีฟ้า
 * - วาง marker จุดแวะ (waypoints หรือ named points)
 * - เปิดหน้า map ถ้ายังไม่เปิด
 * - แสดง track info panel ใน sidebar
 */
async function loadTrackToMap(filename, points) {
  // ล้าง track เก่าก่อน
  clearImportedTrack();

  // ── เปิดหน้า app ถ้ายังอยู่หน้าแรก ─────────────────────
  const isFirstLoad = DOM.appContent.classList.contains("hidden");
  if (isFirstLoad) {
    DOM.uploadZone.classList.add("hidden");
    DOM.appContent.classList.remove("hidden");
    DOM.btnClear.classList.remove("hidden");
    await waitForPaint();
  }

  // ── สร้าง map ถ้ายังไม่มี ────────────────────────────
  if (!State.map) {
    initMap();
  } else {
    State.map.invalidateSize();
  }

  // แยก track points กับ waypoints สำหรับแสดง
  const trackPts  = points.filter((p) => !p.isWaypoint);
  const waypoints = points.filter((p) => p.isWaypoint || p.name);

  // ใช้ทุก points สำหรับวาดเส้น (รวม waypoints ด้วย)
  const allForLine = points.length ? points : trackPts;
  const lineCoords = allForLine.map((p) => [p.lat, p.lng]);

  // ── วาด polyline สีฟ้า ──────────────────────────────
  let trackPolyline = null;
  if (lineCoords.length >= 2) {
    trackPolyline = L.polyline(lineCoords, {
      color: "#2196F3",
      weight: 3,
      opacity: 0.85,
      dashArray: null,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(State.map);
  }

  // ── วาง waypoint markers ─────────────────────────────
  const wpMarkers = [];
  const wpSrc = waypoints.length > 0 ? waypoints : (trackPts.length === 0 ? [] : [trackPts[0], trackPts[trackPts.length - 1]]);
  wpSrc.forEach((pt) => {
    const icon = L.divIcon({
      className: "track-waypoint-marker",
      html: `<div class="track-wp-dot"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
      popupAnchor: [0, -8],
    });
    const m = L.marker([pt.lat, pt.lng], { icon });

    // สร้าง popup สำหรับทุกจุด (มีชื่อหรือไม่ก็ตาม)
    const gmapsUrl = `https://www.google.com/maps?q=${pt.lat},${pt.lng}`;
    const gmapsNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${pt.lat},${pt.lng}`;

    const rows = [
      pt.name ? `<div class="wp-popup-name">${escHtml(pt.name)}</div>` : "",
      `<div class="wp-popup-row"><span>📍</span><span>${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}</span></div>`,
      pt.ele != null ? `<div class="wp-popup-row"><span>⛰️</span><span>${pt.ele.toFixed(1)} เมตร</span></div>` : "",
      pt.time ? `<div class="wp-popup-row"><span>📅</span><span>${fmtDateTime(pt.time)}</span></div>` : "",
    ].filter(Boolean).join("");

    const popupHTML = `
      <div class="wp-popup">
        ${rows}
        <div class="wp-popup-actions">
          <a href="${gmapsUrl}" target="_blank" rel="noopener" class="wp-popup-btn wp-popup-btn-view">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            ดูบนแผนที่
          </a>
          <a href="${gmapsNavUrl}" target="_blank" rel="noopener" class="wp-popup-btn wp-popup-btn-nav">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            นำทาง
          </a>
        </div>
      </div>`;

    m.bindPopup(popupHTML, {
      maxWidth: 240,
      className: "dark-popup",
    });

    m.addTo(State.map);
    wpMarkers.push(m);
  });


  // ── บันทึก State ────────────────────────────────────
  const totalDist = calcTrackDistance(allForLine);
  State.importedTrack = {
    name: filename,
    points,
    polyline: trackPolyline,
    wpMarkers,
    totalDist,
  };

  // ── Fit bounds ──────────────────────────────────────
  setTimeout(() => {
    if (!State.map || !lineCoords.length) return;
    if (lineCoords.length === 1) {
      State.map.setView(lineCoords[0], 16, { animate: true });
    } else {
      State.map.fitBounds(L.latLngBounds(lineCoords), {
        padding: [50, 50],
        maxZoom: 17,
        animate: true,
      });
    }
  }, 350);

  // ── แสดง Track Info panel ────────────────────────────
  renderImportedTrackInfo();

  // A3: ซ่อน Timeline ถ้าไม่มีรูป (GPX-only mode)
  if (State.photos.filter((p) => p.hasGPS).length < 2) {
    DOM.timelineBar.classList.add("hidden");
  }

  // ── อัปเดต header stats ─────────────────────────────
  renderHeaderStats();
}

/** ลบ imported track ออกจากแผนที่และ state */
function clearImportedTrack() {
  if (!State.importedTrack) return;
  State.importedTrack.wpMarkers?.forEach((m) => State.map?.removeLayer(m));
  if (State.importedTrack.polyline) State.map?.removeLayer(State.importedTrack.polyline);
  State.importedTrack = null;
  DOM.importedTrackInfo.classList.add("hidden");
  renderHeaderStats();
}

/** แสดง track info panel ใน sidebar */
function renderImportedTrackInfo() {
  if (!State.importedTrack) return;
  const { name, points, totalDist } = State.importedTrack;
  DOM.importedTrackName.textContent = name;
  DOM.importedTrackPts.textContent = `🗺️ ${points.length} จุด`;
  DOM.importedTrackDist.textContent = `📐 ${fmtDistance(totalDist)}`;
  DOM.importedTrackInfo.classList.remove("hidden");
}

/** คำนวณระยะทางรวมของ track (เมตร) */
function calcTrackDistance(pts) {
  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  }
  return total;
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

/* ─────────────────────────────────────────────────────────────
   B14: TOAST NOTIFICATION (UNDO)
   ───────────────────────────────────────────────────────────── */
/**
 * แสดง Toast notification พร้อม Undo button
 * @param {string} msg ข้อความ
 * @param {string} undoLabel ข้อความบน Undo button
 * @param {Function} onUndo เรียกเมื่อกด Undo
 * @param {number} duration ms ก่อนหายไปอัตโนมัติ
 * @param {Function} onExpire เรียกเมื่อหมดเวลา
 */
function showToast(msg, undoLabel, onUndo, duration = 4000, onExpire = null) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <span class="toast-msg">${msg}</span>
    ${undoLabel ? `<button class="toast-undo-btn">${undoLabel}</button>` : ""}
  `;

  container.appendChild(toast);
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add("toast-show"));

  let dismissed = false;

  function dismiss(runExpire) {
    if (dismissed) return;
    dismissed = true;
    toast.classList.remove("toast-show");
    toast.classList.add("toast-hide");
    setTimeout(() => toast.remove(), 350);
    if (runExpire && onExpire) onExpire();
  }

  if (undoLabel) {
    toast.querySelector(".toast-undo-btn").addEventListener("click", () => {
      dismiss(false);
      if (onUndo) onUndo();
    });
  }

  const timer = setTimeout(() => dismiss(true), duration);

  toast.addEventListener("click", (e) => {
    if (!e.target.classList.contains("toast-undo-btn")) {
      clearTimeout(timer);
      dismiss(true);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   C6: SEARCH / GEOCODING (Nominatim)
   ───────────────────────────────────────────────────────────── */
let _searchDebounce = null;

function setupSearch() {
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");
  if (!input || !results) return;

  input.addEventListener("input", () => {
    clearTimeout(_searchDebounce);
    const q = input.value.trim();
    if (q.length < 2) {
      results.innerHTML = "";
      results.classList.add("hidden");
      return;
    }
    _searchDebounce = setTimeout(() => geocodeSearch(q, results, input), 500);
  });

  // ปิด results เมื่อ click outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) {
      results.classList.add("hidden");
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      results.classList.add("hidden");
      input.blur();
    }
  });
}

async function geocodeSearch(q, resultsEl, input) {
  if (!State.map) return;
  resultsEl.innerHTML = `<div class="search-loading">🔍 กำลังค้นหา...</div>`;
  resultsEl.classList.remove("hidden");

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "th,en" } });
    const data = await res.json();

    if (!data.length) {
      resultsEl.innerHTML = `<div class="search-empty">ไม่พบสถานที่ "${q}"</div>`;
      return;
    }

    resultsEl.innerHTML = data.map((item, i) => {
      const name = item.display_name.split(",").slice(0, 3).join(", ");
      return `<div class="search-result-item" data-idx="${i}" data-lat="${item.lat}" data-lng="${item.lon}" title="${item.display_name}">${name}</div>`;
    }).join("");

    resultsEl.querySelectorAll(".search-result-item").forEach((el) => {
      el.addEventListener("click", () => {
        const lat = parseFloat(el.dataset.lat);
        const lng = parseFloat(el.dataset.lng);
        panToSearchResult(lat, lng, el.title);
        input.value = el.title.split(",").slice(0, 2).join(", ");
        resultsEl.classList.add("hidden");
      });
    });
  } catch (err) {
    resultsEl.innerHTML = `<div class="search-empty">เกิดข้อผิดพลาด — ตรวจสอบ internet</div>`;
    console.error("[geocode]", err);
  }
}

function panToSearchResult(lat, lng, label) {
  if (!State.map) return;
  // ลบ marker เดิม
  if (State.searchMarker) State.map.removeLayer(State.searchMarker);

  const icon = L.divIcon({
    className: "search-marker-container",
    html: `<div class="search-marker-pin">🔍</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
  });

  State.searchMarker = L.marker([lat, lng], { icon })
    .addTo(State.map)
    .bindPopup(`<div class="popup-content"><div class="popup-info"><div class="popup-filename">📍 ${escHtml(label.split(",").slice(0,2).join(","))}</div></div></div>`, { maxWidth: 260, className: "dark-popup" })
    .openPopup();

  State.map.setView([lat, lng], 15, { animate: true });
}

/* ─────────────────────────────────────────────────────────────
   C7: RESIZABLE SIDEBAR
   ───────────────────────────────────────────────────────────── */
function setupSidebarResizer() {
  const resizer = document.getElementById("sidebar-resizer");
  const appContent = document.querySelector(".app-content");
  if (!resizer || !appContent) return;

  let isResizing = false;
  let startX = 0;
  let startSidebarW = 0;

  function getSidebarWidth() {
    const sidebar = document.querySelector(".sidebar");
    return sidebar ? sidebar.getBoundingClientRect().width : 320;
  }

  resizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    startSidebarW = getSidebarWidth();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const delta = startX - e.clientX; // ลาก left = เพิ่มความกว้าง sidebar
    const newW = Math.min(Math.max(startSidebarW + delta, 220), 600);
    appContent.style.gridTemplateColumns = `1fr 5px ${newW}px`;
    State.map?.invalidateSize();
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });

  // Touch support
  resizer.addEventListener("touchstart", (e) => {
    isResizing = true;
    startX = e.touches[0].clientX;
    startSidebarW = getSidebarWidth();
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!isResizing) return;
    const delta = startX - e.touches[0].clientX;
    const newW = Math.min(Math.max(startSidebarW + delta, 220), 600);
    appContent.style.gridTemplateColumns = `1fr 5px ${newW}px`;
    State.map?.invalidateSize();
  }, { passive: true });

  document.addEventListener("touchend", () => { isResizing = false; });
}

/* ─────────────────────────────────────────────────────────────
   C9: MANUAL PIN (ปักหมุดรูปที่ไม่มี GPS)
   ───────────────────────────────────────────────────────────── */
function startPinMode(photoId) {
  State.pinningPhotoId = photoId;
  const photo = State.photos.find((p) => p.id === photoId);
  if (!photo) return;

  // แสดง banner
  let banner = document.getElementById("pin-mode-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "pin-mode-banner";
    banner.className = "pin-mode-banner";
    document.querySelector(".map-section")?.appendChild(banner);
  }
  banner.innerHTML = `
    📍 คลิกบนแผนที่เพื่อปักหมุด <strong>"${escHtml(truncate(photo.file.name, 20))}"</strong>
    <button id="btn-cancel-pin" class="pin-cancel-btn">ยกเลิก</button>
  `;
  banner.classList.remove("hidden");

  document.getElementById("btn-cancel-pin")?.addEventListener("click", cancelPinMode);

  // เปลี่ยน cursor บน map
  const mapEl = document.getElementById("map");
  if (mapEl) mapEl.style.cursor = "crosshair";

  State.map?.once("click", onMapClickPin);
}

function onMapClickPin(e) {
  const photoId = State.pinningPhotoId;
  if (!photoId) return;
  const photo = State.photos.find((p) => p.id === photoId);
  if (!photo) return;

  photo.gps = { latitude: e.latlng.lat, longitude: e.latlng.lng, altitude: null };
  photo.hasGPS = true;
  photo.manualPin = true; // flag สำหรับแสดง icon ต่างกัน

  cancelPinMode();
  sortAndReindex();
  refreshMap();
  initTimeline();
  renderSidebar();
  renderHeaderStats();

  showToast(`📍 ปักหมุด "${truncate(photo.file.name, 20)}" สำเร็จ`, "", null, 3000);
}

function cancelPinMode() {
  State.pinningPhotoId = null;
  const banner = document.getElementById("pin-mode-banner");
  if (banner) banner.classList.add("hidden");
  const mapEl = document.getElementById("map");
  if (mapEl) mapEl.style.cursor = "";
  State.map?.off("click", onMapClickPin);
}

function makeManualPinIcon(num, selected = false) {
  return L.divIcon({
    className: "custom-marker-container",
    html: `<div class="marker-pin marker-pin-manual${selected ? " selected" : ""}"><span class="marker-number">${num}</span></div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -44],
  });
}

/* ─────────────────────────────────────────────────────────────
   D12: MARKER CLUSTERING (patch refreshMap + buildMarker)
   ───────────────────────────────────────────────────────────── */
/** override buildMarker เพื่อรองรับ manual pin icon */
function buildMarkerWithPin(photo) {
  const isSelected = State.selectedId === photo.id;
  const icon = photo.manualPin
    ? makeManualPinIcon(photo.orderIndex, isSelected)
    : makeNumberIcon(photo.orderIndex, isSelected);

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

/* ─────────────────────────────────────────────────────────────
   D13: SCREENSHOT — MAP ONLY / FULL PAGE
   ───────────────────────────────────────────────────────────── */
async function saveFullPageAsImage() {
  if (!State.map) return;
  showLoading("กำลังบันทึกภาพทั้งหน้า...");
  try {
    if (typeof html2canvas === "undefined") throw new Error("html2canvas ยังไม่โหลด");
    State.map.closePopup();
    State.map.stop();
    await new Promise((r) => setTimeout(r, 200));
    const appContent = document.getElementById("app-content");
    const canvas = await html2canvas(appContent, {
      useCORS: true,
      allowTaint: true,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      backgroundColor: "#1a1a1a",
      logging: false,
    });
    const link = document.createElement("a");
    link.download = `picturegps-fullpage-${fmtFilenameDate(new Date())}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.error("[saveFullPage]", err);
    alert("ไม่สามารถบันทึกภาพได้ กรุณาใช้ Snipping Tool แทน");
  } finally {
    hideLoading();
  }
}

/* ─────────────────────────────────────────────────────────────
   D8: EXPORT PDF REPORT
   ───────────────────────────────────────────────────────────── */
async function exportPDF() {
  if (!State.map) return;
  if (typeof window.jspdf === "undefined" && typeof window.jsPDF === "undefined") {
    alert("กำลังโหลด jsPDF... กรุณาลองใหม่อีกครั้ง");
    return;
  }

  showLoading("กำลังสร้าง PDF Report...");

  try {
    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    let y = margin;

    // ── Header ──────────────────────────────────
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(229, 9, 20);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PictureGPS Map Report", margin, 14);
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`สร้างเมื่อ: ${new Date().toLocaleString("th-TH")}`, pageW - margin, 14, { align: "right" });
    y = 30;

    // ── Map Screenshot ───────────────────────────
    if (typeof html2canvas !== "undefined" && State.map) {
      State.map.closePopup();
      State.map.stop();
      await new Promise((r) => setTimeout(r, 200));
      const mapEl = document.getElementById("map");
      const canvas = await html2canvas(mapEl, {
        useCORS: true, allowTaint: true, scale: 1.5,
        backgroundColor: "#141414", logging: false,
        onclone: (_d, el) => {
          const ov = el.querySelector(".leaflet-overlay-pane");
          if (ov) ov.style.display = "none";
        },
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const mapW = pageW - margin * 2;
      const mapH = Math.min((canvas.height / canvas.width) * mapW, 90);
      doc.addImage(imgData, "JPEG", margin, y, mapW, mapH);
      y += mapH + 8;
    }

    // ── Summary ──────────────────────────────────
    const gpsPhotos = State.photos.filter((p) => p.hasGPS);
    doc.setFillColor(35, 35, 35);
    doc.roundedRect(margin, y, pageW - margin * 2, 18, 2, 2, "F");
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(9);
    doc.text(`รูปภาพทั้งหมด: ${State.photos.length}`, margin + 4, y + 6);
    doc.text(`มีข้อมูล GPS: ${gpsPhotos.length}`, margin + 52, y + 6);
    if (State.importedTrack) {
      doc.text(`Track: ${State.importedTrack.name}`, margin + 4, y + 13);
    }
    y += 24;

    // ── Table ────────────────────────────────────
    if (State.photos.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(229, 9, 20);
      doc.text("รายการรูปภาพ", margin, y);
      y += 6;

      // Table header
      const cols = [8, 70, 42, 55];
      const headers = ["#", "ชื่อไฟล์", "วันที่ถ่าย", "พิกัด (lat, lng)"];
      doc.setFillColor(45, 45, 45);
      doc.rect(margin, y, pageW - margin * 2, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      let cx = margin + 2;
      headers.forEach((h, i) => { doc.text(h, cx, y + 5); cx += cols[i]; });
      y += 7;

      doc.setFont("helvetica", "normal");
      State.photos.forEach((photo, idx) => {
        if (y > pageH - 20) { doc.addPage(); y = margin; }
        const bg = idx % 2 === 0 ? [30, 30, 30] : [25, 25, 25];
        doc.setFillColor(...bg);
        doc.rect(margin, y, pageW - margin * 2, 7, "F");
        doc.setTextColor(200, 200, 200);
        cx = margin + 2;
        const row = [
          String(photo.orderIndex),
          truncate(photo.file.name, 28),
          photo.dateTime ? fmtDateTime(photo.dateTime).slice(0, 19) : "—",
          photo.hasGPS ? `${photo.gps.latitude.toFixed(5)}, ${photo.gps.longitude.toFixed(5)}` : "ไม่มี GPS",
        ];
        row.forEach((cell, i) => {
          doc.text(String(cell), cx, y + 5, { maxWidth: cols[i] - 2 });
          cx += cols[i];
        });
        y += 7;
      });
    }

    doc.save(`picturegps-report-${fmtFilenameDate(new Date())}.pdf`);
  } catch (err) {
    console.error("[exportPDF]", err);
    alert("ไม่สามารถสร้าง PDF ได้: " + err.message);
  } finally {
    hideLoading();
  }
}
