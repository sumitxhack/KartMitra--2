# KartMitra Mobile LAN Access Guide (मोबाइल पर कैसे चलाएं)

Yeh guide batati hai ki kaise aap KartMitra application ko apne mobile phone par usi Wi-Fi / LAN network par chala sakte hain jis par aapka Windows PC chal raha hai.

---

## 1. Quick Start Steps (फास्ट स्टेप्स)

1. **Same Wi-Fi Connection (एक ही वाई-फाई)**:
   - Apne Mobile phone aur Development PC ko ek hi Wi-Fi network se connect karein.

2. **Start All Services (सर्वर स्टार्ट करें)**:
   - Root directory me `MOBILE_START.bat` par **Double Click** karein.
   - Yeh script automatic aapke PC ka LAN IPv4 address (jaise `192.168.1.39` ya `10.x.x.x`) detect karegi aur chaaro servers ko `0.0.0.0` (all interfaces) par start kar degi:
     - **KartMitra Customer Frontend**: `http://<PC_IP>:5173/`
     - **KartMitra Backend**: `http://<PC_IP>:5000/`
     - **AI Lab Admin Frontend**: `http://<PC_IP>:3000/`
     - **AI Lab FastAPI Backend**: `http://<PC_IP>:8000/`

3. **Open On Mobile (मोबाइल में खोलें)**:
   - Mobile browser (Chrome / Safari / Firefox) open karein.
   - Launcher window me print hua URL open karein:
     `http://<PC_IP>:5173/` (jaise `http://192.168.1.39:5173/`)

4. **For Store Admin Portal (एडमिन पोर्टल)**:
   - Mobile ya PC par open karein:
     `http://<PC_IP>:5173/admin`
     (Yeh automatic AI Verification Lab Admin Dashboard `http://<PC_IP>:3000` par redirect kar dega).

5. **Clean Shutdown (सर्वर बंद करना)**:
   - Jab kaam ho jaye, `MOBILE_STOP.bat` par double click karein.
   - Yeh keval ports 8000, 3000, 5000, 5173 ke dev processes ko band karega. Database (PostgreSQL / MongoDB) surakshit rahegi.

---

## 2. Troubleshooting & Firewall (अगर पेज न खुले)

Agar mobile par page load nahi ho raha ho ("Site can't be reached"):

1. **Windows Firewall (विंडोज फायरवॉल)**:
   - Windows Defender Firewall me **Node.js** aur **Python** ko Private Network ke liye Allow karein.
   - Ya Windows Firewall me incoming TCP ports allow karein:
     - `5173` (Vite Frontend)
     - `5000` (Express Backend)
     - `3000` (Next.js Frontend)
     - `8000` (FastAPI Backend)

2. **Network Profile**:
   - Make sure aapka Windows Wi-Fi connection **Private Network** set ho (Public Network me Windows LAN connections block kar deta hai).

3. **Verify Server Listening**:
   - PC par command prompt me check karein:
     `netstat -ano | findstr 5173`
     `netstat -ano | findstr 5000`
     Donon `0.0.0.0:5173` aur `0.0.0.0:5000` par `LISTENING` hona chahiye.

---

## 3. Mobile Camera & Barcode Scanner Permission (कैमरा परमिशन)

Modern mobile browsers (Chrome / Safari / Brave / Edge) me security policy ki wajah se `getUserMedia` (Camera) **Secure Contexts** (HTTPS ya `localhost`) ke liye require hota hai.

Agar mobile browser HTTP IP par camera permission block kare:

### Option A: Chrome Insecure Origins Flag (Sabse aasan testing tareeqa)
1. Mobile Chrome browser me URL daalein:
   `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Is flag ko **Enabled** karein.
3. Box me aapka PC URL daalein, jaise:
   `http://192.168.1.39:5173`
4. Chrome ko **Relaunch** karein.
5. Ab camera access bina kisi restriction ke allow ho jayega.

### Option B: Local Tunnel / HTTPS Development Proxy
- Agar bina flags ke HTTPS chahiye toh:
  `npx local-ssl-proxy --source 5174 --target 5173`

---

## 4. Complete System Flow (आर्किटेक्चर फ्लो)

Mobile Browser (Phone)
      ↓
http://<PC_IP>:5173 (KartMitra Vite Frontend)
      ↓
http://<PC_IP>:5000/api (KartMitra Express Backend)
      ↓
http://localhost:8000 (AI Verification Lab FastAPI Backend)
      ↓
PostgreSQL Database + DINOv2 + FAISS Index + YOLO + OCR

- **Product Master**: PostgreSQL remains the single source of truth for products.
- **Cart & Sessions**: MongoDB stores shopping carts and sessions.
- **No Direct DB Exposure**: Phone directly interacts only with Frontend (5173) and Express API (5000). Databases are never exposed to the phone.
