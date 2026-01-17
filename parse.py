import xml.etree.ElementTree as ET

tree = ET.parse("waste.xml")
root = tree.getroot()

sonuc = []

for placemark in root.iter():
    if placemark.tag.endswith("Placemark"):
        name = placemark.find(".//{*}name")
        lookat = placemark.find(".//{*}LookAt")

        if name is not None and lookat is not None:
            lat = lookat.find(".//{*}latitude")
            lng = lookat.find(".//{*}longitude")

            if lat is not None and lng is not None:
                sonuc.append({
                    "name": name.text.strip(),
                    "lat": float(lat.text),
                    "lng": float(lng.text)
                })

print("Bulunan kayıt sayısı:", len(sonuc))

with open("sonuc.txt", "w", encoding="utf-8") as f:
    for s in sonuc:
        """ f.write(f"{s['name']}, {s['lat']}, {s['lng']}\n") """
        f.write("{" + f"lat: {s['lat']}, lng: {s['lng']}, title: '{s['name']}', fill: 33," + "},\n" )
