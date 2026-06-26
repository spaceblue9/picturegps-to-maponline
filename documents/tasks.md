# Tasks

## Done

### T-001 Kick Off The Project Context
- Status: `Done`
- Detail:
  - Review generated documents. ✅
  - Confirm missing assumptions with the product owner. ✅

### T-002 Implement The Core Feature Set
- Status: `Done`
- Detail:
  - 1. upload รูปภาพได้หลายๆรูป ✅ (file input + drag & drop)
  - 2. หาพิกัด GPS จากรูปภาพ ✅ (exifr library)
  - 3. แสดงบน MAP ✅ (Leaflet.js + OpenStreetMap)
  - 4. ทำ label บนแผนที่ ✅ (numbered teardrop markers)
  - 5. สร้างเส้น Routing จาก label บน Map ✅ (L.polyline เรียงตามเวลาถ่าย)
  - 6. บันทึกเป็นรูปได้ ✅ (html2canvas)
  - 7. อ่าน Meta Data ของรูปได้ ✅ (EXIF: กล้อง, ISO, f-stop, shutter, focal, GPS, วันที่)
  - 8. รองรับรูปภาพหลาย Format ✅ (JPEG, PNG, TIFF, HEIC ผ่าน exifr)

### T-003 Validate Success Criteria
- Status: `Done`
- Detail:
  - แสดงพิกัดบนแผนที่ ✅
  - แสดง metadata ของรูปภาพ ✅
  - upload หลายรูป → เช็คเวลา → สร้างเส้น Routing ✅
  - label เลขลำดับ 1, 2, 3... ตามเวลาถ่าย ✅
  - รูปที่ไม่มี GPS แจ้งเตือนและไม่นำไปแสดงบนแผนที่ ✅

### T-006 Bug Fix – Map Tiles ไม่แสดง
- Status: `Done`
- Detail:
  - สาเหตุ: Leaflet initMap() ถูกเรียกตอนที่ `#app-content` ยังเป็น `display:none` → `#map` มีความสูง 0px → tile ไม่โหลด
  - Fix: แสดง `#app-content` ก่อน แล้วรอ 2 animation frames (`waitForPaint()`) ก่อนเรียก `initMap()`
  - เพิ่ม `map.invalidateSize()` กรณีเพิ่มรูปซ้ำ
  - เพิ่ม `window.resize` handler → `invalidateSize()` debounced 150ms

### T-007 เพิ่มฟีเจอร์เสริม (รอบแรก)
- Status: `Done`
- Detail:
  - 🛰️ Layer Toggle: สลับ OpenStreetMap ↔ ESRI World Imagery (satellite) ฟรี ไม่ต้อง API key
  - 📐 ระยะทางรวม: คำนวณด้วย Haversine formula แสดง ม./กม. ใน sidebar header
  - ⏱️ ช่วงเวลา: คำนวณ duration ระหว่างรูปแรก–รูปสุดท้าย แสดงใน sidebar header
  - Route stats bar ซ่อนอัตโนมัติเมื่อมีรูป GPS น้อยกว่า 2 รูป

## Backlog

### T-004 Deploy to Netlify / GitHub Pages
- Status: `Todo`
- Detail:
  - โปรเจกต์เป็น static files (HTML + CSS + JS) ไม่ต้องการ build step
  - วิธีที่ 1 – Netlify: ลาก folder `picturegps-to-maponline/` วางที่ https://app.netlify.com/drop
  - วิธีที่ 2 – GitHub Pages: push โค้ดขึ้น repo แล้วเปิด Settings → Pages → Deploy from branch
  - ไฟล์ entry point คือ `index.html` ที่ root

### T-005 เพิ่มฟีเจอร์เสริม (รอบสอง)
- Status: `Done`
- Detail:
  - 🎚️ Timeline Slider: bar แสดงใต้แผนที่ เลื่อนดูรูปทีละจุด + ปุ่ม Prev/Next + thumbnail preview (ซ่อนเมื่อมีรูป GPS < 2)
  - 📥 Export GPX: สร้างไฟล์ GPX 1.1 พร้อม trkpt (lat/lon/ele/time/name) ดาวน์โหลดได้ทันที
  - 📥 Export KML: สร้างไฟล์ KML 2.2 พร้อม Placemark + LineString เส้นทาง เปิดได้ใน Google Earth
  - 🏔️ Terrain Basemap: เพิ่ม OpenTopoMap ใน layer cycle (ถนน → ดาวเทียม → ภูมิประเทศ → วน)

### T-008 Mobile Responsive Overhaul (iPhone 13 layout) — Revised
- Status: `Done`
- Detail:
  - 📱 Sidebar อยู่ด้านขวาตลอด (row layout) เหมือน desktop — ไม่ย้ายลงด้านล่าง
  - 📐 Sidebar width: 200px (≤700px), 170px (≤480px), 150px (≤380px)
  - 🃏 card thumbnail: ซ่อนที่ ≤480px เพื่อประหยัดพื้นที่
  - 🔍 Mobile Search Button 🔍: แสดงบน ≤700px แทน search box
  - 📱 Mobile Search Overlay: panel เต็มเอนค้นหา Nominatim
  - ↺ orientationchange: invalidateSize() + fitMapToMarkers() delay 300ms
  - 🌏 viewport-fit=cover: iPhone notch / safe-area support
  - 🔶 CSS safe-area-inset: padding อัตโนมัติสำหรับมือถือที่มี notch
  - 🗂️ Toolbar: แถวเดียว icon-only บน ≤700px
  - 📱 Upload zone: overflow-y: auto + landscape align: flex-start

### T-009 Sidebar Collapse/Expand Toggle
- Status: `Done`
- Detail:
  - ปุ่ม `◀` (chevron) ใน sidebar header ด้านขวาถัดจาก badge
  - กด 1 ครั้ง → sidebar ซ่อนพร้อม animation (width→0 + opacity fade, 280ms)
  - แผนที่ขยายเต็มพื้นที่โดยอัตโนมัติ (Leaflet `invalidateSize()` หลัง transition)
  - Floating tab 📸 โผล่ติดขอบขวา → กดคืน sidebar
  - keyboard shortcut: `]` ย่อ/ขยาย sidebar
  - sidebar-resizer ซ่อนอัตโนมัติตอน collapsed
