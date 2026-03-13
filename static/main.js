let startTime, timerInterval;
let isRunning = false;
let parzialiSessioneCorrente = [];
let idUltimaGara = null;
let dbLocale = [];

const display = document.getElementById('main-timer');
const deltaSettore = document.getElementById('delta-settore');
const deltaTotale = document.getElementById('delta-totale');
const btnStartStop = document.getElementById('btnStartStop');
const btnParziale = document.getElementById('btnParziale');
const btnContinua = document.getElementById('btnContinua'); // Assicurati che l'ID esista nel HTML
const overlay = document.getElementById('overlayClassifica');
const listaClassifica = document.getElementById('listaClassifica');

console.log("JS CARICATO CORRETTAMENTE");
console.log("Pulsante Start:", btnStartStop);

caricaDbDalServer();

// --- DATABASE ---
async function caricaDbDalServer() {
    try {
        const response = await fetch('/api/db');
        dbLocale = await response.json();
        console.log("Database sincronizzato:", dbLocale);
    } catch (e) {
        console.error("Errore sincronizzazione:", e);
    }
}

function getMigliorSessioneTotale(pilota, percorso, tipo, meteo) {
    let migliorGara = null;
    let tempoTotaleMinimo = Infinity;

    dbLocale.filter(g => g.pilota === pilota && g.percorso === percorso && g.tipo === tipo && g.meteo === meteo)
    .forEach(gara => {
        // L'ultimo parziale registrato è il tempo totale della gara
        const tempoFinale = gara.parziali[gara.parziali.length - 1].ms;
        if (tempoFinale < tempoTotaleMinimo) {
            tempoTotaleMinimo = tempoFinale;
            migliorGara = gara;
        }
    });

    return migliorGara;
}

function getMigliorSessionePerSettore(pilota, percorso, indice, tipo, meteo) {
    let migliorGara = null;
    let tempoMinimo = Infinity;

    dbLocale.filter(g => g.pilota === pilota && g.percorso === percorso && g.tipo === tipo && g.meteo === meteo)
      .forEach(gara => {
          if (gara.parziali && gara.parziali[indice]) {
              const durRecord = gara.parziali[indice].ms - (indice > 0 ? gara.parziali[indice-1].ms : 0);
              if (durRecord < tempoMinimo) {
                  tempoMinimo = durRecord;
                  migliorGara = gara;
              }
          }
      });
    return migliorGara;
}

// FORMATO DECIMI (MM:SS.D)
function formatTime(ms) {
    const m = String(Math.floor(ms / 60000)).padStart(2, '0');
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    // Prende solo la prima cifra dei centesimi per visualizzare i decimi
    const d = Math.floor((ms % 1000) / 100); 
    return `${m}:${s}.${d}`;
}

// --- AZIONI ---

btnStartStop.addEventListener('click', async () => {
    const pilota = document.getElementById('pilota').value || "Default";
    const percorso = document.getElementById('percorso').value || "Rally 1";
    const tipo = document.getElementById('tipo').value || "Prova 1";
    const meteo = document.getElementById('meteo').value || "Asciutto";

    if (!isRunning) {
        await caricaDbDalServer();
        startTime = Date.now();
        parzialiSessioneCorrente = [];
        timerInterval = setInterval(() => {
            display.innerText = formatTime(Date.now() - startTime);
        }, 100); // Aggiornamento ogni 100ms è sufficiente per i decimi
        
        btnStartStop.innerText = "ARRIVO";
        btnStartStop.classList.replace('start', 'stop');
        btnParziale.disabled = false;
        btnContinua.style.display = 'none'; // Nascondi quando riparti
        isRunning = true;
        
        deltaSettore.innerText = "SETT: --";
        deltaTotale.innerText = "TOT: --";
        deltaSettore.className = "delta-box";
        deltaTotale.className = "delta-box";
    } else {
        clearInterval(timerInterval);
        const tempoFinaleMs = Date.now() - startTime;
        
        // 1. Delta Settore (Ultimo)
        const indiceUltimo = parzialiSessioneCorrente.length;
        const migliorGaraSettore = getMigliorSessionePerSettore(pilota, percorso, indiceUltimo, tipo, meteo);

        if (migliorGaraSettore && migliorGaraSettore.parziali && migliorGaraSettore.parziali[indiceUltimo]) {
            const durAttuale = tempoFinaleMs - (indiceUltimo > 0 ? parzialiSessioneCorrente[indiceUltimo-1].ms : 0);
            const durRecord = migliorGaraSettore.parziali[indiceUltimo].ms - (indiceUltimo > 0 ? migliorGaraSettore.parziali[indiceUltimo-1].ms : 0);
            const diffS = (durAttuale - durRecord) / 1000;
            deltaSettore.innerText = `SETT: ${diffS > 0 ? '+' : ''}${diffS.toFixed(2)}s`;
            deltaSettore.className = "delta-box " + (diffS > 0 ? "slower" : "faster");
        }

        // 2. Delta Totale
        const migliorGaraTotale = getMigliorSessioneTotale(pilota, percorso, tipo, meteo);

        if (migliorGaraTotale && migliorGaraTotale.parziali && migliorGaraTotale.parziali.length > 0) {
            const recordTotaleMs = migliorGaraTotale.parziali[migliorGaraTotale.parziali.length - 1].ms;
            const diffT = (tempoFinaleMs - recordTotaleMs) / 1000;
            deltaTotale.innerText = `TOT: ${diffT > 0 ? '+' : ''}${diffT.toFixed(2)}s`;
            deltaTotale.className = "delta-box " + (diffT > 0 ? "slower" : "faster");
        } else {
            deltaTotale.innerText = "TOT: NEW";
            deltaTotale.className = "delta-box faster";
        }

        idUltimaGara = Date.now(); 

        parzialiSessioneCorrente.push({
            parziale_numero: indiceUltimo + 1,
            tempo: formatTime(tempoFinaleMs),
            ms: tempoFinaleMs
        });
        
        await salvaGaraNelDatabase();

        btnStartStop.innerText = "START";
        btnStartStop.classList.replace('stop', 'start');
        btnParziale.disabled = true;
        btnContinua.style.display = 'block'; // MOSTRA IL PULSANTE CONTINUA
        isRunning = false;
    }
});

