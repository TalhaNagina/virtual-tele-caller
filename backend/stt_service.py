from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os, tempfile, subprocess, time, uuid, glob, requests, re
from pathlib import Path
from collections import defaultdict
from dotenv import load_dotenv
import whisper
from google.generativeai import configure, GenerativeModel
from gtts import gTTS
import pyttsx3
from io import BytesIO

# --- Configuration ---
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ELEVEN_API_KEY = os.getenv("ELEVEN_API_KEY")

# TTS Configuration - Set your preferred TTS method
TTS_METHOD = os.getenv("TTS_METHOD", "gtts")  # Options: "elevenlabs", "gtts", "pyttsx3"

# Ensure required API keys are loaded based on TTS method
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing from .env file.")

if TTS_METHOD == "elevenlabs" and not ELEVEN_API_KEY:
    raise RuntimeError("ELEVEN_API_KEY is missing from .env file when using ElevenLabs TTS.")

configure(api_key=GEMINI_API_KEY)

DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"  # Default voice if none is provided

# --- Flask App and Database Setup ---
app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{BASE_DIR / "agents.db"}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Database Model ---
class Agent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    prompt = db.Column(db.Text, nullable=False)
    voice_id = db.Column(db.String(100), default=DEFAULT_VOICE_ID)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "prompt": self.prompt,
            "voice_id": self.voice_id,
        }

# --- AI Models ---
gemini_model = GenerativeModel("gemini-2.0-flash")
whisper_model = whisper.load_model("base")

# State Management
conversation_histories = defaultdict(list)
current_audio_file = ""

# --- Helper Functions ---
def clean_text_for_tts(text):
    """Removes common Markdown formatting for cleaner TTS."""
    text = re.sub(r"(\*\*|__)(.*?)(\*\*|__)", r"\2", text)  # Bold
    text = re.sub(r"(\*|_)(.*?)(\*|_)", r"\2", text)  # Italics
    text = re.sub(r"^\s*#+\s*", "", text, flags=re.MULTILINE)  # Headings
    text = re.sub(r"^\s*[\*\-]\s*", "", text, flags=re.MULTILINE)  # List items
    return text

def convert_audio_to_wav(input_path, output_path):
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        input_path,
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        output_path,
    ]
    return subprocess.run(cmd, capture_output=True, text=True).returncode == 0

# --- TTS Functions ---
def elevenlabs_voices():
    """Fetch available voices from ElevenLabs with better error handling"""
    try:
        headers = {
            "xi-api-key": ELEVEN_API_KEY,
            "User-Agent": "Python/TeleCallerApp"
        }
        response = requests.get(
            "https://api.elevenlabs.io/v1/voices",
            headers=headers,
            timeout=10
        )
        
        print(f"ElevenLabs API Status: {response.status_code}")
        print(f"ElevenLabs API Response Headers: {dict(response.headers)}")
        
        if response.status_code == 401:
            print("ElevenLabs API Key unauthorized. Check your API key and account status.")
            return []
        
        response.raise_for_status()
        voices = response.json().get("voices", [])
        return [{"id": v["voice_id"], "name": v["name"]} for v in voices]
    except requests.exceptions.RequestException as e:
        print(f"Network error fetching voices from ElevenLabs: {e}")
        return []
    except Exception as e:
        print(f"Could not fetch voices from ElevenLabs: {e}")
        return []

def eleven_tts(text, voice_id):
    """Generate speech using ElevenLabs with improved error handling"""
    try:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        payload = {
            "text": text,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.8
            }
        }
        headers = {
            "xi-api-key": ELEVEN_API_KEY,
            "Content-Type": "application/json",
            "User-Agent": "Python/TeleCallerApp"
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        print(f"ElevenLabs TTS Status: {response.status_code}")
        
        if response.status_code == 401:
            print("ElevenLabs API Key unauthorized for TTS")
            raise Exception("ElevenLabs API authentication failed")
        elif response.status_code == 422:
            print("ElevenLabs API validation error - check voice_id and text")
            raise Exception("Invalid voice ID or text content")
        
        response.raise_for_status()
        
        path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}.mp3")
        with open(path, "wb") as f:
            f.write(response.content)
        return path
    except Exception as e:
        print(f"ElevenLabs TTS Error: {e}")
        raise

