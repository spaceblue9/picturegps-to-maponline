import struct, math

data = open('Ex1.jpg','rb').read()

exif_start = data.find(b'Exif\x00\x00')
tiff_start = exif_start + 6
print(f'TIFF base offset in file: {tiff_start}')

def read_le16(offset): return struct.unpack_from('<H', data, tiff_start + offset)[0]
def read_le32(offset): return struct.unpack_from('<I', data, tiff_start + offset)[0]

ifd0_offset = read_le32(4)
ifd0_abs = ifd0_offset
num_entries = read_le16(ifd0_abs)
print(f'\nIFD0 at {ifd0_abs}, entries: {num_entries}')

gps_ifd_offset = None
for i in range(num_entries):
    ep = ifd0_abs + 2 + i*12
    tag  = read_le16(ep)
    typ  = read_le16(ep+2)
    cnt  = read_le32(ep+4)
    val  = read_le32(ep+8)
    if tag == 0x8825:
        gps_ifd_offset = val
        print(f'  GPS IFD offset: {gps_ifd_offset}')

if gps_ifd_offset is None:
    print('No GPS IFD found in IFD0!')
    exit()

# Parse GPS IFD
gps_abs = gps_ifd_offset
gps_entries = read_le16(gps_abs)
print(f'\nGPS IFD at {gps_abs}, entries: {gps_entries}')

GPS_TAGS = {
    0: 'GPSVersionID', 1: 'GPSLatitudeRef', 2: 'GPSLatitude',
    3: 'GPSLongitudeRef', 4: 'GPSLongitude', 5: 'GPSAltitudeRef',
    6: 'GPSAltitude', 7: 'GPSTimeStamp', 12: 'GPSSpeedRef',
    13: 'GPSSpeed', 16: 'GPSImgDirectionRef', 17: 'GPSImgDirection',
    29: 'GPSDateStamp', 31: 'GPSHPositioningError'
}
TYPE_SIZE = {1:1, 2:1, 3:2, 4:4, 5:8, 7:1, 9:4, 10:8}

def read_rational(offset):
    num = struct.unpack_from('<I', data, tiff_start + offset)[0]
    den = struct.unpack_from('<I', data, tiff_start + offset + 4)[0]
    return num, den, num/den if den != 0 else 0

gps_data = {}
for i in range(gps_entries):
    ep = gps_abs + 2 + i*12
    tag = read_le16(ep)
    typ = read_le16(ep+2)
    cnt = read_le32(ep+4)
    raw = data[ep+8:ep+12]
    val_offset = read_le32(ep+8)

    tag_name = GPS_TAGS.get(tag, f'GPS_0x{tag:04X}')
    
    if typ == 2:  # ASCII
        size = cnt
        if size <= 4:
            val = raw[:size].decode('ascii', errors='replace').rstrip('\x00')
        else:
            val = data[tiff_start + val_offset : tiff_start + val_offset + size].decode('ascii', errors='replace').rstrip('\x00')
        print(f'  {tag_name}: "{val}"')
        gps_data[tag_name] = val
    elif typ == 5:  # RATIONAL (unsigned)
        rationals = []
        for j in range(cnt):
            n, d, v = read_rational(val_offset + j*8)
            rationals.append((n, d, v))
        print(f'  {tag_name}: {rationals}')
        gps_data[tag_name] = rationals
    elif typ == 1:  # BYTE
        val = raw[0] if cnt == 1 else list(raw[:cnt])
        print(f'  {tag_name}: {val}')
        gps_data[tag_name] = val
    else:
        print(f'  {tag_name}: type={typ} count={cnt} raw={raw.hex()}')

# Decode coordinates
print('\n=== Decoded GPS Coordinates ===')
try:
    lat_ref = gps_data.get('GPSLatitudeRef', 'N')
    lat = gps_data.get('GPSLatitude', [])
    lon_ref = gps_data.get('GPSLongitudeRef', 'E')
    lon = gps_data.get('GPSLongitude', [])
    
    if lat and lon:
        lat_dd = lat[0][2] + lat[1][2]/60 + lat[2][2]/3600
        lon_dd = lon[0][2] + lon[1][2]/60 + lon[2][2]/3600
        if lat_ref == 'S': lat_dd = -lat_dd
        if lon_ref == 'W': lon_dd = -lon_dd
        print(f'  Latitude:  {lat_dd:.7f} ({lat_ref})')
        print(f'  Longitude: {lon_dd:.7f} ({lon_ref})')
        print(f'  Google Maps: https://maps.google.com/?q={lat_dd},{lon_dd}')
    else:
        print('  No lat/lon data decoded')
except Exception as e:
    print(f'  Error decoding: {e}')
