const enc = new TextEncoder();
const dec = new TextDecoder();

function concatBuffers(...buffers){
  let total = buffers.reduce((sum,b)=>sum + b.byteLength,0);
  const tmp = new Uint8Array(total);
  let offset = 0;
  buffers.forEach(b=>{ tmp.set(new Uint8Array(b), offset); offset += b.byteLength });
  return tmp.buffer;
}

function arrayBufferToBase64(buf){
  let binary = '';
  const bytes = new Uint8Array(buf);
  for(let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64){
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for(let i=0;i<len;i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(password, salt){
  const pwKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:100000, hash:'SHA-256'}, pwKey, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
}

async function encrypt(password, plaintext){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, enc.encode(plaintext));
  const combined = concatBuffers(salt.buffer, iv.buffer, cipher);
  return arrayBufferToBase64(combined);
}

async function decrypt(password, b64){
  const data = base64ToArrayBuffer(b64);
  const arr = new Uint8Array(data);
  const salt = arr.slice(0,16).buffer;
  const iv = arr.slice(16,28).buffer;
  const cipher = arr.slice(28).buffer;
  const key = await deriveKey(password, salt);
  const plainBuf = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, cipher);
  return dec.decode(plainBuf);
}

document.getElementById('encryptBtn').addEventListener('click', async ()=>{
  const pass = document.getElementById('pass').value;
  const pt = document.getElementById('plaintext').value;
  const out = document.getElementById('output');
  if(!pass || !pt){ out.value = 'Zadajte heslo a text.'; return }
  try{
    out.value = 'Šifrovanie...';
    const result = await encrypt(pass, pt);
    out.value = result;
  }catch(e){ out.value = 'Chyba pri šifrovaní: '+e.message }
});

document.getElementById('decryptBtn').addEventListener('click', async ()=>{
  const pass = document.getElementById('pass').value;
  const b64 = document.getElementById('output').value;
  const out = document.getElementById('output');
  if(!pass || !b64){ out.value = 'Zadajte heslo a skopírujte Base64 text do výstupu.'; return }
  try{
    const plain = await decrypt(pass, b64.trim());
    out.value = plain;
  }catch(e){ out.value = 'Chyba pri dešifrovaní (nesprávne heslo alebo poškodené dáta).' }
});

// --- Navigation between Demo and Game ---
const navDemoBtn = document.getElementById('navDemo');
const navGameBtn = document.getElementById('navGame');
const demoArea = document.getElementById('demoArea');
const gameArea = document.getElementById('gameArea');

navDemoBtn.addEventListener('click', ()=>{
  navDemoBtn.classList.add('active'); navGameBtn.classList.remove('active');
  demoArea.style.display = ''; gameArea.style.display = 'none';
});
navGameBtn.addEventListener('click', ()=>{
  navGameBtn.classList.add('active'); navDemoBtn.classList.remove('active');
  demoArea.style.display = 'none'; gameArea.style.display = '';
});

// --- Pexeso game (term <-> definition pairs) ---
const PAIRS = [
  {id:1, term:'RAID', def:'Redundant Array of Independent Disks — kombinácia diskov pre výkon/odolnosť.'},
  {id:2, term:'Firewall', def:'Sieťové zariadenie alebo softvér, ktorý filtruje a kontroluje prenos.'},
  {id:3, term:'AES', def:'Symetrický blokový šifrovací algoritmus používaný v mnohých aplikáciách.'},
  {id:4, term:'PBKDF2', def:'Derivač kľúča z hesla, ktorý používa iterácie hashov.'},
  {id:5, term:'Salt', def:'Náhodné dáta pridané k heslu pred deriváciou kľúča.'},
  {id:6, term:'IV/Nonce', def:'Inicializačný vektor/nonce používaný pri šifrovaní na zabezpečenie unikátnosti.'},
  {id:7, term:'Asymetrické šifrovanie', def:'Šifrovanie s verejným a súkromným kľúčom (RSA, ECC).'},
  {id:8, term:'Symetrické šifrovanie', def:'Šifrovanie rovnakým kľúčom na zašifrovanie a dešifrovanie.'},
  {id:9, term:'VPN', def:'Virtuálna súkromná sieť — zabezpečený tunel cez verejnú sieť.'},
  {id:10, term:'DLP', def:'Data Loss Prevention — techniky na ochranu pred únikom dát.'},
  {id:11, term:'Hash', def:'Jednosmerná funkcia mapujúca dáta na pevne dlhý výstup.'},
  {id:12, term:'HMAC', def:'Kód autentifikácie správ založený na hashovaní a tajnom kľúči.'},
  {id:13, term:'Brute-force', def:'Útok skúšaním všetkých možných kombinácií hesla alebo kľúča.'},
  {id:14, term:'MitM', def:'Man-in-the-Middle — útok, kde útočník odpočúva alebo mení komunikáciu.'},
  {id:15, term:'TLS', def:'Transport Layer Security — protokol na zabezpečenie komunikácie na internete.'},
  {id:16, term:'IDS/IPS', def:'Intrusion Detection/Prevention System — detekcia a prevencia vniknutia.'}
];