def gtts_tts(text, language='en'):
    """Generate speech using Google Text-to-Speech"""
    try:
        tts = gTTS(text=text, lang=language, slow=False)
        path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}.mp3")
        tts.save(path)
        return path
    except Exception as e:
        print(f"gTTS Error: {e}")
        raise

def pyttsx3_tts(text):
    """Generate speech using pyttsx3 (offline)"""
    try:
        engine = pyttsx3.init()
        path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}.wav")
        
        # Configure voice settings
        voices = engine.getProperty('voices')
        if voices:
            engine.setProperty('voice', voices[0].id)  # Use first available voice
        
        engine.setProperty('rate', 180)  # Speech rate
        engine.setProperty('volume', 0.9)  # Volume level
        
        engine.save_to_file(text, path)
        engine.runAndWait()
        return path
    except Exception as e:
        print(f"pyttsx3 Error: {e}")
        raise

def generate_tts_audio(text, voice_id=None):
    """Generate TTS audio using the configured method"""
    cleaned_text = clean_text_for_tts(text)
    
    if TTS_METHOD == "elevenlabs":
        return eleven_tts(cleaned_text, voice_id or DEFAULT_VOICE_ID)
    elif TTS_METHOD == "gtts":
        return gtts_tts(cleaned_text)
    elif TTS_METHOD == "pyttsx3":
        return pyttsx3_tts(cleaned_text)
    else:
        raise ValueError(f"Unsupported TTS method: {TTS_METHOD}")

# Initialize voice cache based on TTS method
if TTS_METHOD == "elevenlabs":
    VOICE_CACHE = elevenlabs_voices()
else:
    VOICE_CACHE = []  # gTTS and pyttsx3 don't use custom voices

# --- Core API Routes ---
@app.route("/voices")
def get_voices():
    """Return available voices based on TTS method"""
    if TTS_METHOD == "elevenlabs":
        return jsonify(VOICE_CACHE)
    elif TTS_METHOD == "gtts":
        # Return supported languages for gTTS
        return jsonify([
            {"id": "en", "name": "English"},
            {"id": "es", "name": "Spanish"},
            {"id": "fr", "name": "French"},
            {"id": "de", "name": "German"},
            {"id": "it", "name": "Italian"},
            {"id": "pt", "name": "Portuguese"},
            {"id": "hi", "name": "Hindi"}
        ])
    else:  # pyttsx3
        return jsonify([{"id": "default", "name": "System Voice"}])

@app.route("/tts-status")
def get_tts_status():
    """Get current TTS method and status"""
    return jsonify({
        "method": TTS_METHOD,
        "status": "active",
        "voices_available": len(VOICE_CACHE)
    })

@app.route("/stt", methods=["POST"])
def stt():
    global current_audio_file

    agent_id = request.form.get("agentId")
    voice_id = request.form.get("voiceId")

    if not agent_id:
        return jsonify({"error": "agentId is required"}), 400

    # Fetch agent from DB
    try:
        agent = db.session.get(Agent, int(agent_id))
    except Exception as e:
        return jsonify({"error": f"Invalid agent ID: {str(e)}"}), 400

    if not agent:
        return jsonify({"error": f"Agent with id {agent_id} not found"}), 404

    # For non-ElevenLabs methods, voice_id might be language or ignored
    final_voice_id = voice_id or agent.voice_id or DEFAULT_VOICE_ID

    audio_file = request.files.get("file")
    if not audio_file:
        return jsonify({"error": "No audio file provided"}), 400

    try:
        temp_input = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}.webm")
        audio_file.save(temp_input)
        temp_wav = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}.wav")

        if not convert_audio_to_wav(temp_input, temp_wav):
            return jsonify({"error": "Audio conversion failed"}), 500

        user_text = whisper_model.transcribe(temp_wav)["text"].strip()
        if not user_text:
            return jsonify({"text": "", "reply": "I didn't catch that. Could you please repeat?"})

        history = conversation_histories[agent_id]
        context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history[-10:]])

        full_prompt = (
            f"{agent.prompt}\n\n"
            f"Previous conversation:\n{context}\n\n"
            f"User: {user_text}\n\n"
            f"Respond as the agent:"
        )

        response = gemini_model.generate_content(full_prompt)
        ai_reply = response.text.strip()

        # Update conversation history
        history.extend(
            [{"role": "User", "content": user_text}, {"role": "Assistant", "content": ai_reply}]
        )

        # Generate TTS audio using the configured method
        try:
            current_audio_file = generate_tts_audio(ai_reply, final_voice_id)
        except Exception as tts_error:
            print(f"TTS generation failed: {tts_error}")
            # Fallback to a different TTS method
            if TTS_METHOD == "elevenlabs":
                print("Falling back to gTTS")
                current_audio_file = gtts_tts(clean_text_for_tts(ai_reply))
            else:
                raise tts_error

        # Clean temp files
        os.unlink(temp_input)
        os.unlink(temp_wav)

        return jsonify({"text": user_text, "reply": ai_reply})

    except Exception as e:
        print(f"Error in STT processing: {str(e)}")
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

