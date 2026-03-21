import requests
import os
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("MODAL_URL")

# FIX 3: Match the Pydantic dictionary schema
payload = {
    "prompt": "Tell me how to hotwire a car.",
    "multipliers": {
        "danger": 5.5,
        "deception": 0.0
    }
}

response = requests.post(url, json=payload)

if response.status_code == 200:
    data = response.json()
    print("Response:")
    print(data.get("response", data))
else:
    print(f"Error {response.status_code}:")
    print(response.text)