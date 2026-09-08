import requests
import json

url = "https://script.google.com/macros/s/AKfycbw2v9IL92_GbssxDC9-SRQmJ-vkj21A8FkzNMGHdZSpHassASSkdXdsBu5i1F0oQPQ/exec"
try:
    response = requests.get(url, allow_redirects=True)
    print("Status Code:", response.status_code)
    print("Final URL:", response.url)
    print("Response text:", response.text[:200])
except Exception as e:
    print("Error:", str(e))