btnParziale.addEventListener('click', registraParziale);

function registraParziale() {
    const tempoAssolutoAttuale = Date.now() - startTime;
    const indiceAttuale = parzialiSessioneCorrente.length;
    const pilota = document.getElementById('pilota').value || "Default";
    const percorso = document.getElementById('percorso').value || "Rally 1";
    const tipo = document.getElementById('tipo').value || "Prova 1";
    const meteo = document.getElementById('meteo').value || "Asciutto";

    const migliorGara = getMigliorSessionePerSettore(pilota, percorso, indiceAttuale, tipo, meteo);
    const bestSettoreAssoluto = getBestSectorOverall(pilota, percorso, indiceAttuale, tipo, meteo);
    
    if (migliorGara && migliorGara.parziali && migliorGara.parziali[indiceAttuale]) {
        const durAttuale = tempoAssolutoAttuale - (indiceAttuale > 0 ? parzialiSessioneCorrente[indiceAttuale-1].ms : 0);
        const durRecord = migliorGara.parziali[indiceAttuale].ms - (indiceAttuale > 0 ? migliorGara.parziali[indiceAttuale-1].ms : 0);
        const diff = (durAttuale - durRecord) / 1000;
        
        // AGGIORNAMENTO TESTO SETTORE
        deltaSettore.innerText = `P${indiceAttuale + 1}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}s`;
        deltaSettore.className = "delta-box " + (diff > 0 ? "slower" : "faster");
    } else {
        deltaSettore.innerText = `P${indiceAttuale + 1}: NEW`;
        deltaSettore.className = "delta-box faster";
    }

    parzialiSessioneCorrente.push({
        parziale_numero: indiceAttuale + 1,
        tempo: formatTime(tempoAssolutoAttuale),
        ms: tempoAssolutoAttuale
    });
}

// Filtri attivi: di default tutti attivi all'apertura
let filtri = { pilota: true, percorso: true, tipo: true, asfalto: true };

// Funzione per attivare/disattivare i filtri tramite i pulsanti nell'overlay
async function toggleFilter (key) {
    filtri[key] = !filtri[key];
    const btn = document.getElementById(`f-${key}`);
    if (btn) btn.classList.toggle('active', filtri[key]);
    await mostraClassifica(); // Ricarica la lista filtrata
};

function chiudiClassifica() {
    overlay.classList.remove('active');
    // Il pulsante continua rimane visibile fino al prossimo START
}

// Funzione chiamata quando apri l'overlay (RANK)
btnContinua.addEventListener('click', async () => {
    // Sincronizza i filtri dell'overlay con i valori attuali della gara
    document.getElementById('f-pilota-val').value = document.getElementById('pilota').value;
    document.getElementById('f-percorso-val').value = document.getElementById('percorso').value;
    document.getElementById('f-tipo-val').value = document.getElementById('tipo').value;
    document.getElementById('f-meteo-val').value = document.getElementById('meteo').value;

    overlay.classList.add('active');
    await mostraClassifica();
});