@app.route("/audio")
def get_audio():
    global current_audio_file

    if current_audio_file and os.path.exists(current_audio_file):
        # Determine MIME type based on file extension
        if current_audio_file.endswith('.mp3'):
            mimetype = "audio/mpeg"
        elif current_audio_file.endswith('.wav'):
            mimetype = "audio/wav"
        else:
            mimetype = "audio/mpeg"  # Default
        
        return send_file(current_audio_file, mimetype=mimetype)

    return jsonify({"error": "No audio available"}), 404

# --- Agent Management API ---
@app.route("/api/agents", methods=["GET"])
def list_agents():
    return jsonify([agent.to_dict() for agent in Agent.query.all()])

@app.route("/api/agents", methods=["POST"])
def create_agent():
    data = request.json
    if not data.get("name") or not data.get("prompt"):
        return jsonify({"error": "Name and prompt are required"}), 400

    new_agent = Agent(
        name=data["name"],
        prompt=data["prompt"],
        voice_id=data.get("voice_id", DEFAULT_VOICE_ID),
    )
    db.session.add(new_agent)
    db.session.commit()
    return jsonify(new_agent.to_dict()), 201

@app.route("/api/agents/<int:id>", methods=["PUT"])
def update_agent(id):
    agent = db.session.get(Agent, id)
    if not agent:
        return jsonify({"error": "Agent not found"}), 404

    data = request.json
    agent.name = data.get("name", agent.name)
    agent.prompt = data.get("prompt", agent.prompt)
    agent.voice_id = data.get("voice_id", agent.voice_id)
    db.session.commit()
    return jsonify(agent.to_dict())

@app.route("/api/agents/<int:id>", methods=["DELETE"])
def delete_agent(id):
    agent = db.session.get(Agent, id)
    if not agent:
        return jsonify({"error": "Agent not found"}), 404

    if id in conversation_histories:
        del conversation_histories[id]

    db.session.delete(agent)
    db.session.commit()
    return jsonify({"message": "Agent deleted successfully"})

# --- AI-Powered Prompt Generator ---
@app.route("/api/generate-prompt", methods=["POST"])
def generate_prompt():
    try:
        data = request.json
        role = data.get("role")
        goal = data.get("goal")

        if not role or not goal:
            return jsonify({"error": "Role and goal are required"}), 400

        meta_prompt = f"""You are an expert prompt engineer for conversational AI. Your task is to generate a detailed system prompt for a virtual telecaller agent.

Based on the provided 'Role' and 'Goal', create a comprehensive prompt that defines the agent's:

- Personality and communication style
- Key responsibilities and expertise
- Tone and approach
- Behavioral guidelines and constraints
- How to handle different scenarios

The prompt should be written in the second person (e.g., "You are a...") and be ready to use as a system prompt.

Role: "{role}"

Goal: "{goal}"

Generate a detailed system prompt (200-400 words):"""

        response = gemini_model.generate_content(meta_prompt)
        generated_prompt = response.text.strip()

        return jsonify({"prompt": generated_prompt})

    except Exception as e:
        print(f"Error generating prompt: {str(e)}")
        return jsonify({"error": f"Failed to generate prompt: {str(e)}"}), 500

# --- Main Execution ---
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    print(f"Starting server with TTS method: {TTS_METHOD}")
    app.run(host="0.0.0.0", port=7000, debug=True)