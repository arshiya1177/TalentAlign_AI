import os
import fitz  # PyMuPDF
import requests
import uuid
import re

# Qdrant configuration
QDRANT_URL = "https://qdrant-az-dev.smartx.services"
COLLECTION_NAME = "my_collection"
HEADERS = {
    "api-key": "smartx-dev",
    "Content-Type": "application/json"
}

# ---------- Utilities ----------
def clean_text(text):
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'Page \d+', '', text)
    return text.strip()

def extract_text_from_pdf(path):
    try:
        with open(path, "rb") as f:
            doc = fitz.open(stream=f.read(), filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text()
            return clean_text(text)
    except Exception as e:
        print(f"Error reading {path}: {e}")
        return ""

# Dummy embedding for testing (replace with real one if needed)
def get_fake_embedding(text, dim=1536):
    return [round((i + len(text)) % 100 / 100, 4) for i in range(dim)]

# ---------- Step 1: Upload JDs to Qdrant ----------
def upload_jds_to_qdrant(jd_folder):
    files = os.listdir(jd_folder)
    for filename in files:
        if filename.endswith(".pdf"):
            path = os.path.join(jd_folder, filename)
            jd_text = extract_text_from_pdf(path)
            if len(jd_text) < 30:
                print(f"Skipping {filename} (too short)")
                continue

            embedding = get_fake_embedding(jd_text)
            payload = {
                "name": filename,
                "description": jd_text
            }

            point = {
                "id": str(uuid.uuid4()),
                "vector": embedding,
                "payload": payload
            }

            response = requests.put(
                f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points",
                headers=HEADERS,
                json={"points": [point]}
            )

            if response.status_code == 200:
                print(f"✅ Uploaded: {filename}")
            else:
                print(f"❌ Failed to upload {filename}: {response.text}")

# ---------- Step 2: Search Qdrant ----------
def search_qdrant(query_text, top_k=3):
    vector = get_fake_embedding(query_text)
    payload = {
        "vector": vector,
        "top": top_k,
        "with_payload": True
    }

    response = requests.post(
        f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/search",
        headers=HEADERS,
        json=payload
    )

    if response.status_code == 200:
        print("\n🔍 Top JD Matches from Shared Collection:\n")
        for item in response.json().get("result", []):
            jd_payload = item.get("payload", {})
            name = jd_payload.get("name", "N/A")
            description = jd_payload.get("description", "...")[:100] + "..."
            score = item.get("score", "N/A")

            print(f"- JD Name: {name}")
            print(f"  Description: {description}")
            print(f"  Score: {score}")
            print("-" * 60)
    else:
        print("❌ Qdrant search failed:", response.text)

# ---------- Run ----------
if __name__ == "__main__":
    jd_folder = "job_descriptions"  # Make sure this folder has your PDFs
    upload_jds_to_qdrant(jd_folder)
    
    # Simulate resume search
    sample_resume_text = "Python developer with experience in backend systems and cloud technologies."
    search_qdrant(sample_resume_text)
