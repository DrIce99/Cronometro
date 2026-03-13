from flask import Flask, request, jsonify, render_template
import json
import os

app = Flask(__name__)
DB_FILE = os.path.join(os.path.dirname(__file__), 'racing_db.json')

# Inizializza il file se non esiste
if not os.path.exists(DB_FILE):
    with open(DB_FILE, 'w') as f:
        json.dump([], f)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/db', methods=['GET'])
def get_db():
    try:
        # Se il file non esiste, crealo come lista vuota
        if not os.path.exists(DB_FILE):
            with open(DB_FILE, 'w') as f:
                json.dump([], f)
            return jsonify([])

        with open(DB_FILE, 'r') as f:
            content = f.read().strip()
            if not content: # Se il file è totalmente vuoto (0 byte)
                return jsonify([])
            return jsonify(json.loads(content))
    except Exception as e:
        print(f"ERRORE SERVER: {e}") # Questo apparirà nel terminale Python
        return jsonify({"error": str(e)}), 500


@app.route('/api/save', methods=['POST'])
def save_db():
    try:
        nuova_gara = request.json
        db = []

        # 1. Controlla se il file esiste e non è vuoto
        if os.path.exists(DB_FILE) and os.path.getsize(DB_FILE) > 0:
            with open(DB_FILE, 'r') as f:
                try:
                    db = json.load(f)
                except json.JSONDecodeError:
                    db = [] # Se il JSON è corrotto, ricomincia da zero

        # 2. Aggiungi i nuovi dati
        db.append(nuova_gara)

        # 3. Salva tutto
        with open(DB_FILE, 'w') as f:
            json.dump(db, f, indent=4)
            
        return jsonify({"status": "success"})
    
    except Exception as e:
        print(f"ERRORE CRITICO SALVATAGGIO: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/delete/<gara_id>", methods=["DELETE"])
def delete_gara(gara_id):
    try:
        # carica database
        if os.path.exists(DB_FILE) and os.path.getsize(DB_FILE) > 0:
            with open(DB_FILE, "r") as f:
                db = json.load(f)
        else:
            db = []

        # rimuove la gara con quell'id
        db = [g for g in db if str(g.get("id")) != str(gara_id)]

        # salva il database aggiornato
        with open(DB_FILE, "w") as f:
            json.dump(db, f, indent=4)

        return jsonify({"status": "deleted"})

    except Exception as e:
        print(f"ERRORE DELETE: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
