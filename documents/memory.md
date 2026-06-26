# Memory

## Project Snapshot
PictureGPS-to-MapOnline เป็น static web app (ไม่มี backend / database)
ผู้ใช้ upload รูปภาพที่มี GPS → โปรแกรมอ่าน EXIF → แสดงบนแผนที่ + เรียงเป็น timeline + สร้างเส้น routing

## Implemented Stack
| Layer        | Technology                                       |
|--------------|--------------------------------------------------|
| UI / Layout  | HTML5, CSS3 (custom properties, CSS Grid/Flex)   |
| Map          | Leaflet.js 1.9.4                                 |
| Map Tiles    | OpenStreetMap (street) / ESRI WorldImagery (satellite) |
| EXIF Parser  | exifr 7.1.3 (CDN UMD build)                      |
| Save Image   | html2canvas 1.4.1                                |
| Font         | Google Fonts – Sarabun (Thai support)            |
| Hosting      | Static files – deployable on Netlify / GitHub Pages |

## File Structure
```
picturegps-to-maponline/
├── index.html          ← entry point
├── css/
│   └── style.css       ← Netflix dark theme
├── js/
│   └── app.js          ← app logic (EXIF, map, UI)
└── documents/          ← project docs
```

## Key Decisions
- **ไม่มี build step**: ใช้ CDN script tags ทั้งหมด → deploy โดย drag & drop ได้เลย
- **exifr UMD**: ใช้ `unpkg.com/exifr@7.1.3/dist/full.umd.cjs` → expose `window.exifr`
- **Marker order**: เรียงตาม `DateTimeOriginal` → `DateTime` → `DateTimeDigitized` → ชื่อไฟล์ (fallback)
- **Routing line**: `L.polyline` สีแดง (#E50914) แบบ dashed เชื่อมทุก GPS point ตามลำดับ
- **Map init timing**: ต้องแสดง `#app-content` ก่อน แล้วรอ 2 animation frames (`waitForPaint()`) ก่อนเรียก `initMap()` เพราะ Leaflet ต้องการ container ที่มี height จริง
- **Layer Toggle**: ปุ่มสลับระหว่าง OpenStreetMap ↔ ESRI satellite (ฟรี ไม่ต้อง API key)
- **Distance**: คำนวณ Haversine formula ระหว่าง GPS points แสดงใน sidebar header
- **Save map**: ใช้ html2canvas + `useCORS: true` / ถ้า fail แนะนำ Snipping Tool
- **Design**: Netflix dark theme — bg #141414, accent #E50914, font Sarabun

## Constraints
- ไม่มี Database
- ไม่มีระบบ login
- Deploy บน Free Host ได้ (Netlify, GitHub Pages)
- Output ภาษาไทย
- Fully responsive (desktop 65/35 split, mobile stack)

## Known Limitations
- บันทึกแผนที่ด้วย html2canvas อาจมี tile ขาดหายได้หากบราวเซอร์บล็อก CORS (แนะนำ Snipping Tool แทน)
- HEIC/HEIF อาจต้องการ exifr full bundle และบราวเซอร์บางตัวไม่รองรับ preview thumbnail
- เปิดไฟล์ index.html ตรง (file://) ได้ แต่บางฟีเจอร์อาจถูก block → แนะนำใช้ local server หรือ deploy ขึ้น host

## Mobile Layout (T-008)
- **Portrait (≤ 700px)**: toolbar แถวเดียว icon-only, search box ซ่อน → ปุ่ม 🔍 เปิด Mobile Search Overlay แทน
- **Landscape (height ≤ 520px + orientation:landscape)**: กลับเป็น side-by-side layout, sidebar 240px, header 44px
- **orientationchange**: invalidateSize() + fitMapToMarkers() delay 300ms
- **viewport-fit=cover**: รองรับ iPhone notch, safe-area-inset ใน CSS @supports
- **split button**: ซ่อน dropdown arrow (`btn-split-arrow`) บน mobile, btn-split-main กลับเป็น rounded
- **sidebar-resizer**: ซ่อนใน portrait, แสดงใน landscape
- **Upload zone**: overflow-y: auto + landscape align: flex-start เพื่อ scroll ได้
