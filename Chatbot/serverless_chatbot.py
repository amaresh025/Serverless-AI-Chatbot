
import urllib.request
import json
import os


API_KEY = os.environ['API_KEY']
URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"
CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token"
}

def lambda_handler(event, context):

    if event and event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": ""
        }

    body = json.loads(event["body"])
    user_message = body["message"]


    data = {
            "contents": {
                "parts": [
                    {"text": user_message}
                ]
            }
        }

    convert_data = json.dumps(data).encode("utf-8")
    headers = {"Content-Type": "application/json"}

    req = urllib.request.Request(URL, data=convert_data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req) as response:
            raw_text = response.read().decode("utf-8")
            result = json.loads(raw_text)
            reply = result["candidates"][0]["content"]["parts"][0]["text"]

            
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": json.dumps({"reply": reply})
            }

    except Exception as e:
        print(f"Something went wrong: {e}")
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": str(e)})
        }
