import sys
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

def get_exif(fname):
    img = Image.open(fname)
    exif_raw = img._getexif()
    if not exif_raw:
        print("No EXIF data found!")
        return

    exif = {}
    for tag_id, value in exif_raw.items():
        tag = TAGS.get(tag_id, f"Unknown_{tag_id}")
        exif[tag] = value

    print("=== Camera Info ===")
    for k in ['Make', 'Model', 'Software', 'DateTime', 'DateTimeOriginal']:
        if k in exif:
            print(f"  {k}: {exif[k]}")

    print("\n=== GPS Data ===")
    gps_info = exif.get('GPSInfo', {})
    if not gps_info:
        print("  No GPSInfo tag found!")
    else:
        gps = {}
        for tag_id, value in gps_info.items():
            tag = GPSTAGS.get(tag_id, f"GPS_{tag_id}")
            gps[tag] = value
            print(f"  {tag} (id={tag_id}): {value}")

        # Decode lat/lon
        print("\n=== Decoded Coordinates ===")
        try:
            lat_ref = gps.get('GPSLatitudeRef', 'N')
            lat_tuple = gps.get('GPSLatitude')
            lon_ref = gps.get('GPSLongitudeRef', 'E')
            lon_tuple = gps.get('GPSLongitude')

            if lat_tuple and lon_tuple:
                def to_dd(t):
                    # t is tuple of IFDRational or tuple pairs
                    vals = []
                    for v in t:
                        if hasattr(v, 'numerator'):
                            vals.append(float(v))
                        elif isinstance(v, tuple):
                            vals.append(v[0]/v[1] if v[1] != 0 else 0)
                        else:
                            vals.append(float(v))
                    return vals[0] + vals[1]/60 + vals[2]/3600

                lat_dd = to_dd(lat_tuple)
                lon_dd = to_dd(lon_tuple)
                if lat_ref == 'S': lat_dd = -lat_dd
                if lon_ref == 'W': lon_dd = -lon_dd

                print(f"  Latitude:  {lat_dd:.8f} ({lat_ref})")
                print(f"  Longitude: {lon_dd:.8f} ({lon_ref})")
                print(f"  Raw lat:   {lat_tuple}")
                print(f"  Raw lon:   {lon_tuple}")
                if lat_dd == 0 and lon_dd == 0:
                    print("  *** WARNING: GPS is (0,0) = Null Island! ***")
                else:
                    print(f"  Google Maps: https://maps.google.com/?q={lat_dd},{lon_dd}")
            else:
                print("  GPSLatitude or GPSLongitude is MISSING!")
        except Exception as e:
            print(f"  Error decoding: {e}")
            import traceback; traceback.print_exc()

    print("\n=== All EXIF Keys ===")
    skip = {'MakerNote', 'UserComment', 'GPSInfo'}
    for k, v in exif.items():
        if k not in skip:
            print(f"  {k}: {str(v)[:80]}")

get_exif('Ex1.jpg')
