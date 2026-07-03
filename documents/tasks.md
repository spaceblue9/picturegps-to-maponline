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

### T-009 Sidebar Collapse/Expand Toggle
- Status: `Done`
- Detail:
  - ปุ่ม `◀` (chevron) ใน sidebar header ด้านขวาถัดจาก badge
  - กด 1 ครั้ง → sidebar ซ่อนพร้อม animation (width→0 + opacity fade, 280ms)
  - แผนที่ขยายเต็มพื้นที่โดยอัตโนมัติ (Leaflet `invalidateSize()` หลัง transition)
  - Floating tab 📸 โผล่ติดขอบขวา → กดคืน sidebar
  - keyboard shortcut: `]` ย่อ/ขยาย sidebar
  - sidebar-resizer ซ่อนอัตโนมัติตอน collapsed

### T-010 Bug Fix – Sidebar Resizer + Collapse ไม่ทำงาน
- Status: `Done`
- Detail:
  - **Bug 1 – Resizer ลากไม่ได้**:
    - สาเหตุ: JS ใช้ `appContent.style.gridTemplateColumns` แต่ `.app-content` เป็น `display: flex` ไม่ใช่ `grid` → property ไม่มีผล
    - Fix: เปลี่ยนเป็น `sidebar.style.width` แทน + ปิด transition ชั่วคราวตอนลากเพื่อไม่ให้กระตุก
  - **Bug 2 – ซ่อน sidebar ไม่ได้**:
    - สาเหตุ: CSS rule `.sidebar.collapsed` ไม่มี → JS เพิ่ม class แต่ไม่มี style เปลี่ยน
    - Fix: เพิ่ม `.sidebar.collapsed { width:0!important; opacity:0; pointer-events:none }` + transition 280ms
  - **Bug 3 – Floating tab 📸 ไม่มี**:
    - สาเหตุ: ไม่มี HTML element สำหรับ floating tab ที่จะเปิด sidebar กลับ
    - Fix: เพิ่ม `<button id="btn-sidebar-float">` ใน HTML + CSS + JS event listener


### T-004 Deploy to Netlify / GitHub Pages
- Status: `Done`
- Detail:
  - ✅ ตรวจสอบ deployment readiness: ไม่มี absolute paths, ไม่มี localhost references, ทุก path เป็น relative
  - ✅ PWA manifest (`manifest.json`) ใช้ `start_url: "./"` — พร้อม deploy
  - ✅ เพิ่ม `.gitignore` — exclude OS files, editor configs, Python bytecode
  - ✅ เพิ่ม `netlify.toml` — security headers (X-Frame-Options, nosniff, Referrer-Policy), aggressive cache สำหรับ static assets, HTML must-revalidate
  - วิธีที่ 1 – Netlify: ลาก folder `picturegps-to-maponline/` วางที่ https://app.netlify.com/drop
  - วิธีที่ 2 – GitHub Pages: push โค้ดขึ้น repo แล้วเปิด Settings → Pages → Deploy from branch
  - ไฟล์ entry point คือ `index.html` ที่ root

## Backlog

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

### T-011 เพิ่มฟีเจอร์แก้ไขวันเวลาของรูปภาพ
- Status: `Done`
- Detail:
  - ✏️ ปุ่ม edit ข้างวันที่ใน photo card (hover เพื่อแสดง เหมือน edit name/GPS)
  - 📅 Inline edit form: `datetime-local` input + ปุ่มบันทึก/ยกเลิก/ล้างค่า
  - ✅ บันทึก → อัปเดต `photo.dateTime` → `sortAndReindex()` → refresh map/routing/timeline/stats
  - 🗑️ ล้างค่า → `photo.dateTime = null` → sorting fallback เป็นชื่อไฟล์
  - 🎨 CSS dark theme สไตล์เข้ากับ GPS edit (`.date-input` ใช้ `color-scheme: dark`)

_(ไม่มี task ค้างอยู่ — ฟีเจอร์ทั้งหมดเสร็จแล้ว)_
