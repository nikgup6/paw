import pandas as pd
import json

df = pd.read_excel("WAGGY_Dog_Database_V4.xlsx")

rename_map = {
    "Breed Name": "name",
    "Size\n(XS/S/M/L/XL)": "size",
    "Purpose": "purpose",
    "Energy Level\n(hrs/day exercise)": "energy",
    "Grooming &\nMaintenance": "grooming",
    "Climate Suitability\n(Cold / Medium / Hot)": "climate",
    "Apartment\nFriendly": "apt",
    "Individual\nHouse Need": "house",
    "Monthly Cost\nEstimate (₹)\n[see cost breakdown]": "cost",
    "Common Health\nIssues": "health",
    "Family Risk\n(Children & Elderly)": "risk",
    "Time Spent\nwith Dog (hrs/day)": "time",
    "Shedding\nLevel": "shedding",
    "Hair Length\n(Natural)": "hair",
    "Nutrition /\nDiet Type": "nutrition",
    "Owner Experience\nRequired": "owner_experience",
    "Experience\nReason": "experience_reason",
    "Cuteness &\nViral Appeal": "cuteness",
}

df = df.rename(columns=rename_map)
df = df.fillna("")

img_map = {
    "Labrador Retriever": "assets/labrador_retriever.jpg",
    "Golden Retriever": "assets/golder_retriever.jpeg",
    "German Shepherd": "assets/german_shepherd.jpg",
    "Beagle": "assets/beagle.jpg",
    "Pug": "assets/Pug.jpg",
    "Shih Tzu": "assets/shihtzu.jpg",
    "Indian Pariah Dog": "assets/indian_pariaha.jpg",
    "Indian Spitz": "assets/indian_spitz.jpg",
    "Dachshund": "assets/daschund.jpg",
    "Pomeranian": "assets/Pomeranian.jpg",
    "Rottweiler": "assets/rottweiler.jpg",
    "Doberman Pinscher": "assets/doberman.jpg",
    "Boxer": "assets/boxer.jpg",
    "Dalmatian": "assets/dalmatian.jpg",
    "Great Dane": "assets/great_dane.jpg",
    "Saint Bernard": "assets/saint bernard.jpg",
    "Siberian Husky": "assets/siberian_husky.jpg",
    "Cocker Spaniel": "assets/cocker_spaniel.jpg",
    "French Bulldog": "assets/french_bulldog.jpg",
    "Poodle (Standard)": "assets/poodle.jpg",
    "Mudhol Hound": "assets/Mudhol_Hound.jpg",
    "Rajapalayam": "assets/Rajappalayam_Dog.jpg",
    "Lhasa Apso": "assets/lhasa_apso.jpg",
}

breeds = []
for idx, row in df.iterrows():
    name = str(row["name"])
    if not name:
        continue

    breed = {
        "id": str(idx + 1),
        "name": name,
        "size": str(row.get("size", "")),
        "purpose": str(row.get("purpose", "")),
        "energy": str(row.get("energy", "")),
        "grooming": str(row.get("grooming", "")),
        "climate": str(row.get("climate", "")).upper(),
        "apt": str(row.get("apt", "")),
        "house": str(row.get("house", "")),
        "cost": str(row.get("cost", "")).replace("\u20b9", "Rs."),
        "health": str(row.get("health", "")),
        "risk": str(row.get("risk", "")),
        "time": str(row.get("time", "")),
        "shedding": str(row.get("shedding", "")),
        "hair": str(row.get("hair", "")),
        "nutrition": str(row.get("nutrition", "")),
        "owner_experience": str(row.get("owner_experience", "")),
        "experience_reason": str(row.get("experience_reason", "")),
        "cuteness": str(row.get("cuteness", "")),
        "idealCities": "Metro Cities",
        "img": img_map.get(name, f"assets/{name.lower().replace(' ', '_')}.jpg"),
        "tags": [],
    }

    tags = []
    if "Low" in breed["grooming"]:
        tags.append("Low Maintenance")
    if breed["apt"] == "Yes":
        tags.append("Apartment Friendly")
    if "Family" in breed["purpose"] or "Companion" in breed["purpose"]:
        tags.append("Family Dog")
    if "Guard" in breed["purpose"]:
        tags.append("Guard Dog")
    breed["tags"] = tags

    climate = breed["climate"]
    if "HOT" in climate:
        breed["idealCities"] = "Chennai, Mumbai, Hyderabad"
    elif "COLD" in climate:
        breed["idealCities"] = "Shimla, Dehradun"
    else:
        breed["idealCities"] = "Bangalore, Pune, Delhi"

    breeds.append(breed)

with open("frontend/src/constants/breeds.json", "w", encoding="utf-8") as f:
    json.dump(breeds, f, indent=2)

print(f"Processed {len(breeds)} breeds")
