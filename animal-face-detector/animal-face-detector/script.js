// ====== 고정 모델 URL (창이가 준 링크) ======
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/9Srnd73d4/model.json";

// ====== 라벨 ↔ 표시텍스트/이미지 매핑 ======
// TM 라벨은 '강아지상/고양이상/여우상/하마상'일 가능성이 높음.
// 화면에는 '강아지형'처럼 보이게 표시 텍스트만 바꿔줌.
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

// ====== 로딩 애니메이션 설정 ======
const LOADING_KEYS = ["강아지상","고양이상","하마상","여우상"];
const LOADING_FPS = 3;         // 1초당 3장
const LOADING_MS = 1200;       // 로딩 총 시간 (원하는 만큼 조정)
const PREDICT_DELAY_MS = 1000; // 버튼 누르고 1초 뒤 예측 확정

// ====== 상태 ======
let model = null;
let webcam = null;
let carouselTimer = null;
let decidedLabel = null;

// ====== DOM ======
const webcamWrap   = document.getElementById("webcamWrap");
const predictBtn   = document.getElementById("predictBtn");
const resetBtn     = document.getElementById("resetBtn");
const statusEl     = document.getElementById("status");
const resultImg    = document.getElementById("resultImage");
const resultLabel  = document.getElementById("resultLabel");
const loadingOv    = document.getElementById("loadingOverlay");

// ====== 유틸 ======
const setStatus = (t)=>{ statusEl.textContent = t; };
const showOverlay = (b)=> loadingOv.classList.toggle("show", !!b);

function stopCarousel(){
  if (carouselTimer){ clearInterval(carouselTimer); carouselTimer = null; }
  showOverlay(false);
}
function startCarouselRandom(){
  stopCarousel();
  showOverlay(true);
  const interval = Math.max(1, Math.floor(1000 / LOADING_FPS)); // 333ms
  carouselTimer = setInterval(()=>{
    const key = LOADING_KEYS[Math.floor(Math.random()*LOADING_KEYS.length)];
    const img = LABEL_TO_IMAGE[key];
    if (img) resultImg.src = `./images/${img}`;
    resultLabel.textContent = "로딩 중…";
  }, interval);
  // 일정 시간 뒤 자동 종료
  setTimeout(stopCarousel, LOADING_MS);
}

// ====== TM 모델/웹캠 ======
async function loadModel(){
  setStatus("모델 로드 중…");
  const metadataURL = MODEL_URL.replace("model.json","metadata.json");
  model = await tmImage.load(MODEL_URL, metadataURL);
}

async function startWebcam(){
  setStatus("카메라 준비 중…");
  const size = Math.min(Math.floor(window.innerWidth*0.9), 640) || 640;
  webcam = new tmImage.Webcam(size, size, true); // 미러
  await webcam.setup({ video:true, audio:false, facingMode:"user" }).catch(()=>{
    throw new Error("카메라 접근 실패: 권한 또는 브라우저 설정을 확인하세요.");
  });
  await webcam.play();
  webcamWrap.innerHTML = "";
  webcamWrap.appendChild(webcam.canvas);
  setStatus("대기 중");
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
  decidedLabel = label;
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
  decidedLabel = null;
  resultImg.removeAttribute("src");
  resultLabel.textContent = "아직 결과 없음";
  setStatus("대기 중");
  resetBtn.disabled = true;
  predictBtn.disabled = false;
}

// ====== 흐름: 초기화 → 프리뷰 켜기 ======
(async function init(){
  try{
    await loadModel();
    await startWebcam();
  }catch(e){
    console.error(e);
    setStatus(e.message || "초기화 오류");
  }
})();

// ====== 버튼: 얼굴형 찾기 ======
predictBtn.addEventListener("click", async ()=>{
  try{
    predictBtn.disabled = true;
    resetBtn.disabled = true;
    setStatus("분석 준비…");

    // 1) 버튼 누르고 1초 뒤 예측 확정
    await new Promise(r => setTimeout(r, PREDICT_DELAY_MS));
    const topLabel = await predictTopOnce();
    if (!topLabel) throw new Error("예측 실패");

    // 2) 랜덤 로딩 애니메이션 (1초당 3장, 잠깐)
    startCarouselRandom();

    // 3) 로딩이 끝난 직후 결과 노출 (LOADING_MS 뒤)
    setTimeout(()=>{
      showResult(topLabel);
    }, LOADING_MS + 10);
  }catch(e){
    console.error(e);
    setStatus(e.message || "오류");
    predictBtn.disabled = false;
  }
});

// ====== 버튼: 다시하기 ======
resetBtn.addEventListener("click", resetAll);
