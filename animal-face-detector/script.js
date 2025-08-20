// ====== 고정 모델 URL (창이가 준 링크) ======
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/9Srnd73d4/model.json";

// ====== 라벨 ↔ 이미지/표시 텍스트 ======
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

// ====== 동작 타이밍 ======
const PREDICT_DELAY_MS = 1000;  // "얼굴형 찾기" 누르고 1초 뒤 예측 확정
const LOADING_FPS = 3;          // 로딩 중 1초에 3장 랜덤 교체
const LOADING_MS = 1200;        // 로딩 총 시간

// ====== 상태 ======
let model = null;
let webcam = null;
let carouselTimer = null;

// ====== DOM ======
const webcamWrap   = document.getElementById("webcamWrap");
const startCamBtn  = document.getElementById("startCamBtn");
const predictBtn   = document.getElementById("predictBtn");
const resetBtn     = document.getElementById("resetBtn");
const statusEl     = document.getElementById("status");
const resultImg    = document.getElementById("resultImage");
const resultLabel  = document.getElementById("resultLabel");
const loadingOv    = document.getElementById("loadingOverlay");

// ====== 유틸 ======
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
  // 자동 종료
  setTimeout(stopCarousel, LOADING_MS);
}
function stopCarousel(){
  if (carouselTimer){ clearInterval(carouselTimer); carouselTimer = null; }
  showOverlay(false);
}

// ====== TM 모델 & 웹캠 ======
async function loadModel(){
  setStatus("모델 로드 중…");
  const metadataURL = MODEL_URL.replace("model.json","metadata.json");
  // tmImage 네임스페이스는 index.html에서 CDN으로 먼저 로드됨
  model = await tmImage.load(MODEL_URL, metadataURL);
}

async function startWebcam(){
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

// ====== 결과 표시 & 초기화 ======
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

// ====== 초기화: 모델만 로드 (카메라는 버튼으로) ======
(async function init(){
  try{
    await loadModel();            // 모델 먼저 로드
    setStatus("대기 중 (카메라 꺼짐)");
  }catch(e){ handleError(e); }
})();

// ====== 버튼: 카메라 켜기 ======
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

// ====== 버튼: 얼굴형 찾기 ======
predictBtn.addEventListener("click", async ()=>{
  try{
    predictBtn.disabled = true;
    resetBtn.disabled = true;
    setStatus("분석 준비…");

    // 1) 1초 대기 후 예측 확정
    await new Promise(r => setTimeout(r, PREDICT_DELAY_MS));
    const topLabel = await predictTopOnce();
    if (!topLabel) throw new Error("예측 실패");

    // 2) 랜덤 로딩(3fps) 잠깐 보여주고
    startCarouselRandom();

    // 3) 로딩 끝난 직후 결과 표시
    setTimeout(()=> showResult(topLabel), LOADING_MS + 10);
  }catch(e){ handleError(e); }
});

// ====== 버튼: 다시하기 ======
resetBtn.addEventListener("click", resetAll);

// 안전 종료
window.addEventListener("beforeunload", ()=>{ try{ webcam?.stop?.(); }catch(_){} });
