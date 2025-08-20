// ====== 0) Teachable Machine 라이브러리 보장 로더 ======
async function ensureTmLib() {
  if (window.tmImage && window.tmImage.Webcam) return; // 이미 로드됨

  const cdnList = [
    "https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8/dist/teachablemachine-image.min.js",
    "https://unpkg.com/@teachablemachine/image@0.8/dist/teachablemachine-image.min.js",
    "https://cdn.jsdelivr.net/gh/googlecreativelab/teachablemachine-community@v0.8/dist/teachablemachine-image.min.js"
  ];

  for (const src of cdnList) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.crossOrigin = "anonymous";
        s.referrerPolicy = "no-referrer";
        s.onload = resolve;
        s.onerror = () => reject(new Error("failed: " + src));
        document.head.appendChild(s);
      });
      if (window.tmImage && window.tmImage.Webcam) return;
    } catch (_) {}
  }
  throw new Error("tmImage 라이브러리 로드 실패 (네트워크/차단 확인)");
}

// ====== 1) 고정 모델 URL ======
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/9Srnd73d4/model.json";

// ====== 2) 라벨 ↔ 이미지/표시 텍스트 ======
const LABEL_TO_IMAGE = {
  "강아지상":"강아지상.png",
  "고양이상":"고양이상.png",
  "여우상":"여우상.png",
  "하마상":"하마상.png"
};
const LABEL_TO_DISPLAY = {
  "강아지상":"강아지형",
  "고양이상":"고양이형",
  "여우상":"여우형",
  "하마상":"하마형"
};

// ====== 3) 동작 타이밍 ======
const PREDICT_DELAY_MS = 1000;  // "얼굴형 찾기" 누르고 1초 뒤 예측 확정
const LOADING_FPS = 3;          // 로딩 중 1초에 3장 랜덤 교체
const LOADING_MS = 1200;        // 로딩 총 시간

// ====== 4) 상태/DOM ======
let model = null;
let webcam = null;
let carouselTimer = null;

const webcamWrap   = document.getElementById("webcamWrap");
const startCamBtn  = document.getElementById("startCamBtn");
const predictBtn   = document.getElementById("predictBtn");
const resetBtn     = document.getElementById("resetBtn");
const statusEl     = document.getElementById("status");
const resultImg    = document.getElementById("resultImage");
const resultLabel  = document.getElementById("resultLabel");
const loadingOv    = document.getElementById("loadingOverlay");

// ====== 5) 유틸 ======
const setStatus = (t)=>{ if(statusEl) statusEl.textContent = t; };
const showOverlay = (b)=> loadingOv.classList.toggle("show", !!b);
function handleError(e){
  console.error(e);
  setStatus("오류: " + (e?.message || e));
  alert("오류가 발생했어요:\n" + (e?.message || e));
  predictBtn.disabled = false;
  resetBtn.disabled = false;
}

// 로딩 애니메이션 (랜덤 이미지 교체)
function startCarouselRandom(){
  stopCarousel();
  showOverlay(true);
  const keys = Object.keys(LABEL_TO_IMAGE);
  const interval = Math.max(1, Math.floor(1000 / LOADING_FPS));
  carouselTimer = setInterval(()=>{
    const key = keys[Math.floor(Math.random()*keys.length)];
    resultImg.src = `./images/${LABEL_TO_IMAGE[key]}`;
    resultLabel.textContent = "로딩 중…";
  }, interval);
  setTimeout(stopCarousel, LOADING_MS); // 자동 종료
}
function stopCarousel(){
  if (carouselTimer){ clearInterval(carouselTimer); carouselTimer = null; }
  showOverlay(false);
}

// ====== 6) TM 모델 & 웹캠 ======
async function loadModel(){
  await ensureTmLib(); // ← 반드시 먼저
  setStatus("모델 로드 중…");
  const metadataURL = MODEL_URL.replace("model.json","metadata.json");
  model = await tmImage.load(MODEL_URL, metadataURL);
}

async function startWebcam(){
  await ensureTmLib(); // ← 반드시 먼저
  setStatus("카메라 준비 중…");
  const size = Math.min(Math.floor(window.innerWidth * 0.9), 640) || 640;
  webcam = new tmImage.Webcam(size, size, true); // 미러
  try{
    await webcam.setup({ video:true, audio:false, facingMode:"user" });
  }catch(_){
    throw new Error("카메라 접근 실패: 브라우저/OS 권한을 확인하세요.");
  }
  await webcam.play();
  webcamWrap.innerHTML = "";
  webcamWrap.appendChild(webcam.canvas);
  setStatus("카메라 ON");
}

async function predictTopOnce(){
  if (!model || !webcam) return null;
  webcam.update();
  const preds = await model.predict(webcam.canvas);
  preds.sort((a,b)=> b.probability - a.probability);
  return preds[0]?.className || null;
}

// ====== 7) 결과/초기화 ======
function showResult(label){
  const img = LABEL_TO_IMAGE[label];
  const text = LABEL_TO_DISPLAY[label] || label;
  if (img) resultImg.src = `./images/${img}`;
  resultLabel.textContent = text;
  setStatus("완료");
  resetBtn.disabled = false;
  predictBtn.disabled = false;
}

async function resetAll(){
  stopCarousel();
  resultImg.removeAttribute("src");
  resultLabel.textContent = "아직 결과 없음";
  setStatus("대기 중 (카메라 ON)");
  resetBtn.disabled = true;
  predictBtn.disabled = false;
}

// ====== 8) 초기화 (모델만 먼저) ======
(async function init(){
  try{
    await loadModel();            // tmImage 보장 + 모델 로드
    setStatus("대기 중 (카메라 꺼짐)");
  }catch(e){ handleError(e); }
})();

// ====== 9) 버튼 바인딩 ======
startCamBtn.addEventListener("click", async ()=>{
  startCamBtn.disabled = true;
  try{
    await startWebcam();
    predictBtn.disabled = false;  // 예측 버튼 활성화
    resetBtn.disabled = false;
  }catch(e){
    alert(e.message || e);
    startCamBtn.disabled = false;
  }
});

predictBtn.addEventListener("click", async ()=>{
  try{
    predictBtn.disabled = true;
    resetBtn.disabled = true;
    setStatus("분석 준비…");

    await new Promise(r => setTimeout(r, PREDICT_DELAY_MS)); // 1초 후 예측
    const topLabel = await predictTopOnce();
    if (!topLabel) throw new Error("예측 실패");

    startCarouselRandom(); // 짧은 로딩
    setTimeout(()=> showResult(topLabel), LOADING_MS + 10);
  }catch(e){ handleError(e); }
});

resetBtn.addEventListener("click", resetAll);

window.addEventListener("beforeunload", ()=>{ try{ webcam?.stop?.(); }catch(_){} });
