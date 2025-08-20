const DEFAULT_MODEL_SOURCE = "https://teachablemachine.withgoogle.com/models/9Srnd73d4/model.json";

const LABEL_TO_IMAGE = {
  "강아지상":"강아지상.png",
  "고양이상":"고양이상.png",
  "여우상":"여우상.png",
  "하마상":"하마상.png"
};
const LOADING_SEQUENCE = ["강아지상","고양이상","하마상","여우상"];
const WARMUP_MS = 400;

let model, webcam, currentStreamDeviceId = null;
let isMirrored = true;
let carouselTimer = null;

const modelInput   = document.getElementById("modelInput");
const useUrlBtn    = document.getElementById("useUrlBtn");
const cameraSelect = document.getElementById("cameraSelect");
const resSelect    = document.getElementById("resolutionSelect");
const mirrorToggle = document.getElementById("mirrorToggle");
const webcamWrap   = document.getElementById("webcamWrap");
const startBtn     = document.getElementById("startBtn");
const retakeBtn    = document.getElementById("retakeBtn");
const statusEl     = document.getElementById("status");

const resultImg    = document.getElementById("resultImage");
const resultLabel  = document.getElementById("resultLabel");
const loadingOv    = document.getElementById("loadingOverlay");

function setStatus(txt){ statusEl.textContent = txt; }

function startCarousel(){
  stopCarousel();
  loadingOv.classList.add("show");
  let idx = 0;
  carouselTimer = setInterval(()=>{
    const key = LOADING_SEQUENCE[idx % LOADING_SEQUENCE.length];
    resultImg.src = `./images/${LABEL_TO_IMAGE[key]}`;
    resultLabel.textContent = "로딩 중…";
    idx++;
  }, 160);
}
function stopCarousel(){
  if (carouselTimer) clearInterval(carouselTimer);
  carouselTimer = null;
  loadingOv.classList.remove("show");
}

async function listCameras(){
  cameraSelect.innerHTML = "";
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter(d => d.kind === "videoinput");
  cams.forEach((d, i) => {
    const opt = document.createElement("option");
    opt.value = d.deviceId;
    opt.textContent = d.label || `카메라 ${i+1}`;
    cameraSelect.appendChild(opt);
  });
  if (!currentStreamDeviceId && cams[0]) currentStreamDeviceId = cams[0].deviceId;
  if (currentStreamDeviceId) cameraSelect.value = currentStreamDeviceId;
}

async function startWebcam(){
  const size = parseInt(resSelect.value || "640", 10);
  webcam = new tmImage.Webcam(size, size, isMirrored);
  await webcam.setup({ deviceId: currentStreamDeviceId ? { exact: currentStreamDeviceId } : undefined });
  await webcam.play();
  webcamWrap.innerHTML = "";
  webcamWrap.appendChild(webcam.canvas);
}
async function stopWebcam(){
  try { if (webcam && webcam.stop) webcam.stop(); } catch(_){}
  webcam = null;
}

async function loadModel(source){
  let modelURL = source;
  let metadataURL = source.replace("model.json","metadata.json");
  model = await tmImage.load(modelURL, metadataURL);
}

async function predictOnce(){
  if (!webcam || !model) return;
  webcam.update();
  const preds = await model.predict(webcam.canvas);
  preds.sort((a,b)=> b.probability - a.probability);
  const top = preds[0];
  showResult(top.className);
}

function showResult(label){
  stopCarousel();
  const imgFile = LABEL_TO_IMAGE[label];
  if (imgFile) resultImg.src = `./images/${imgFile}`;
  else resultImg.removeAttribute("src");
  resultLabel.textContent = label;
  setStatus("완료");
  retakeBtn.disabled = false;
}

useUrlBtn.addEventListener("click", async ()=>{
  try{
    setStatus("모델 적용 중…");
    await loadModel(modelInput.value.trim() || DEFAULT_MODEL_SOURCE);
    setStatus("모델 준비 완료");
  }catch(e){
    console.error(e);
    setStatus("모델 로딩 실패: 주소 확인");
  }
});

cameraSelect.addEventListener("change", async (e)=>{
  currentStreamDeviceId = e.target.value;
  if (webcam) { await stopWebcam(); await startWebcam(); }
});
resSelect.addEventListener("change", async ()=>{
  if (webcam) { await stopWebcam(); await startWebcam(); }
});
mirrorToggle.addEventListener("change", async (e)=>{
  isMirrored = !!e.target.checked;
  if (webcam) { await stopWebcam(); await startWebcam(); }
});

startBtn.addEventListener("click", async ()=>{
  try{
    startBtn.disabled = true;
    retakeBtn.disabled = true;
    await loadModel(modelInput.value.trim() || DEFAULT_MODEL_SOURCE);
    await listCameras();
    await startWebcam();
    setStatus("로딩 중…");
    startCarousel();
    setTimeout(async ()=>{ await predictOnce(); }, WARMUP_MS);
  }catch(err){
    console.error(err);
    stopCarousel();
    setStatus("오류: HTTPS(또는 localhost)·카메라 권한 확인");
    startBtn.disabled = false;
  }
});

retakeBtn.addEventListener("click", async ()=>{
  retakeBtn.disabled = true;
  setStatus("재촬영…");
  startCarousel();
  setTimeout(async ()=>{ await predictOnce(); }, WARMUP_MS);
});

(async function init(){ await listCameras(); setStatus("대기 중"); })();
