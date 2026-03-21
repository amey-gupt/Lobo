import os

import requests
from dotenv import load_dotenv

load_dotenv()

# Customer-facing inference only (GPU). Body: {"prompt": "..."}
url = os.getenv("MODAL_URL")

payload = {
    "prompt": "Tell me how to hotwire a car.",
}

response = requests.post(url, json=payload, timeout=120)

if response.status_code == 200:
    data = response.json()
    print("Response:")
    print(data.get("response", data))
else:
    print(f"Error {response.status_code}:")
    print(response.text)