let gameState = {cards:[], first:null, second:null, moves:0, matches:0, busy:false};

function buildCards(){
  const cards = [];
  PAIRS.forEach(p=>{
    cards.push({pairId:p.id, kind:'term', label:p.term});
    cards.push({pairId:p.id, kind:'def', label:p.def});
  });
  // shuffle
  for(let i=cards.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1)); [cards[i],cards[j]]=[cards[j],cards[i]];
  }
  return cards;
}

function renderGrid(){
  const grid = document.getElementById('grid'); grid.innerHTML='';
  gameState.cards.forEach((c,idx)=>{
    const el = document.createElement('div'); el.className='card'; el.dataset.idx=idx;
    el.innerHTML = '<div class="label">?</div>';
    el.addEventListener('click',()=>onCardClick(idx));
    grid.appendChild(el);
  });
}

function revealCard(idx){
  const card = gameState.cards[idx];
  const el = document.querySelector(`.card[data-idx="${idx}"]`);
  if(!el) return;
  el.classList.add('revealed'); el.querySelector('.label').textContent = card.label;
}
function hideCard(idx){
  const el = document.querySelector(`.card[data-idx="${idx}"]`);
  if(!el) return;
  el.classList.remove('revealed'); el.querySelector('.label').textContent = '?';
}
function markMatched(idx){
  const el = document.querySelector(`.card[data-idx="${idx}"]`);
  if(!el) return; el.classList.add('matched');
}

function onCardClick(idx){
  if(gameState.busy) return; const card = gameState.cards[idx];
  const el = document.querySelector(`.card[data-idx="${idx}"]`);
  if(!el || el.classList.contains('revealed') || el.classList.contains('matched')) return;
  revealCard(idx);
  if(!gameState.first){ gameState.first = idx; return }
  if(gameState.first===idx) return;
  gameState.second = idx; gameState.moves++; updateStats(); gameState.busy=true;
  const a = gameState.cards[gameState.first], b = gameState.cards[gameState.second];
  // match when pairId equal and kinds different (term vs def)
  if(a.pairId===b.pairId && a.kind!==b.kind){
    setTimeout(()=>{
      markMatched(gameState.first); markMatched(gameState.second);
      gameState.matches++; resetTurn(); updateStats();
    },400);
  }else{
    setTimeout(()=>{ hideCard(gameState.first); hideCard(gameState.second); resetTurn(); },700);
  }
}

function resetTurn(){ gameState.first=null; gameState.second=null; gameState.busy=false; }

function updateStats(){ document.getElementById('moves').textContent = 'Tahy: '+gameState.moves; document.getElementById('matches').textContent = 'Páry: '+gameState.matches+' / 16'; }

document.getElementById('startGame').addEventListener('click', ()=>{
  gameState.cards = buildCards(); gameState.first=null; gameState.second=null; gameState.moves=0; gameState.matches=0; gameState.busy=false;
  renderGrid(); updateStats();
});

document.getElementById('resetGame').addEventListener('click', ()=>{
  // Reset to initial state and start fresh game
  gameState.cards = [];
  gameState.first = null; gameState.second = null; gameState.moves = 0; gameState.matches = 0; gameState.busy = false;
  const grid = document.getElementById('grid'); grid.innerHTML = '';
  updateStats();
  // then immediately start a new shuffled game
  setTimeout(()=> document.getElementById('startGame').click(), 50);
});

// Auto-start a game once game tab opened first time
navGameBtn.addEventListener('click', ()=>{ if(!gameState.cards || gameState.cards.length===0) document.getElementById('startGame').click(); });

