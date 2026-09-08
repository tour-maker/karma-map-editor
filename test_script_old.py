import requests

url = "https://script.google.com/macros/s/AKfycby6PYhg46pRnBkkcAfp-RkmreiGHIkwYLcNXI03eujyc1bSSTH0kZZ93auAm7XtcjI/exec"
try:
    response = requests.get(url, allow_redirects=True)
    print("Status Code:", response.status_code)
    print("Final URL:", response.url)
    print("Response text:", response.text[:200])
except Exception as e:
    print("Error:", str(e))