async function mostraClassifica() {
    const response = await fetch('/api/db');
    const db = await response.json();

    // Leggi i parametri dai filtri dell'overlay
    const fPilota = document.getElementById('f-pilota-val').value.toLowerCase();
    const fPercorso = document.getElementById('f-percorso-val').value.toLowerCase();
    const fTipo = document.getElementById('f-tipo-val').value.toLowerCase();
    const fMeteo = document.getElementById('f-meteo-val').value;

    // Controlla se le checkbox sono attive
    const checkP = document.getElementById('f-pilota-active').classList.contains('active');;
    const checkPerc = document.getElementById('f-percorso-active').classList.contains('active');;
    const checkTipo = document.getElementById('f-tipo-active').classList.contains('active');;
    const checkM = document.getElementById('f-meteo-active').classList.contains('active');;

    let sessioniFiltrate = db.filter(g => {
        const matchP = !checkP || (g.pilota && g.pilota.toLowerCase().includes(fPilota));
        const matchPerc = !checkPerc || (g.percorso && g.percorso.toLowerCase().includes(fPercorso));
        const matchTipo = !checkTipo || (g.tipo && g.tipo.toLowerCase().includes(fTipo)); 
        const matchM = !checkM || g.meteo === fMeteo;
        return matchP && matchPerc && matchTipo && matchM;
    });

    // Ordinamento per tempo totale
    sessioniFiltrate.sort((a, b) => a.parziali[a.parziali.length-1].ms - b.parziali[b.parziali.length-1].ms);

    // Rendering
    listaClassifica.innerHTML = "";
    sessioniFiltrate.forEach((g, index) => {
        const div = document.createElement('div');
        div.className = "rank-item" + (g.id === idUltimaGara ? " highlight" : "");
        
        const tempoTot = g.parziali[g.parziali.length-1].tempo;

        // Costruiamo le stringhe solo se il filtro NON è attivo
        const spanPilota = !checkP ? `<span>${g.pilota}</span>` : "";
        const spanPercorso = !checkPerc ? `<span class="tag-sub">[${g.percorso}]</span>` : "";
        const spanTipo = !checkTipo ? `<span class="tag-sub">[${g.tipo}]</span>` : "";
        const spanMeteo = !checkM ? `<span class="tag-sub">[${g.meteo}]</span>` : "";

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;">
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="font-weight: bold;">${index + 1}.</span>
                    ${spanPilota}
                    ${spanPercorso}
                    ${spanTipo}
                    ${spanMeteo}
                </div>
                <div style="font-family: monospace; font-weight: bold; font-size: 1.1em;">
                    ${tempoTot}
                </div>
            </div>
        `;
        listaClassifica.appendChild(div);
    });
}


// Evento click sul pulsante Giallo (RANK / CONTINUA)
btnContinua.onclick = async () => {
    // Sincronizza i filtri dell'overlay con i valori attuali della gara
    document.getElementById('f-pilota-val').value = document.getElementById('pilota').value;
    document.getElementById('f-percorso-val').value = document.getElementById('percorso').value;
    document.getElementById('f-tipo-val').value = document.getElementById('tipo').value;
    document.getElementById('f-meteo-val').value = document.getElementById('meteo').value;

    overlay.classList.add('active');
    await mostraClassifica();
};

// Funzione Esporta JSON corretta
document.getElementById('btnEsporta').onclick = async () => {
    const response = await fetch('/api/db');
    const data = await response.text();
    const blob = new Blob([data], {type: 'application/json'});
    if(!data) {
        alert("Database vuoto!");
        return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rally_log_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

async function salvaGaraNelDatabase() {
    const nuovaGara = {
        id: idUltimaGara,
        data: new Date().toLocaleString(),
        pilota: document.getElementById('pilota').value || "Default",
        percorso: document.getElementById('percorso').value || "Rally 1",
        tipo: document.getElementById('tipo').value || "Prova 1",
        meteo: document.getElementById('meteo').value || "Asciutto",
        parziali: [...parzialiSessioneCorrente]
    };

    try {
        await fetch('/api/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(nuovaGara)
        });
        console.log("Gara salvata sul server!");
    } catch (e) {
        console.error("Errore nel salvataggio server, provo locale...", e);
        // Fallback opzionale su localStorage
    }
    await caricaDbDalServer(); 
}


function toggleFiltroManuale(tipo) {
    const btn = document.getElementById(`f-${tipo}-active`);
    
    // Cambia lo stato (toggle) della classe e del testo
    if (btn.classList.contains('active')) {
        btn.classList.replace('active', 'off');
    } else {
        btn.classList.replace('off', 'active');
    }
    
    mostraClassifica(); // Ricarica i dati filtrati
}

function getBestSectorOverall(pilota, percorso, indice, tipo, meteo) {
    let best = Infinity;

    dbLocale
    .filter(g => g.pilota === pilota && g.percorso === percorso && g.tipo === tipo && g.meteo === meteo)
    .forEach(gara => {
        if (gara.parziali && gara.parziali[indice]) {
            const dur = gara.parziali[indice].ms - (indice > 0 ? gara.parziali[indice-1].ms : 0);
            if (dur < best) best = dur;
        }
    });

    return best;
}