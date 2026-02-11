import xml.etree.ElementTree as ET
import json

tree = ET.parse("waste.xml")
root = tree.getroot()

sonuc = []

id_counter = 4  # id üretmek için

for placemark in root.iter():
    if placemark.tag.endswith("Placemark"):
        name = placemark.find(".//{*}name")
        lookat = placemark.find(".//{*}LookAt")

        if name is not None and lookat is not None:
            lat = lookat.find(".//{*}latitude")
            lng = lookat.find(".//{*}longitude")

            if lat is not None and lng is not None:
                sonuc.append({
                    "id": id_counter,
                    "lat": float(lat.text),
                    "lng": float(lng.text),
                    "title": name.text.strip(),
                    "fill": 33
                })
                id_counter += 1

print("Bulunan kayıt sayısı:", len(sonuc))

# ✅ Gerçek JSON yaz
with open("sonuc.json", "w", encoding="utf-8") as f:
    json.dump(sonuc, f, ensure_ascii=False, indent=2)
